import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import session from "express-session";
import User from "../models/User.js";
import { createAuth } from "../security/auth.js";
import { createAuthService } from "../services/authService.js";
import { hashPassword, verifyPassword } from "../security/passwords.js";
import { parseLogin, parseRegistration, parseReset, assertSafeObject } from "../security/input.js";
import { assertApplicationRoles } from "../security/databaseAccess.js";

// No .env read or live MongoDB connection for this test file.
const originalRead = fs.readFileSync;
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
fs.readFileSync = function (file, options) {
  if ((file instanceof URL ? fileURLToPath(file) : String(file)) === envPath) return options ? "" : Buffer.alloc(0);
  return originalRead.apply(this, arguments);
};
let createApp;
try { ({ createApp } = await import("../app.js")); }
finally { fs.readFileSync = originalRead; }

const password = "a long test password with spaces";
const secret = "test-only-signing-secret-never-use-this-in-production-0123456789";

async function fixture(run, { max = 100 } = {}) {
  const users = new Map();
  let reads = 0;
  const repository = {
    async create(data) {
      const user = new User(data);
      await user.validate();
      if ([...users.values()].some((old) => old.email === user.email || old.username === user.username)) throw Object.assign(new Error("duplicate fixture"), { code: 11000 });
      users.set(user._id.toString(), user);
      return user;
    },
    findOne(filter) {
      reads++;
      assert.equal(typeof filter.email, "string", "An operator object must never reach the repository.");
      const user = [...users.values()].find((value) => value.email === filter.email) || null;
      return { select: async () => user };
    },
    async findById(id) { reads++; return users.get(id) || null; },
  };
  const service = createAuthService({ UserModel: repository, connection: { startSession() { throw new Error("Unexpected database access in offline test."); } } });
  const auth = createAuth({ service, store: new session.MemoryStore(), secret, production: false, rateLimitMax: max });
  const server = createApp({ auth, checkDatabase: async () => true }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  let csrfToken = "";
  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const data = await response.json();
    if (data.csrfToken) csrfToken = data.csrfToken;
    return { response, data, cookie, csrfToken, setCookie };
  }
  try { await run({ request, users, service, auth, reads: () => reads, base }); }
  finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
}

for (const value of [{ $ne: null }, { $gt: "" }, { $regex: ".*" }, ["someone@example.invalid"], null, 123, true, undefined]) {
  test(`AUTH INPUT: rejects non-string login email ${JSON.stringify(value)}`, () => assert.throws(() => parseLogin({ email: value, password }), { status: 400 }));
  test(`AUTH INPUT: rejects non-string login password ${JSON.stringify(value)}`, () => assert.throws(() => parseLogin({ email: "fixture@example.invalid", password: value }), { status: 400 }));
}
for (const field of ["role", "status", "sessionVersion", "passwordHash", "_id", "isAdmin"]) {
  test(`REGISTRATION: rejects client-controlled ${field}`, () => assert.throws(() => parseRegistration({ username: "fixture", email: "fixture@example.invalid", password, [field]: "admin" }), { status: 400 }));
}
for (const value of ["1234", "a".repeat(63), "a".repeat(65), "A".repeat(64), { $ne: null }, ["a".repeat(64)], undefined]) {
  test(`RESET INPUT: rejects invalid raw token ${JSON.stringify(value)}`, () => assert.throws(() => parseReset({ token: value, newPassword: password }), { status: 400 }));
}
for (const key of ["$ne", "$where", "$function", "user.role", "__proto__", "constructor", "prototype"]) {
  test(`JSON GUARD: rejects nested dangerous key ${key}`, () => assert.throws(() => assertSafeObject(JSON.parse(`{"profile":{"${key}":true}}`)), { status: 400 }));
}
test("PASSWORD: short passwords cannot be registered", () => assert.throws(() => parseRegistration({ username: "fixture", email: "fixture@example.invalid", password: "short" }), { status: 400 }));
test("PASSWORD: spaces are preserved, not silently trimmed", () => assert.equal(parseRegistration({ username: " fixture ", email: " FIXTURE@EXAMPLE.INVALID ", password: ` ${password} ` }).password, ` ${password} `));
test("PASSWORD: hashing uses a salted password KDF, verifies correctly, and rejects mismatches", async () => {
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.match(first, /^\$scrypt\$131072\$8\$1\$/);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
  assert.equal(await verifyPassword(password, undefined), false);
});

test("HTTP AUTH: injection/role attempts cannot reach user persistence", async () => fixture(async ({ request, users, reads }) => {
  await request("/api/auth/csrf");
  for (const body of [
    { email: { $ne: null }, password: { $ne: null } },
    { email: { $gt: "" }, password: "password" },
    { email: ["fixture@example.invalid"], password },
    { email: "fixture@example.invalid", password: [password] },
  ]) {
    assert.equal((await request("/api/auth/login", { method: "POST", body })).response.status, 400);
  }
  assert.equal((await request("/api/auth/register", { method: "POST", body: { username: "fixture", email: "fixture@example.invalid", password, role: "admin" } })).response.status, 400);
  assert.equal(reads(), 0);
  assert.equal(users.size, 0);
}));

test("HTTP AUTH: register, login rotation, public response, dashboard denial, session revocation", async () => fixture(async ({ request, users }) => {
  assert.equal((await request("/api/auth/me")).response.status, 401);
  assert.equal((await request("/api/admin")).response.status, 401);
  const initial = await request("/api/auth/csrf");
  assert.match(initial.setCookie, /HttpOnly/i);
  assert.match(initial.setCookie, /SameSite=Strict/i);
  assert.doesNotMatch(initial.setCookie, /; Secure/i); // HTTP development only.
  const anonymousCookie = initial.cookie;
  const body = { username: "fixture", email: "fixture@example.invalid", password };
  const registration = await request("/api/auth/register", { method: "POST", body });
  assert.equal(registration.response.status, 202);
  assert.equal(users.size, 1);
  const user = [...users.values()][0];
  assert.equal(user.role, "user");
  assert.notEqual(user.passwordHash, password);
  assert.equal(user.toJSON().passwordHash, undefined);
  assert.equal(user.toJSON().sessionVersion, undefined);
  const duplicate = await request("/api/auth/register", { method: "POST", body });
  assert.equal(duplicate.response.status, 202);
  assert.deepEqual(duplicate.data, registration.data);
  assert.equal(users.size, 1);
  const wrong = await request("/api/auth/login", { method: "POST", body: { email: body.email, password: "wrong password" } });
  const nonexistent = await request("/api/auth/login", { method: "POST", body: { email: "missing@example.invalid", password: "wrong password" } });
  assert.equal(wrong.response.status, 401);
  assert.deepEqual(wrong.data, nonexistent.data);
  const login = await request("/api/auth/login", { method: "POST", body: { email: body.email, password } });
  assert.equal(login.response.status, 200);
  assert.notEqual(login.cookie, anonymousCookie);
  assert.notEqual(login.csrfToken, initial.csrfToken);
  assert.deepEqual(Object.keys(login.data.user).sort(), ["id", "role", "username"]);
  assert.equal((await request("/api/auth/me")).response.status, 200);
  assert.equal((await request("/api/dashboard")).response.status, 403);
  assert.equal((await request("/api/admin", { headers: { "X-User-Role": "admin" } })).response.status, 403);
  user.sessionVersion++;
  assert.equal((await request("/api/auth/me")).response.status, 401);
}));

test("HTTP AUTH: missing/stale CSRF and foreign origins are rejected", async () => fixture(async ({ request, users }) => {
  const body = { username: "fixture", email: "fixture@example.invalid", password };
  assert.equal((await request("/api/auth/register", { method: "POST", body })).response.status, 403);
  await request("/api/auth/csrf");
  assert.equal((await request("/api/auth/register", { method: "POST", body, headers: { "X-CSRF-Token": "a".repeat(64) } })).response.status, 403);
  assert.equal((await request("/api/auth/register", { method: "POST", body, headers: { Origin: "https://attacker.example" } })).response.status, 403);
  assert.equal(users.size, 0);
}));

test("HTTP AUTH: disabled recovery fails closed and never returns tokens", async () => fixture(async ({ request }) => {
  await request("/api/auth/csrf");
  for (const email of ["owner@example.invalid", "missing@example.invalid"]) {
    const result = await request("/api/auth/forgot-password", { method: "POST", body: { email } });
    assert.equal(result.response.status, 503);
    assert.deepEqual(result.data, { error: "Password recovery is not configured yet." });
  }
  const result = await request("/api/auth/reset-password", { method: "POST", body: { token: "a".repeat(64), newPassword: password } });
  assert.equal(result.response.status, 503);
  assert.equal(result.data.token, undefined);
}));

test("HTTP AUTH: repeated login attempts are rate limited", async () => fixture(async ({ request }) => {
  await request("/api/auth/csrf");
  const options = { method: "POST", body: { email: ["fixture@example.invalid"], password } };
  assert.equal((await request("/api/auth/login", options)).response.status, 400);
  assert.equal((await request("/api/auth/login", options)).response.status, 400);
  const last = await request("/api/auth/login", options);
  assert.equal(last.response.status, 429);
  assert.ok(last.response.headers.get("retry-after"));
}, { max: 2 }));

test("PRODUCTION CONFIG: missing/weak secret and insecure origins fail closed", () => {
  const store = new session.MemoryStore();
  assert.throws(() => createAuth({ store, production: true, secret: "short", clientOrigin: "https://rev.example" }));
  assert.throws(() => createAuth({ store, production: true, secret, clientOrigin: "http://rev.example" }));
  assert.throws(() => createAuth({ store, production: false, secret, sameSite: "none" }));
  const auth = createAuth({ store, production: true, secret, clientOrigin: "https://rev.example" });
  assert.equal(auth.cookieOptions.name, "__Host-rev.sid");
  assert.equal(auth.cookieOptions.secure, true);
  assert.equal(auth.cookieOptions.httpOnly, true);
  assert.equal(auth.cookieOptions.sameSite, "strict");
  assert.equal(auth.cookieOptions.path, "/");
  assert.equal(auth.cookieOptions.domain, undefined);
});

for (const roles of [
  [], [{ role: "atlasAdmin", db: "admin" }], [{ role: "root", db: "admin" }],
  [{ role: "readWriteAnyDatabase", db: "admin" }], [{ role: "readWrite", db: "another-database" }],
  [{ role: "readWrite", db: "rev" }, { role: "atlasAdmin", db: "admin" }],
]) {
  test(`DATABASE PRIVILEGES: application refuses ${JSON.stringify(roles)}`, () => assert.throws(() => assertApplicationRoles({ authenticatedUserRoles: roles }, "rev"), { code: "EXCESS_DATABASE_PRIVILEGES" }));
}
test("DATABASE PRIVILEGES: accepts readWrite only on the configured database", () => assert.doesNotThrow(() => assertApplicationRoles({ authenticatedUserRoles: [{ role: "readWrite", db: "rev" }] }, "rev")));

for (const trustProxy of [false, 1]) {
  test(`PRODUCTION COOKIE: secure cookie requires real/trusted HTTPS (proxy trust ${trustProxy})`, async () => {
    const auth = createAuth({ store: new session.MemoryStore(), secret, production: true, clientOrigin: "https://rev.example" });
    const server = createApp({ auth, trustProxy, clientOrigin: "https://rev.example", checkDatabase: async () => true }).listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/csrf`, { headers: { "X-Forwarded-Proto": "https" } });
      assert.equal(response.status, 200);
      const cookie = response.headers.get("set-cookie");
      if (!trustProxy) assert.equal(cookie, null);
      else {
        assert.match(cookie, /^__Host-rev\.sid=/);
        assert.match(cookie, /; Secure/i);
        assert.match(cookie, /; HttpOnly/i);
        assert.match(cookie, /SameSite=Strict/i);
        assert.doesNotMatch(cookie, /Domain=/i);
      }
    } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  });
}
