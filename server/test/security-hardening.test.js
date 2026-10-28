// REV-SEC regression tests (added 2026-10-26) for the security hardening pass.
// Offline: no .env read and no database connection.
//   node --test test/security-hardening.test.js
// The database-backed attack tests are in security-database.test.js.
//
// Each test name starts with the REV-SEC number of the change it checks, so
// a failing test points straight at the matching section of
// security-reports/week-of-2026-10-26/security-hardening-2026-10-26.md.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import express from "express";
import mongoose from "mongoose";
import session from "express-session";

// app.js imports the dotenv loader indirectly. Block that one file read so the
// developer's real .env is never loaded (same approach as the older tests).
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const originalRead = fs.readFileSync;
fs.readFileSync = function (file, options) {
  if ((file instanceof URL ? fileURLToPath(file) : String(file)) === envPath) return options ? "" : Buffer.alloc(0);
  return originalRead.apply(this, arguments);
};
let createApp;
try { ({ createApp } = await import("../app.js")); }
finally { fs.readFileSync = originalRead; }

const { hashNewPassword, verifyPassword, needsRehash, PASSWORD_WORK_LIMITS } = await import("../security/passwords.js");
const { parseLogin, parseRegistration, readEmail, isReservedUsername } = await import("../security/input.js");
const { isSafeWebUrl } = await import("../models/validators.js");
const { getTrustProxy } = await import("../config/env.js");
const totp = await import("../security/totp.js");
const { readObjectId, findOwned, assertOwner } = await import("../security/access.js");
const { default: User } = await import("../models/User.js");
const { default: Post } = await import("../models/Post.js");
const { default: Game } = await import("../models/Game.js");
const { default: Project } = await import("../models/Project.js");
const { createAuth } = await import("../security/auth.js");
const { createAuthService } = await import("../services/authService.js");

const password = "a long test password with spaces";
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function listen(app) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); },
  };
}

// ---------------------------------------------------------------------------
// REV-SEC-01: the server's password and auth modules load again
// ---------------------------------------------------------------------------
test("REV-SEC-01: passwords.js, authService.js and auth.js all load (they used to crash on import)", async () => {
  for (const file of ["../security/passwords.js", "../services/authService.js", "../security/auth.js"]) {
    await assert.doesNotReject(import(file));
  }
});

test("REV-SEC-01: new password hashes are Argon2id with REV's cost settings", async () => {
  const hash = await hashNewPassword(password);
  assert.match(hash, /^\$argon2id\$v=19\$/);
  for (const part of ["m=19456", "t=2", "p=1"]) assert.ok(hash.includes(part), part);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(`${password}!`, hash), false);
});

// ---------------------------------------------------------------------------
// REV-SEC-02: no email enumeration through login timing
// ---------------------------------------------------------------------------
test("REV-SEC-02: an unknown account does the same Argon2 work as a real one (timing)", async () => {
  const hash = await hashNewPassword(password);
  await verifyPassword("warm up", undefined);
  const known = [];
  const unknown = [];
  for (let round = 0; round < 15; round += 1) {
    let start = performance.now();
    await verifyPassword("wrong guess", hash);
    known.push(performance.now() - start);
    start = performance.now();
    await verifyPassword("wrong guess", undefined);
    unknown.push(performance.now() - start);
  }
  const ratio = median(known) / median(unknown);
  // Before the fix the unknown case returned instantly (about 8x faster).
  assert.ok(ratio > 0.5 && ratio < 2, `known/unknown timing ratio ${ratio.toFixed(2)}`);
});

test("REV-SEC-02: non-text passwords and malformed stored hashes are refused", async () => {
  for (const bad of [undefined, null, 123, ["x"], { $ne: null }]) assert.equal(await verifyPassword(bad, "x"), false);
  for (const stored of [null, "", "plain-text-password", "$argon2id$v=19$m=999999,t=99,p=9$AAAA$BBBB", "$2b$10$bcrypt-style"]) {
    assert.equal(await verifyPassword(password, stored), false);
  }
});

test("REV-SEC-02: legacy scrypt accounts still sign in and are flagged for an upgrade", async () => {
  const salt = randomBytes(16).toString("hex");
  const derived = await promisify(scrypt)(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  const legacy = `$scrypt$131072$8$1$${salt}$${derived.toString("hex")}`;
  assert.equal(await verifyPassword(password, legacy), true);
  assert.equal(await verifyPassword("wrong password", legacy), false);
  assert.equal(needsRehash(legacy), true);
  assert.equal(needsRehash(await hashNewPassword(password)), false);
  assert.equal(needsRehash("$argon2id$v=19$m=4096,t=3,p=1$c29tZXNhbHRzb21lc2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g"), true);
});

// ---------------------------------------------------------------------------
// REV-SEC-03: bursts of sign-ins wait in line instead of failing
// ---------------------------------------------------------------------------
test("REV-SEC-03: 8 simultaneous password checks all succeed (before: 4 of 8 got 503)", async () => {
  const hash = await hashNewPassword(password);
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => verifyPassword(password, hash)));
  assert.deepEqual(results.map((result) => result.status === "fulfilled" && result.value), Array(8).fill(true));
});

test("REV-SEC-03: a flood beyond the waiting line is refused with 503, and memory stays bounded", async () => {
  const { MAX_CONCURRENT_HASHES, MAX_WAITING_HASHES } = PASSWORD_WORK_LIMITS;
  const total = MAX_CONCURRENT_HASHES + MAX_WAITING_HASHES + 24;
  const results = await Promise.allSettled(Array.from({ length: total }, () => verifyPassword("guess", undefined)));
  const refused = results.filter((result) => result.status === "rejected");
  assert.equal(refused.length, 24);
  assert.ok(refused.every((result) => result.reason.status === 503));
  // The slots are all released afterwards: normal work succeeds again.
  assert.equal(await verifyPassword("guess", undefined), false);
});

// ---------------------------------------------------------------------------
// REV-SEC-08 / REV-SEC-21: usernames and email input
// ---------------------------------------------------------------------------
const registration = (username, email = "fixture@example.invalid") => parseRegistration({ username, email, password });

test("REV-SEC-08: ordinary usernames are accepted", () => {
  for (const name of ["Jah", "jah_99", "gamer.one", "a-b", "Player2026"]) assert.equal(registration(name).username, name);
});

for (const name of ["Jаh" /* Cyrillic а */, "j ah", "_jah", "jah_", "..", "jah​", "jâh", "<b>jah</b>", "ja$h"]) {
  test(`REV-SEC-08: look-alike or unsafe username ${JSON.stringify(name)} is rejected`, () => {
    assert.throws(() => registration(name), { status: 400 });
  });
}

for (const name of ["admin", "Admin", "ADMINISTRATOR", "Ad_Min", "r.o.o.t", "support", "Moderator", "rev"]) {
  test(`REV-SEC-08: staff-like username ${name} is not available`, () => {
    assert.throws(() => registration(name), { status: 409, message: "That username is not available." });
  });
}

test("REV-SEC-08: RESERVED_USERNAMES adds the owner's own names", () => {
  assert.equal(isReservedUsername("Jah", "jah,jamar"), true);
  assert.equal(isReservedUsername("J_A_H", "jah"), true);
  assert.equal(isReservedUsername("Jahmal", "jah"), false);
});

for (const email of ["a​b@example.com", "a@exa\u0000mple.com", "a b@example.com", "a@example.com\r\nBcc: x@y.z", "a@b", "@example.com"]) {
  test(`REV-SEC-21: unsafe email ${JSON.stringify(email)} is rejected`, () => assert.throws(() => readEmail(email), { status: 400 }));
}

test("REV-SEC-21: normal emails are trimmed and lower-cased", () => {
  assert.equal(readEmail("  Jah.Brown+rev@Example.COM "), "jah.brown+rev@example.com");
});

test("REV-SEC-09: login accepts an optional 6-digit code and rejects anything else", () => {
  assert.equal(parseLogin({ email: "a@b.co", password: "p", code: "123 456" }).code, "123456");
  assert.equal(parseLogin({ email: "a@b.co", password: "p" }).code, undefined);
  for (const code of ["12345", "1234567", "abcdef", 123456, ["123456"], null]) {
    assert.throws(() => parseLogin({ email: "a@b.co", password: "p", code }), { status: 400 });
  }
  assert.throws(() => parseLogin({ email: "a@b.co", password: "p", code: { $ne: null } }), { status: 400 });
});

// ---------------------------------------------------------------------------
// REV-SEC-07 / REV-SEC-08 / REV-SEC-14 / REV-SEC-17: models
// ---------------------------------------------------------------------------
test("REV-SEC-07: user email is hidden from queries and from JSON", () => {
  assert.equal(User.schema.path("email").options.select, false);
  const user = new User({ username: "fixture", email: "fixture@example.invalid", passwordHash: "x", mfa: { secretEnc: "v1.a.b.c" } });
  const json = user.toJSON();
  for (const field of ["email", "passwordHash", "sessionVersion", "mfa", "__v"]) assert.equal(json[field], undefined, field);
  assert.equal(json.username, "fixture");
});

test("REV-SEC-09: two-step secrets are hidden from ordinary queries", () => {
  assert.equal(User.schema.path("mfa.secretEnc").options.select, false);
  assert.equal(User.schema.path("mfa.lastUsedStep").options.select, false);
});

test("REV-SEC-08: usernames are unique ignoring capital letters (index declared)", () => {
  const index = User.schema.indexes().find(([keys, options]) => keys.username === 1 && options.name === "username_case_insensitive_unique");
  assert.ok(index, "case-insensitive username index missing");
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].collation, { locale: "en", strength: 2 });
});

test("REV-SEC-14: every model shares the database safety settings", () => {
  assert.equal(mongoose.get("sanitizeFilter"), true);
  assert.equal(typeof mongoose.trusted, "function");
});

test("REV-SEC-14: post lookups by author and by game are indexed", () => {
  const keys = Post.schema.indexes().map(([fields]) => JSON.stringify(fields));
  assert.ok(keys.includes(JSON.stringify({ authorId: 1, createdAt: -1 })));
  assert.ok(keys.includes(JSON.stringify({ gameId: 1, createdAt: -1 })));
});

const urlCases = [
  ["https://example.com/a.png", {}, true],
  ["", {}, true],
  [undefined, {}, true],
  ["http://example.com/a.png", {}, false],
  ["http://example.com/a.png", { allowHttp: true }, true],
  ["javascript:alert(1)", {}, false],
  ["JaVaScRiPt:alert(1)", { allowRelative: true }, false],
  ["data:text/html;base64,PHNjcmlwdD4=", {}, false],
  ["file:///etc/passwd", {}, false],
  ["https://user:pass@example.com/", {}, false],
  ["//evil.example/a.png", { allowRelative: true }, false],
  ["/images/cover.png", {}, false],
  ["/images/cover.png", { allowRelative: true }, true],
  ["/images/../../x", { allowRelative: true }, true],
  ["/images/<script>.png", { allowRelative: true }, false],
  [`https://example.com/${"a".repeat(2001)}`, {}, false],
  [{ $ne: null }, {}, false],
];
for (const [value, options, expected] of urlCases) {
  test(`REV-SEC-17: link ${JSON.stringify(value)?.slice(0, 50)} with ${JSON.stringify(options)} -> ${expected ? "allowed" : "rejected"}`, () => {
    assert.equal(isSafeWebUrl(value, options), expected);
  });
}

test("REV-SEC-17: models refuse dangerous links", async () => {
  const author = new mongoose.Types.ObjectId();
  await assert.rejects(new Post({ authorId: author, title: "t", body: "b", imageUrl: "javascript:alert(1)" }).validate(), { name: "ValidationError" });
  await assert.rejects(new Project({ title: "t", description: "d", liveUrl: "http://insecure.example" }).validate(), { name: "ValidationError" });
  await assert.rejects(new Game({ title: "t", description: "d", platform: "PC", genre: "RPG", coverImage: "data:image/svg+xml,<svg onload=alert(1)>" }).validate(), { name: "ValidationError" });
  await new Game({ title: "t", description: "d", platform: "PC", genre: "RPG", coverImage: "/images/cover.png" }).validate();
  await new Post({ authorId: author, title: "t", body: "b", imageUrl: "https://images.example/cover.png" }).validate();
});

// ---------------------------------------------------------------------------
// REV-SEC-09: two-step sign-in codes (TOTP)
// ---------------------------------------------------------------------------
test("REV-SEC-09: TOTP matches the official RFC 6238 test vectors", () => {
  const secret = Buffer.from("12345678901234567890");
  for (const [seconds, code] of [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"], [20000000000, "353130"]]) {
    assert.equal(totp.hotp(secret, Math.floor(seconds / 30)), code, `T=${seconds}`);
  }
  assert.equal(totp.base32Encode(secret), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
});

test("REV-SEC-09: codes work for 30 s either side, then expire; reuse is refused", () => {
  const secret = totp.generateTotpSecret();
  const now = Date.now();
  const step = totp.totpStep(now);
  const code = totp.hotp(secret, step);
  assert.equal(totp.verifyTotp(secret, code, { now }), step);
  assert.equal(totp.verifyTotp(secret, code, { now: now + 30_000 }), step);
  assert.equal(totp.verifyTotp(secret, code, { now: now + 90_000 }), null);
  assert.equal(totp.verifyTotp(secret, code, { now, lastUsedStep: step }), null);
  for (const bad of ["", "12345", "1234567", "abcdef", 123456, null]) assert.equal(totp.verifyTotp(secret, bad, { now }), null);
});

test("REV-SEC-09: the stored secret is encrypted and tied to one account", () => {
  const key = randomBytes(32);
  const secret = totp.generateTotpSecret();
  const accountId = new mongoose.Types.ObjectId().toString();
  const stored = totp.encryptTotpSecret(secret, key, accountId);
  assert.ok(!stored.includes(secret.toString("hex")) && !stored.includes(totp.base32Encode(secret)));
  assert.ok(totp.decryptTotpSecret(stored, key, accountId).equals(secret));
  assert.throws(() => totp.decryptTotpSecret(stored, randomBytes(32), accountId));
  assert.throws(() => totp.decryptTotpSecret(stored, key, new mongoose.Types.ObjectId().toString()));
  const [version, iv, tag, data] = stored.split(".");
  const flipped = Buffer.from(data, "base64url");
  flipped[0] ^= 1;
  assert.throws(() => totp.decryptTotpSecret([version, iv, tag, flipped.toString("base64url")].join("."), key, accountId));
});

test("REV-SEC-09: ADMIN_MFA_KEY must be 32 random bytes written as 64 hex characters", () => {
  assert.equal(totp.readMfaKey(""), null);
  assert.equal(totp.readMfaKey(undefined), null);
  assert.equal(totp.readMfaKey("ab".repeat(32)).length, 32);
  for (const bad of ["short", "zz".repeat(32), "ab".repeat(31)]) assert.throws(() => totp.readMfaKey(bad));
});

// ---------------------------------------------------------------------------
// REV-SEC-20: one account can't load another account's records
// ---------------------------------------------------------------------------
test("REV-SEC-20: only real 24-character IDs are accepted from URLs (everything else is 404)", () => {
  const id = new mongoose.Types.ObjectId().toString();
  assert.equal(readObjectId(id.toUpperCase()), id);
  for (const bad of ["", "123", `${id}0`, { $ne: null }, [id], null, undefined, "zzzzzzzzzzzzzzzzzzzzzzzz"]) {
    assert.throws(() => readObjectId(bad), { status: 404 });
  }
});

test("REV-SEC-20: findOwned always puts the owner in the database query", async () => {
  const filters = [];
  const FakeModel = { findOne(filter) { filters.push(filter); return { select() {}, then: (resolve) => resolve(null) }; } };
  const id = new mongoose.Types.ObjectId().toString();
  const ownerId = new mongoose.Types.ObjectId();
  await findOwned(FakeModel, { id, ownerId });
  assert.deepEqual(filters[0], { _id: id, ownerId });
  await assert.rejects(findOwned(FakeModel, { id }), /owner/);
  assert.throws(() => assertOwner({ ownerId: new mongoose.Types.ObjectId() }, ownerId), { status: 404 });
  assert.throws(() => assertOwner(null, ownerId), { status: 404 });
});

// ---------------------------------------------------------------------------
// REV-SEC-06: proxy setting is required in production
// ---------------------------------------------------------------------------
test("REV-SEC-06: TRUST_PROXY_HOPS is validated and required in production", () => {
  assert.equal(getTrustProxy({}), false);
  assert.throws(() => getTrustProxy({ NODE_ENV: "production" }), /TRUST_PROXY_HOPS/);
  assert.equal(getTrustProxy({ NODE_ENV: "production", TRUST_PROXY_HOPS: "1" }), 1);
  assert.equal(getTrustProxy({ NODE_ENV: "production", TRUST_PROXY_HOPS: "0" }), false);
  for (const bad of ["4", "-1", "1.5", "one", "true"]) assert.throws(() => getTrustProxy({ TRUST_PROXY_HOPS: bad }));
});

// ---------------------------------------------------------------------------
// app.js: REV-SEC-05 / 13 / 15 / 16 / 18 / 23
// ---------------------------------------------------------------------------
test("REV-SEC-05: one IP flooding the API is slowed to 429; health checks are never blocked", async () => {
  const { base, close } = await listen(createApp({ checkDatabase: async () => true, globalRateLimitMax: 5 }));
  try {
    const statuses = [];
    for (let index = 0; index < 8; index += 1) statuses.push((await fetch(`${base}/api/anything-${index}`)).status);
    assert.deepEqual(statuses, [404, 404, 404, 404, 404, 429, 429, 429]);
    const limited = await fetch(`${base}/api/anything`);
    assert.ok(limited.headers.get("ratelimit-policy"));
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
  } finally { await close(); }
});

test("REV-SEC-13: operator-like or oversized query strings are refused before any route", async () => {
  const { base, close } = await listen(createApp({ checkDatabase: async () => true }));
  try {
    for (const query of ["email[$ne]=x", "%24where=1", "user.role=admin", "__proto__=1", `q=${"x".repeat(2001)}`, Array.from({ length: 31 }, (_, i) => `k${i}=1`).join("&"), Array.from({ length: 21 }, () => "tag=a").join("&")]) {
      const response = await fetch(`${base}/api/health/database?${query}`);
      assert.equal(response.status, 400, query.slice(0, 40));
      assert.deepEqual(await response.json(), { error: "Request contains an unsupported query parameter." });
    }
    assert.equal((await fetch(`${base}/api/health/database?page=2&sort=new&tag=a&tag=b`)).status, 200);
  } finally { await close(); }
});

test("REV-SEC-16: every API answer (even a 404) tells browsers and CDNs not to store it", async () => {
  const { base, close } = await listen(createApp({ checkDatabase: async () => true }));
  try {
    for (const path of ["/api/not-a-route", "/api/health", "/api/health/database"]) {
      assert.equal((await fetch(`${base}${path}`)).headers.get("cache-control"), "no-store", path);
    }
  } finally { await close(); }
});

test("REV-SEC-15: every response carries a fresh request ID; a client-chosen one is ignored", async () => {
  const { base, close } = await listen(createApp({ checkDatabase: async () => true }));
  try {
    const first = await fetch(`${base}/api/health`, { headers: { "X-Request-Id": "forged-log-entry" } });
    const second = await fetch(`${base}/api/health`);
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    assert.match(first.headers.get("x-request-id"), pattern);
    assert.notEqual(first.headers.get("x-request-id"), second.headers.get("x-request-id"));
  } finally { await close(); }
});

test("REV-SEC-15: bad request encodings are 4xx client errors, not 500 server errors", async () => {
  const { base, close } = await listen(createApp({ checkDatabase: async () => true }));
  try {
    // JSON bodies must be UTF-8/16/32; any other declared charset is refused.
    const charset = await fetch(`${base}/api/health`, { method: "POST", headers: { "Content-Type": "application/json; charset=iso-8859-1" }, body: "{}" });
    assert.equal(charset.status, 415);
    assert.deepEqual(await charset.json(), { error: "The request could not be processed." });
    const encoding = await fetch(`${base}/api/health`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "x-unknown" }, body: "{}" });
    assert.equal(encoding.status, 415);
  } finally { await close(); }
});

test("REV-SEC-15: unexpected errors return a generic 500 that never echoes the error text", async () => {
  const secret = "duplicate key error dup key: { email: \"victim@example.invalid\" }";
  const auth = createAuth({ service: createAuthService({ UserModel: User }), store: new session.MemoryStore(), secret: "s".repeat(64), production: false });
  const app = createApp({
    auth,
    checkDatabase: async () => true,
    mountRoutes: (expressApp) => expressApp.get("/api/explode", () => { throw new Error(secret); }),
  });
  const originalError = console.error;
  const logged = [];
  console.error = (line) => logged.push(String(line));
  const { base, close } = await listen(app);
  try {
    const response = await fetch(`${base}/api/explode`);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.error, "An unexpected server error occurred.");
    assert.equal(body.requestId, response.headers.get("x-request-id"));
    assert.ok(!JSON.stringify(body).includes("victim@example.invalid"));
    assert.ok(logged.some((line) => line.includes(body.requestId)), "server log should mention the request ID");
  } finally { console.error = originalError; await close(); }
});

test("REV-SEC-15: Mongoose validation errors become a 400 without field details", async () => {
  const auth = createAuth({ service: createAuthService({ UserModel: User }), store: new session.MemoryStore(), secret: "s".repeat(64), production: false });
  const app = createApp({
    auth,
    checkDatabase: async () => true,
    mountRoutes: (expressApp) => expressApp.get("/api/validate", async () => { await new Post({ title: "x".repeat(500) }).validate(); }),
  });
  const { base, close } = await listen(app);
  try {
    const response = await fetch(`${base}/api/validate`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "The request contains invalid data." });
  } finally { await close(); }
});

test("REV-SEC-18: future routers plug in behind the admin and signed-in guards", async () => {
  const auth = createAuth({ service: createAuthService({ UserModel: User }), store: new session.MemoryStore(), secret: "s".repeat(64), production: false });
  const reached = [];
  const app = createApp({
    auth,
    checkDatabase: async () => true,
    mountRoutes: (expressApp) => {
      const open = express.Router();
      open.get("/", (req, res) => { reached.push(req.originalUrl); res.json({ ok: true }); });
      for (const prefix of ["/api/admin/stats", "/api/dashboard/kpis", "/api/account/me", "/api/demo/report"]) expressApp.use(prefix, open);
      expressApp.use("/api/public-games", open);
    },
  });
  const { base, close } = await listen(app);
  try {
    for (const path of ["/api/admin/stats", "/API/ADMIN/stats", "/api/admin/stats/", "/api/dashboard/kpis", "/api/account/me", "/api/demo/report"]) {
      const response = await fetch(`${base}${path}`, { headers: { "X-User-Role": "admin", Cookie: "role=admin" } });
      assert.equal(response.status, 401, path);
    }
    assert.equal((await fetch(`${base}/api/public-games`)).status, 200);
    assert.deepEqual(reached, ["/api/public-games"]);
  } finally { await close(); }
});

test("REV-SEC-18: routes can't be mounted without the authentication middleware", () => {
  assert.throws(() => createApp({ mountRoutes: () => {} }), /requires authentication/);
});

test("REV-SEC-23: a CLIENT_ORIGIN written with a trailing slash still matches the real site", async () => {
  const { base, close } = await listen(createApp({ checkDatabase: async () => true, clientOrigin: "http://localhost:5173/" }));
  try {
    const response = await fetch(`${base}/api/health`, { headers: { Origin: "http://localhost:5173" } });
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    const other = await fetch(`${base}/api/health`, { headers: { Origin: "http://localhost:5173.attacker.example" } });
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  } finally { await close(); }
});
