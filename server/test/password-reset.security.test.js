// Security regression checks for REV's models and auth-disabled app baseline.
// Real auth routes have dedicated offline and Atlas integration test files.
// These tests do not certify the application safe.
// Cases labelled LIMITATION deliberately demonstrate what schemas do NOT protect.
//
// Offline: node --test test/password-reset.security.test.js
// Atlas opt-in: REV_SECURITY_ATLAS=1 node --test test/password-reset.security.test.js
// Atlas mode loads existing credentials privately and touches ONLY random,
// explicitly named temporary collections, which it removes in finally.

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { once } from "node:events";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import mongoose from "mongoose";
import Reset from "../models/PasswordResetToken.js";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Vote from "../models/Vote.js";

// app.js imports the dotenv loader indirectly. Prevent that read in offline
// mode; do not modify, print, or inspect the user's .env contents.
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function (file, options) {
  const candidate = file instanceof URL ? fileURLToPath(file) : String(file);
  if (candidate === envPath) return options ? "" : Buffer.alloc(0);
  return originalReadFileSync.apply(this, arguments);
};
let createApp;
try {
  ({ createApp } = await import("../app.js"));
} finally {
  fs.readFileSync = originalReadFileSync;
}

const ownerId = new mongoose.Types.ObjectId();
const anotherId = new mongoose.Types.ObjectId();
const digest = (value) => createHash("sha256").update(value).digest("hex");
const validHash = digest("fixture-only-not-a-real-reset-token");
const validReset = (overrides = {}) => ({
  userId: ownerId,
  sessionVersion: 0,
  tokenHash: validHash,
  expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  ...overrides,
});
const validUser = (overrides = {}) => ({
  username: "security-fixture",
  email: "security-fixture@example.invalid",
  passwordHash: "fixture-only-not-a-real-password-hash",
  ...overrides,
});
const validPost = (overrides = {}) => ({
  authorId: ownerId,
  title: "Security fixture",
  body: "Fixture body",
  kind: "discussion",
  ...overrides,
});

async function rejectsField(Model, input, field) {
  await assert.rejects(new Model(input).validate(), (error) => {
    assert.equal(error.name, "ValidationError");
    assert.ok(error.errors[field], `Expected rejection at ${field}`);
    return true;
  });
}

test("CONFIG: reset model targets the explicitly intended collection", () => {
  // Regression for the former misspelled 'colection' option.
  assert.equal(Reset.collection.name, "passwordResetTokens");
});
test("CONFIG: user reference is required", () => assert.equal(Reset.schema.path("userId").options.required, true));
test("CONFIG: user reference targets User", () => assert.equal(Reset.schema.path("userId").options.ref, "User"));
test("CONFIG: hash is excluded from ordinary query projections", () => assert.equal(Reset.schema.path("tokenHash").options.select, false));
test("CONFIG: password hash is excluded from ordinary user projections", () => assert.equal(User.schema.path("passwordHash").options.select, false));
test("CONFIG: reset token unique index is declared", () => assert.ok(Reset.schema.indexes().some(([keys, options]) => keys.tokenHash === 1 && options.unique === true)));
test("CONFIG: absolute-expiration TTL index is declared", () => assert.ok(Reset.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0)));
test("CONFIG: user lookup index is declared", () => assert.ok(Reset.schema.indexes().some(([keys]) => keys.userId === 1)));
test("CONFIG: usedAt defaults to null", () => assert.equal(new Reset(validReset()).usedAt, null));
test("CONFIG: creation timestamp exists", () => assert.ok(Reset.schema.path("createdAt")));
test("CONFIG: no unnecessary update timestamp", () => assert.equal(Reset.schema.path("updatedAt"), undefined));
test("CONFIG: strict document fields enabled", () => assert.equal(Reset.schema.options.strict, true));

const invalidHashLengths = [0, 1, 2, 7, 15, 31, 32, 40, 48, 55, 60, 61, 62, 63, 65, 66, 67, 72, 80, 96, 128, 256, 1024, 65536];
for (const length of invalidHashLengths) {
  test(`HASH: rejects length ${length}`, () => rejectsField(Reset, validReset({ tokenHash: "a".repeat(length) }), "tokenHash"));
}
const invalidHashCharacters = ["g", "z", "A", "F", "-", "_", " ", "\t", "\n", "\0", "$", ".", "/", "é", "中", "\u200b"];
for (const character of invalidHashCharacters) {
  for (const position of [0, 31, 63]) {
    test(`HASH: rejects character ${JSON.stringify(character)} at ${position}`, () => {
      const hash = "a".repeat(64).split("");
      hash[position] = character;
      return rejectsField(Reset, validReset({ tokenHash: hash.join("") }), "tokenHash");
    });
  }
}
const operators = [
  { $ne: null }, { $gt: "" }, { $gte: "" }, { $lt: "z" },
  { $regex: ".*" }, { $exists: true }, { $in: [validHash] },
  { $nin: ["not-the-token"] }, { $not: { $eq: "not-the-token" } },
  { $where: "return true" }, { $function: { body: "return true", args: [], lang: "js" } },
];
const invalidHashTypes = [undefined, null, true, false, 0, 1, NaN, Infinity, -Infinity, [], [validHash], {}, ...operators];
for (const [index, tokenHash] of invalidHashTypes.entries()) {
  test(`HASH: rejects non-string/operator input ${index}`, () => rejectsField(Reset, validReset({ tokenHash }), "tokenHash"));
}
for (const whitespace of [" ", "\t", "\n", "\r", "\r\n", "\u00a0", "\u200b", "\0"]) {
  test(`HASH: does not silently trim token hash ${JSON.stringify(whitespace)}`, () => rejectsField(Reset, validReset({ tokenHash: whitespace + validHash + whitespace }), "tokenHash"));
}

for (const length of [0, 1, 2, 8, 11, 12, 16, 20, 22, 23, 25, 26, 28, 32, 48, 64, 128, 256, 1024]) {
  test(`USER-ID: rejects wrong-length identifier ${length}`, () => rejectsField(Reset, validReset({ userId: "a".repeat(length) }), "userId"));
}
for (let position = 0; position < 24; position++) {
  test(`USER-ID: rejects non-hex identifier at position ${position}`, () => {
    const value = "a".repeat(24).split("");
    value[position] = "z";
    return rejectsField(Reset, validReset({ userId: value.join("") }), "userId");
  });
}
for (const [index, userId] of [undefined, null, true, false, 0, 1, -1, NaN, Infinity, [], ["not-an-id"], {}, ...operators].entries()) {
  test(`USER-ID: rejects wrong type/operator ${index}`, () => rejectsField(Reset, validReset({ userId }), "userId"));
}

const invalidDates = ["", "not-a-date", "2026-99-99", "<script>fixture</script>", "0 OR 1=1", {}, [], ["bad"], ["bad", "date"], true, false, NaN, Infinity, -Infinity, new Date(NaN), ...operators];
for (const field of ["expiresAt", "usedAt"]) {
  for (const [index, value] of invalidDates.entries()) {
    // Mongoose casts an empty optional Date to null rather than rejecting it.
    // Track this separately below as an input-boundary limitation.
    if (field === "usedAt" && value === "") continue;
    test(`DATE: rejects invalid ${field} ${index}`, () => rejectsField(Reset, validReset({ [field]: value }), field));
  }
}
for (const field of ["userId", "tokenHash", "expiresAt"]) {
  test(`REQUIRED: cannot omit ${field}`, async () => {
    const record = validReset();
    delete record[field];
    await rejectsField(Reset, record, field);
  });
}
for (let index = 0; index < 16; index++) {
  test(`VALID: accepts distinct cryptographic digest fixture ${index}`, async () => {
    // Crypto here creates TEST INPUT, not production token-generation code.
    const raw = randomBytes(32).toString("hex");
    const tokenHash = digest(raw);
    assert.notEqual(raw, tokenHash);
    assert.match(raw, /^[a-f0-9]{64}$/);
    await new Reset(validReset({ tokenHash })).validate();
  });
}

const hostileKeys = ["role", "isAdmin", "password", "passwordHash", "email", "authVersion", "$set", "$where", "$function", "__proto__", "constructor", "prototype", "user.role", "tokenHash.$ne"];
for (const key of hostileKeys) {
  test(`STRICT FIELDS: reset model discards unknown key ${key}`, async () => {
    const extra = JSON.parse(`{"${key}":{"revPolluted":true}}`);
    const doc = new Reset({ ...validReset(), ...extra });
    await doc.validate();
    assert.equal(Object.hasOwn(doc.toObject(), key), false);
    assert.equal(Object.prototype.revPolluted, undefined);
  });
}
const injectionTargets = [
  [Reset, "tokenHash", validReset], [Reset, "userId", validReset],
  [Reset, "expiresAt", validReset], [User, "email", validUser],
  [User, "passwordHash", validUser],
];
for (const [Model, field, fixture] of injectionTargets) {
  for (const [index, operator] of operators.entries()) {
    test(`DOCUMENT INJECTION: ${Model.modelName}.${field} rejects operator object ${index}`, () => rejectsField(Model, fixture({ [field]: operator }), field));
  }
}

// Deliberately passing these observations does NOT mean these behaviors are safe
// at an HTTP boundary. Controllers must reject/handle them explicitly.
test("LIMITATION: an expired reset document still validates", async () => new Reset(validReset({ expiresAt: new Date(0) })).validate());
test("LIMITATION: a previously used reset document still validates", async () => new Reset(validReset({ usedAt: new Date() })).validate());
test("LIMITATION: a 64-character raw token cannot be distinguished from a hash by regex", async () => new Reset(validReset({ tokenHash: randomBytes(32).toString("hex") })).validate());
test("REDACTION: newly created reset documents do not expose token hashes in JSON", () => assert.equal(new Reset(validReset()).toJSON().tokenHash, undefined));
test("LIMITATION: an ObjectId reference does not check account existence", async () => new Reset(validReset({ userId: new mongoose.Types.ObjectId() })).validate());
test("LIMITATION: a caller can choose another syntactically valid userId", async () => new Reset(validReset({ userId: anotherId })).validate());
test("LIMITATION: schema permits admin when trusted application code explicitly sets role", async () => new User(validUser({ role: "admin" })).validate());
test("LIMITATION: schema does not hash password strings", async () => new User(validUser({ passwordHash: "not-actually-a-password-hash" })).validate());
test("USER HARDENING: malformed email is rejected", () => rejectsField(User, validUser({ email: "not-an-email" }), "email"));
test("USER HARDENING: fractional session version is rejected", () => rejectsField(User, validUser({ sessionVersion: 0.5 }), "sessionVersion"));
test("LIMITATION: finite token TTL is a controller policy, not a schema maximum", async () => new Reset(validReset({ expiresAt: new Date("2100-01-01") })).validate());
test("LIMITATION: Mongoose can cast a one-element identifier array to ObjectId", async () => {
  const doc = new Reset(validReset({ userId: [ownerId.toString()] }));
  await doc.validate();
  assert.equal(doc.userId.toString(), ownerId.toString());
});
test("LIMITATION: an empty optional usedAt string is cast to null", async () => {
  const doc = new Reset(validReset({ usedAt: "" }));
  await doc.validate();
  assert.equal(doc.usedAt, null);
});
test("LIMITATION: schema permits a caller-supplied _id", () => assert.equal(new Reset(validReset({ _id: anotherId }))._id.toString(), anotherId.toString()));
test("LIMITATION: update validators must be requested by application code", () => assert.equal(Reset.updateOne({ _id: ownerId }, { $set: { tokenHash: "invalid" } }).getOptions().runValidators, undefined));
test("LIMITATION: sanitizeFilter is not enabled globally", () => assert.notEqual(mongoose.get("sanitizeFilter"), true));

for (const [index, operator] of operators.slice(0, 9).entries()) {
  test(`QUERY LIMITATION: string-field query casting preserves operator ${index}`, () => {
    const query = User.findOne({ email: structuredClone(operator) });
    assert.deepEqual(query.cast(User).email, operator);
  });
  test(`QUERY DEFENSE DEMO: explicitly sanitizing nested operator ${index} prevents string casting`, () => {
    const filter = mongoose.sanitizeFilter({ email: structuredClone(operator) });
    assert.ok(Object.hasOwn(filter.email, "$eq"));
    assert.throws(() => User.findOne(filter).cast(User), { name: "CastError" });
  });
}
test("QUERY LIMITATION: raw top-level $where passes query casting; never execute client filters", () => {
  const filter = User.findOne({ $where: "return true" }).cast(User);
  assert.equal(filter.$where, "return true");
});

const inertStrings = [
  "<script>globalThis.__revSecurityExecuted = true</script>",
  '<img src=x onerror="globalThis.__revSecurityExecuted=true">',
  '<svg onload="globalThis.__revSecurityExecuted=true"></svg>',
  "javascript:globalThis.__revSecurityExecuted=true",
  "${globalThis.__revSecurityExecuted=true}",
  "{{constructor.constructor('return 1')()}}",
  "'; globalThis.__revSecurityExecuted=true; //",
  "{\"$ne\":null}",
  "{\"$where\":\"return true\"}",
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "__proto__[__revSecurityExecuted]=true",
];
for (const [index, body] of inertStrings.entries()) {
  test(`STORAGE ONLY: Post body retains inert payload ${index}; NOT a browser XSS test`, async () => {
    const doc = new Post(validPost({ body }));
    await doc.validate();
    assert.equal(doc.body, body);
    assert.equal(globalThis.__revSecurityExecuted, undefined);
  });
  test(`STORAGE ONLY: Comment body retains inert payload ${index}; output escaping still required`, async () => {
    const doc = new Comment({ postId: anotherId, authorId: ownerId, body });
    await doc.validate();
    assert.equal(doc.body, body);
    assert.equal(globalThis.__revSecurityExecuted, undefined);
  });
}
for (const role of ["superadmin", "root", "administrator", "ADMIN", "", { $ne: null }, ["admin"], 1]) {
  test(`USER: rejects invalid role ${JSON.stringify(role)}`, () => rejectsField(User, validUser({ role }), "role"));
}
for (const status of ["disabled", "root", "ACTIVE", "", { $ne: null }, ["active"], 1]) {
  test(`USER: rejects invalid status ${JSON.stringify(status)}`, () => rejectsField(User, validUser({ status }), "status"));
}
for (const value of [-1, -100, "invalid", {}, { $inc: 1 }, NaN]) {
  test(`USER: rejects invalid sessionVersion ${JSON.stringify(value)}`, () => rejectsField(User, validUser({ sessionVersion: value }), "sessionVersion"));
}
for (const value of [0, 2, -2, 10, -10, "invalid", {}, { $ne: null }, NaN, undefined]) {
  test(`VOTE: rejects invalid vote ${JSON.stringify(value)}`, () => rejectsField(Vote, { postId: anotherId, userId: ownerId, value }, "value"));
}
test("VOTE: compound unique per-account per-post index declared", () => assert.ok(Vote.schema.indexes().some(([keys, options]) => keys.postId === 1 && keys.userId === 1 && options.unique)));
for (const rating of [null, 0, 11, NaN, { $gt: 1 }, undefined]) {
  test(`POST: review requires valid rating ${JSON.stringify(rating)}`, () => rejectsField(Post, validPost({ kind: "review", gameId: anotherId, rating }), "rating"));
}
test("POST: review requires a game", () => rejectsField(Post, validPost({ kind: "review", rating: 5 }), "gameId"));
for (const rating of [null, 0, 1, 5, 10]) {
  test(`POST: discussion rejects review rating ${JSON.stringify(rating)}`, () => rejectsField(Post, validPost({ rating }), "rating"));
}
for (const recommend of [true, false]) {
  test(`POST: discussion rejects recommendation ${recommend}`, () => rejectsField(Post, validPost({ recommend }), "recommend"));
}

let server;
let base;
let databaseCalls = 0;
before(async () => {
  server = createApp({ checkDatabase: async () => { databaseCalls++; }, clientOrigin: "http://localhost:5173" }).listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("HTTP: health JSON does not expose Express or set a login cookie", async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-powered-by"), null);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok", service: "rev-api" });
});

// Exact follow-up checklist payloads on the auth-disabled baseline. The global
// input guard rejects operators before routes; 404 is only an absent route.
const checklistLoginBodies = [
  { email: { $ne: null }, password: { $ne: null } },
  { email: { $gt: "" }, password: "password" },
  { email: { $regex: ".*" }, password: { $exists: true } },
];
for (const path of ["/api/login", "/api/auth/login"]) {
  for (const [index, body] of checklistLoginBodies.entries()) {
    test(`CHECKLIST ABSENT LOGIN: exact operator payload ${index} to ${path}`, async () => {
      const response = await fetch(`${base}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.deepEqual(await response.json(), { error: "Request body contains an unsupported field." });
    });
  }
}
for (const path of ["/api/register", "/api/auth/register"]) {
  test(`CHECKLIST ABSENT REGISTER: client role=admin at ${path}`, async () => {
    const response = await fetch(`${base}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "checklist-fixture", email: "checklist@example.invalid", password: "fixture-not-a-real-password", role: "admin" }),
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(await response.json(), { error: "Route not found." });
  });
}
for (const path of ["/api/forgot-password", "/api/auth/forgot-password"]) {
  test(`CHECKLIST ABSENT RECOVERY: known-email-shaped request at ${path} sends no reset`, async () => {
    const response = await fetch(`${base}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "checklist@example.invalid" }),
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Route not found." });
  });
}
for (const path of ["/api/reset-password", "/api/auth/reset-password"]) {
  test(`CHECKLIST ABSENT RESET: repeated identical token at ${path} is not an end-to-end replay test`, async () => {
    const body = JSON.stringify({ token: "a".repeat(64), password: "fixture-not-a-real-password" });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${base}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.deepEqual(await response.json(), { error: "Route not found." });
    }
  });
}
test("CHECKLIST LIMITATION: mass-assigning role=admin satisfies the current User schema", async () => {
  const untrustedRegistrationBody = { ...validUser(), role: "admin" };
  const user = new User(untrustedRegistrationBody);
  await user.validate();
  assert.equal(user.role, "admin");
  // Not saved, and no registration controller exists. This demonstrates why
  // controller field allowlists/server-owned roles are mandatory.
});
test("CHECKLIST LIMITATION: hashing a weak four-digit secret still passes hash-format validation", async () => {
  await new Reset(validReset({ tokenHash: digest("1234") })).validate();
  // Digest length says nothing about secret entropy. The production generator
  // must use crypto.randomBytes; this model cannot enforce the generator.
});

// Filename/ignore checks only: do not read secret file or Git blob contents.
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const envPathspecs = [".env", ".env.*", ":(glob)**/.env", ":(glob)**/.env.*"];
const realEnvNames = (output) => output.split(/\r?\n/).filter((name) => name && !name.endsWith(".example"));
test("CHECKLIST GIT: no real .env filenames are currently tracked", () => {
  const names = execFileSync("git", ["ls-files", "--cached", "--", ...envPathspecs], { cwd: repositoryRoot, encoding: "utf8" });
  assert.deepEqual(realEnvNames(names), [], "Tracked secret filenames found; do not print their contents.");
});
test("CHECKLIST GIT: no real .env filenames in reachable local history", () => {
  const names = execFileSync("git", ["log", "--all", "--format=", "--name-only", "--", ...envPathspecs], { cwd: repositoryRoot, encoding: "utf8" });
  assert.deepEqual(realEnvNames(names), [], "Historical secret filenames found: rotate exposed credentials and review history.");
});
for (const path of ["server/.env", "client/.env", "analytics/.env", "server/.env.production", "client/.env.local"]) {
  test(`CHECKLIST GIT: ignores secret filename ${path}`, () => {
    const result = spawnSync("git", ["check-ignore", "--quiet", "--no-index", path], { cwd: repositoryRoot, encoding: "utf8" });
    assert.equal(result.status, 0);
  });
}
test("CHECKLIST GIT: placeholder .env.example stays eligible for tracking", () => {
  const result = spawnSync("git", ["check-ignore", "--quiet", "--no-index", "server/.env.example"], { cwd: repositoryRoot, encoding: "utf8" });
  assert.equal(result.status, 1);
});

const absentPaths = ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/change-email", "/api/admin", "/api/dashboard", "/api/posts"];
for (const path of absentPaths) {
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
    test(`ABSENT ROUTE (not auth protection): ${method} ${path}`, async () => {
      const options = { method, headers: { "Content-Type": "application/json", "X-User-Role": "admin" } };
      if (!["GET", "HEAD"].includes(method)) options.body = JSON.stringify({ email: { $ne: null }, role: "admin", userId: anotherId.toString(), token: { $regex: ".*" } });
      const response = await fetch(`${base}${path}`, options);
      const unsafeBody = !["GET", "HEAD"].includes(method);
      assert.equal(response.status, unsafeBody ? 400 : 404);
      if (method !== "HEAD") assert.deepEqual(await response.json(), { error: unsafeBody ? "Request body contains an unsupported field." : "Route not found." });
    });
  }
}
const malformedBodies = ["{", "}", "{broken", "{\"x\":}", "{\"x\":undefined}", "{\"x\":NaN}", "{\"x\":1,}", "{\"x\":1 \"y\":2}", "[1,", "true", "null", '"scalar"'];
for (const [index, body] of malformedBodies.entries()) {
  test(`HTTP: malformed/non-object JSON case ${index} returns sanitized 400`, async () => {
    const response = await fetch(`${base}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid JSON request body." });
  });
}
for (const extraBytes of [1, 100, 1024]) {
  for (const path of ["/api/health", "/api/auth/reset-password"]) {
    test(`HTTP: JSON above 100 KiB by ${extraBytes} bytes at ${path} returns 413`, async () => {
      const body = JSON.stringify({ value: "x".repeat(100 * 1024 + extraBytes) });
      const response = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      assert.equal(response.status, 413);
      assert.deepEqual(await response.json(), { error: "Request body is too large." });
    });
  }
}
const origins = ["https://attacker.example", "http://localhost:5173.attacker.example", "https://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "null", "file://", "http://localhost", "http://localhost:5173/", "http://LOCALHOST:5173", "http://localhost:5173@attacker.example", "http://attacker.example:5173", "https://sub.attacker.example", "http://[::1]:5173", "http://localhost:80", "http://localhost:5173"];
for (const origin of origins) {
  test(`HTTP CORS: origin ${origin}`, async () => {
    const response = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), origin === "http://localhost:5173" ? origin : null);
  });
}
for (const [index, filter] of [...operators, { $or: [{ role: "admin" }, {}] }, { __proto__: { admin: true } }, { role: "admin" }].entries()) {
  test(`HTTP: health query payload ${index} cannot invoke a database operation`, async () => {
    const beforeCalls = databaseCalls;
    const response = await fetch(`${base}/api/health?filter=${encodeURIComponent(JSON.stringify(filter))}`);
    assert.equal(response.status, 200);
    assert.equal(databaseCalls, beforeCalls);
    assert.deepEqual(await response.json(), { status: "ok", service: "rev-api" });
  });
}
for (const [index, headers] of [
  { "X-User-Role": "admin" }, { "X-Admin": "true" },
  { "X-Forwarded-For": "127.0.0.1", "X-User-Id": ownerId.toString() },
  { Cookie: "role=admin; userId=fixture; connect.sid=forged" },
  { Authorization: "Bearer forged-fixture" }, { From: "admin@example.invalid" },
  { "X-Forwarded-Host": "attacker.example", "X-Forwarded-Proto": "https" },
  { "X-Original-URL": "/api/admin", "X-Rewrite-URL": "/api/admin" },
].entries()) {
  test(`HTTP: spoofed identity header fixture ${index} cannot create an admin route`, async () => {
    const response = await fetch(`${base}/api/admin`, { headers });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Route not found." });
  });
}
test("HTTP: database error response redacts internal diagnostics", async () => {
  const failing = createApp({ checkDatabase: async () => { throw new Error("private-diagnostic-security-fixture"); } }).listen(0, "127.0.0.1");
  await once(failing, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${failing.address().port}/api/health/database`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "error", database: "unavailable" });
  } finally {
    failing.closeAllConnections();
    await new Promise((resolve) => failing.close(resolve));
  }
});

// These remaining product/deployment features are outside the model baseline.
// Auth/service integration now has separate executable test files.
for (const feature of [
  "author-only post mutations (post routes not implemented)",
  "real email delivery, mailbox ownership, and future email-change confirmation",
  "browser output escaping, CSP, and rendered XSS behavior",
]) {
  test(`PENDING PRODUCT FEATURE: ${feature}`, { skip: "Requires the corresponding product UI/routes or an email provider." }, () => {});
}

test("ATLAS: isolated database adversarial checks", {
  skip: process.env.REV_SECURITY_ATLAS !== "1" ? "Opt in explicitly with REV_SECURITY_ATLAS=1." : false,
  timeout: 90000,
}, async (t) => {
  // Do not connect the default mongoose singleton: doing so could auto-create
  // collections/indexes for real registered models. Use a separate connection.
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: envPath, quiet: true });
  const { getDatabaseConfig } = await import("../config/env.js");
  const { uri, dbName } = getDatabaseConfig();
  const prefix = `_rev_security_${randomBytes(12).toString("hex")}`;
  const names = ["tokens", "users", "posts"].map((suffix) => `${prefix}_${suffix}`);
  let connection;
  const created = new Set();
  try {
    connection = await mongoose.createConnection(uri, {
      dbName, autoCreate: false, autoIndex: false,
      serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000,
      socketTimeoutMS: 10000, maxPoolSize: 3,
    }).asPromise();
    const Tokens = connection.model(`${prefix}_Token`, Reset.schema.clone(), names[0]);
    const Users = connection.model(`${prefix}_User`, User.schema.clone(), names[1]);
    const Posts = connection.model(`${prefix}_Post`, Post.schema.clone(), names[2]);
    for (const Model of [Tokens, Users, Posts]) {
      await Model.createCollection();
      created.add(Model.collection.name);
      await Model.createIndexes();
    }
    t.diagnostic(`Created exactly ${created.size} temporary collections under ${prefix}.`);
    const account = await Users.create(validUser());
    const fixture = await Tokens.create(validReset({ userId: account._id }));
    const indexes = await Tokens.collection.indexes();
    await t.test("real database unique token index exists", () => assert.ok(indexes.some((index) => index.key.tokenHash === 1 && index.unique)));
    await t.test("real database TTL index exists", () => assert.ok(indexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0)));
    await t.test("real database user lookup index exists", () => assert.ok(indexes.some((index) => index.key.userId === 1)));
    await t.test("saved reset record receives createdAt", () => assert.ok(fixture.createdAt instanceof Date));
    await t.test("saved reset record has no updatedAt", () => assert.equal(fixture.updatedAt, undefined));
    await t.test("ordinary token query omits hash", async () => assert.equal((await Tokens.findById(fixture._id)).tokenHash, undefined));
    await t.test("explicit token projection can include hash (trusted code only)", async () => assert.equal((await Tokens.findById(fixture._id).select("+tokenHash")).tokenHash, validHash));
    await t.test("ordinary user query omits password hash", async () => assert.equal((await Users.findById(account._id)).passwordHash, undefined));
    await t.test("database rejects duplicate reset hash", async () => assert.rejects(Tokens.create(validReset({ userId: account._id })), (error) => error.code === 11000));
    await t.test("LIMITATION: unique hash does not enforce one outstanding token per user", async () => {
      const second = await Tokens.create(validReset({ userId: account._id, tokenHash: digest("second-fixture") }));
      assert.equal(await Tokens.countDocuments({ userId: account._id }), 2);
      await Tokens.deleteOne({ _id: second._id });
    });

    for (const [index, operator] of operators.slice(0, 9).entries()) {
      await t.test(`INJECTION DEMO: raw token query operator ${index} can match a fixture`, async () => {
        const result = await Tokens.findOne({ tokenHash: structuredClone(operator) }).maxTimeMS(2000);
        assert.ok(result, "Unsafe client-controlled query was expected to match fixture");
      });
      await t.test(`DEFENSE DEMO: explicit nested filter sanitation rejects operator ${index}`, async () => {
        const filter = mongoose.sanitizeFilter({ tokenHash: structuredClone(operator) });
        await assert.rejects(Tokens.findOne(filter).maxTimeMS(2000).exec(), { name: "CastError" });
      });
    }
    for (const [index, body] of inertStrings.entries()) {
      await t.test(`inert JavaScript/SQL string ${index} stays data in MongoDB`, async () => {
        const saved = await Posts.create(validPost({ authorId: account._id, body }));
        assert.equal((await Posts.findById(saved._id)).body, body);
        assert.equal(globalThis.__revSecurityExecuted, undefined);
      });
    }
    const expired = await Tokens.create(validReset({ userId: account._id, tokenHash: digest("expired-fixture"), expiresAt: new Date(Date.now() - 60000) }));
    const used = await Tokens.create(validReset({ userId: account._id, tokenHash: digest("used-fixture"), usedAt: new Date() }));
    // These filters demonstrate the future contract; there is no reset controller.
    await t.test("CONTRACT DEMO: explicit expiration filter excludes expired token", async () => assert.equal(await Tokens.findOne({ _id: expired._id, usedAt: null, expiresAt: { $gt: new Date() } }), null));
    await t.test("CONTRACT DEMO: explicit unused filter excludes consumed token", async () => assert.equal(await Tokens.findOne({ _id: used._id, usedAt: null, expiresAt: { $gt: new Date() } }), null));
    await t.test("CONTRACT DEMO: explicit user binding excludes another account", async () => assert.equal(await Tokens.findOne({ _id: fixture._id, userId: anotherId, usedAt: null, expiresAt: { $gt: new Date() } }), null));
    await t.test("CONTRACT DEMO: wrong literal hash matches no token", async () => assert.equal(await Tokens.findOne({ tokenHash: digest("wrong-fixture") }), null));
    await t.test("CONTRACT DEMO: operator text supplied as scalar cannot bypass hash equality", async () => assert.equal(await Tokens.findOne({ tokenHash: JSON.stringify({ $ne: null }) }), null));
    await t.test("CONTRACT DEMO: atomic consume permits exactly one of ten concurrent attempts", async () => {
      const attempts = await Promise.all(Array.from({ length: 10 }, () => Tokens.findOneAndUpdate({ _id: fixture._id, tokenHash: validHash, userId: account._id, usedAt: null, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }, { returnDocument: "after", runValidators: true })));
      assert.equal(attempts.filter(Boolean).length, 1);
    });
    await t.test("CONTRACT DEMO: atomic consume rejects replay", async () => assert.equal(await Tokens.findOneAndUpdate({ _id: fixture._id, usedAt: null, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }), null));
    await t.test("CONTRACT DEMO: password/session-version changes roll back together on aborted transaction", async () => {
      const session = await connection.startSession();
      try {
        await assert.rejects(session.withTransaction(async () => {
          await Users.updateOne({ _id: account._id }, { $set: { passwordHash: "replacement-fixture" }, $inc: { sessionVersion: 1 } }, { session });
          await Tokens.updateOne({ _id: used._id }, { $set: { usedAt: null } }, { session });
          throw new Error("intentional-security-test-rollback");
        }), { message: "intentional-security-test-rollback" });
        const unchanged = await Users.findById(account._id).select("+passwordHash");
        assert.equal(unchanged.passwordHash, validUser().passwordHash);
        assert.equal(unchanged.sessionVersion, 0);
        assert.ok((await Tokens.findById(used._id)).usedAt instanceof Date);
      } finally {
        await session.endSession();
      }
    });
    await t.test("BOUNDARY: inspect connection roles without outputting identities or changing privileges", async () => {
      try {
        const status = await connection.db.admin().command({ connectionStatus: 1, showPrivileges: true });
        const info = status.authInfo || {};
        const privileges = info.authenticatedUserPrivileges || [];
        const elevated = (info.authenticatedUserRoles || []).some(({ role }) => /atlasAdmin|root|userAdmin|dbOwner|clusterAdmin/.test(role)) || privileges.some(({ actions = [] }) => actions.some((action) => ["anyAction", "createUser", "dropUser", "changePassword", "grantRole", "revokeRole"].includes(action)));
        assert.ok(Array.isArray(info.authenticatedUserRoles));
        t.diagnostic(elevated ? "WARNING: application connection has elevated administrative/user-management privileges. Reduce to application readWrite access." : "No elevated role identified by connectionStatus; Atlas console/network/MFA/backups still require a separate configuration review.");
      } catch (error) {
        if (error.code === 13 || error.code === 8000 || error.codeName === "Unauthorized") {
          t.diagnostic("Role introspection unavailable to this database user; no privileges changed. Verify least privilege in Atlas manually.");
          return;
        }
        throw new Error(`Role introspection failed (${error.name || "Error"}, code ${Number(error.code) || 0}); raw details suppressed.`);
      }
    });
  } catch (error) {
    // Never leak a driver message/stack containing a host, URI, or password.
    throw new Error(`Isolated Atlas checks failed (${error.name || "Error"}, code ${Number(error.code) || 0}); raw connection details suppressed.`);
  } finally {
    const cleanupFailures = [];
    if (connection?.readyState === 1) {
      for (const name of created) {
        // Exact generated names only; never drop a real collection or database.
        assert.ok(names.includes(name) && name.startsWith(`${prefix}_`));
        try {
          await connection.db.collection(name).drop();
          t.diagnostic(`Removed temporary collection ${name}.`);
        } catch (error) {
          if (error.code !== 26) cleanupFailures.push(name);
        }
      }
      await connection.close();
    }
    if (cleanupFailures.length) throw new Error(`Temporary collection cleanup needs attention: ${cleanupFailures.join(", ")}`);
  }
});
