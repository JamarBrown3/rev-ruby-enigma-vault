// REV-SEC-24/25/26: regressions for the three requested auth boundaries.
// Offline by default. Atlas opt-in touches ONE random temporary counter collection.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import session from "express-session";
import User from "../models/User.js";
import { createAuth } from "../security/auth.js";
import { createAuthService } from "../services/authService.js";
import { createAccountLoginLimiter } from "../security/accountLoginLimit.js";
import { hashNewPassword } from "../security/passwords.js";
import * as totp from "../security/totp.js";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const originalRead = fs.readFileSync;
fs.readFileSync = function (file, options) {
  if ((file instanceof URL ? fileURLToPath(file) : String(file)) === envPath) {
    return options ? "" : Buffer.alloc(0);
  }
  return originalRead.apply(this, arguments);
};
let createApp;
try { ({ createApp } = await import("../app.js")); }
finally { fs.readFileSync = originalRead; }

const signingKey = "isolated-test-signing-key-never-use-in-production-0123456789";
const password = "long isolated regression password";

// Test double for the native collection interface. No production memory fallback.
function counterCollection() {
  const records = new Map();
  return {
    records,
    async createIndex() {},
    async findOneAndUpdate(filter, update) {
      const old = records.get(filter._id);
      const record = old || { _id: filter._id, ...update.$setOnInsert, count: 0 };
      record.count += update.$inc.count;
      records.set(filter._id, record);
      return { ...record };
    },
  };
}

test("REV-SEC-24: concurrent requests and fresh workers share one atomic account budget", async () => {
  const collection = counterCollection();
  const options = { collection, secret: signingKey, limit: 5 };
  const workers = [createAccountLoginLimiter(options), createAccountLoginLimiter(options)];
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => workers[i % 2].consume("fixture@example.invalid")));
  assert.equal(results.filter(result => result.allowed).length, 5);
  assert.equal((await createAccountLoginLimiter(options).consume("fixture@example.invalid")).allowed, false);
  assert.equal((await workers[0].consume("another@example.invalid")).allowed, true);
  assert.ok([...collection.records.keys()].every(key => !key.includes("@")));
});

test("REV-SEC-24: expiration cleanup is not needed to open the next fixed window", async () => {
  let clock = 100000;
  const collection = counterCollection();
  const limiter = createAccountLoginLimiter({ collection, secret: signingKey, limit: 1, windowMs: 1000, now: () => clock });
  assert.equal((await limiter.consume("fixture@example.invalid")).allowed, true);
  const blocked = await limiter.consume("fixture@example.invalid");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 1);
  clock += 1000;
  assert.equal((await limiter.consume("fixture@example.invalid")).allowed, true);
  assert.equal(collection.records.size, 2, "old bucket deliberately not TTL-deleted");
});

test("REV-SEC-24: missing or failed counter storage fails closed", async () => {
  for (const collection of [undefined, { async createIndex() { throw new Error("fixture failure"); } }, {
    async createIndex() {}, async findOneAndUpdate() { throw new Error("fixture failure"); },
  }]) {
    await assert.rejects(createAccountLoginLimiter({ collection, secret: signingKey }).consume("fixture@example.invalid"), { status: 503 });
  }
});

async function fixture(run, { limit = 20, collection = counterCollection() } = {}) {
  const users = new Map();
  const mfaKey = randomBytes(32);
  const repository = {
    async create(data) {
      const user = new User(data);
      await user.validate();
      users.set(String(user._id), user);
      return user;
    },
    findOne(filter) {
      const user = [...users.values()].find(user => user.email === filter.email) || null;
      return { select: async () => user };
    },
    async findById(id) { return users.get(String(id)) || null; },
    exists(filter) {
      const user = [...users.values()].find(user => user.username.toLowerCase() === filter.username.toLowerCase());
      return { collation: async () => user ? { _id: user._id } : null };
    },
    async updateOne(filter, update) {
      const user = users.get(String(filter._id));
      if (!user || (filter.passwordHash && filter.passwordHash !== user.passwordHash)) return { matchedCount: 0 };
      if (filter.$or) {
        const step = update.$set["mfa.lastUsedStep"];
        if (user.mfa.lastUsedStep >= step) return { matchedCount: 0 };
        user.mfa.lastUsedStep = step;
      } else {
        Object.assign(user, update.$set);
      }
      return { matchedCount: 1 };
    },
  };
  const service = createAuthService({ UserModel: repository, connection: {}, mfaKey });
  const store = new session.MemoryStore();
  const auth = createAuth({ service, store, secret: signingKey, production: false,
    rateLimitMax: 1000, accountLoginLimit: limit, loginAccountCollection: collection });
  const hits = [];
  const app = createApp({ auth, trustProxy: 1, globalRateLimitMax: 1000,
    checkDatabase: async () => true,
    mountRoutes: app => {
      app.get("/api/admin/test", (req, res) => res.json({ ok: true }));
      // Deliberately omit per-route CSRF middleware: the app must supply it.
      app.all("/api/new-posts", (req, res) => {
        hits.push(req.method);
        res.json({ ok: true });
      });
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  function browser() {
    let cookie = "";
    let csrfToken = "";
    return async (path, { method = "GET", body, token, headers = {} } = {}) => {
      const selectedToken = token === undefined ? csrfToken : token;
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { ...(cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(selectedToken ? { "X-CSRF-Token": selectedToken } : {}), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      let data;
      try { data = await response.json(); } catch { data = null; }
      if (data?.csrfToken) csrfToken = data.csrfToken;
      return { status: response.status, headers: response.headers, data };
    };
  }
  async function seed({ role = "user", mfa = false } = {}) {
    const id = new mongoose.Types.ObjectId();
    const secret = totp.generateTotpSecret();
    const user = await repository.create({ _id: id, username: "fixture", email: "fixture@example.invalid",
      passwordHash: await hashNewPassword(password), role, status: "active", sessionVersion: 0,
      ...(mfa ? { mfa: { secretEnc: totp.encryptTotpSecret(secret, mfaKey, String(id)), enabledAt: new Date(), lastUsedStep: -1 } } : {}),
    });
    return { user, code: () => totp.hotp(secret, totp.totpStep()) };
  }
  try { await run({ browser, seed, service, auth, hits, store }); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test("REV-SEC-24: changing IP and email capitalization cannot bypass the login budget", async () => fixture(async ({ browser, seed }) => {
  await seed();
  const request = browser();
  await request("/api/auth/csrf");
  for (let i = 0; i < 3; i += 1) {
    const email = i % 2 ? " FIXTURE@EXAMPLE.INVALID " : "fixture@example.invalid";
    const result = await request("/api/auth/login", { method: "POST", body: { email, password: "wrong" }, headers: { "X-Forwarded-For": `192.0.2.${i + 1}` } });
    assert.equal(result.status, 401);
  }
  const blocked = await request("/api/auth/login", { method: "POST", body: { email: "fixture@example.invalid", password }, headers: { "X-Forwarded-For": "198.51.100.20" } });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: "unknown@example.invalid", password: "wrong" } })).status, 401);
}, { limit: 3 }));

test("REV-SEC-24: unavailable counter storage blocks login before credentials are checked", async () => fixture(async ({ browser, service }) => {
  let checked = false;
  service.authenticate = async () => { checked = true; throw new Error("must not run"); };
  const request = browser();
  await request("/api/auth/csrf");
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: "fixture@example.invalid", password } })).status, 503);
  assert.equal(checked, false);
}, { collection: { async createIndex() { throw new Error("fixture outage"); } } }));

test("REV-SEC-25: a stored role change cannot upgrade a member session or skip admin MFA", async () => fixture(async ({ browser, seed }) => {
  const { user } = await seed();
  const request = browser();
  await request("/api/auth/csrf");
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: user.email, password } })).status, 200);
  user.role = "admin";
  assert.equal((await request("/api/admin/test")).status, 403);
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: user.email, password } })).status, 401);
}));

test("REV-SEC-25: admin access requires a real MFA check and the same enrollment", async () => fixture(async ({ browser, seed }) => {
  const { user, code } = await seed({ role: "admin", mfa: true });
  const request = browser();
  await request("/api/auth/csrf");
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: user.email, password } })).status, 401);
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: user.email, password, mfaVerified: true } })).status, 400);
  assert.equal((await request("/api/auth/login", { method: "POST", body: { email: user.email, password, code: code() } })).status, 200);
  assert.equal((await request("/api/admin/test")).status, 200);
  const enabledAt = user.mfa.enabledAt;
  user.mfa.enabledAt = new Date(enabledAt.getTime() + 1);
  assert.equal((await request("/api/admin/test")).status, 403);
  user.mfa.enabledAt = enabledAt;
  user.status = "banned";
  assert.equal((await request("/api/admin/test")).status, 401);
}));

test("REV-SEC-25: a session without MFA assurance fails closed even for an enrolled admin", async () => fixture(async ({ browser, seed, store }) => {
  const { user, code } = await seed({ role: "admin", mfa: true });
  const request = browser();
  await request("/api/auth/csrf");
  await request("/api/auth/login", { method: "POST", body: { email: user.email, password, code: code() } });
  const sessions = await new Promise((resolve, reject) => store.all((error, values) => error ? reject(error) : resolve(values)));
  const [id, saved] = Object.entries(sessions).find(([, value]) => value.auth);
  delete saved.auth.mfaVerified;
  await new Promise((resolve, reject) => store.set(id, saved, error => error ? reject(error) : resolve()));
  assert.equal((await request("/api/admin/test")).status, 403);
}));

test("REV-SEC-26: new POST/PUT/PATCH/DELETE routes reject missing, wrong, or cross-session tokens", async () => fixture(async ({ browser, hits }) => {
  const request = browser();
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal((await request("/api/new-posts", { method, body: {} })).status, 403);
  }
  assert.equal(hits.length, 0);
  const bootstrap = await request("/api/auth/csrf");
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal((await request("/api/new-posts", { method, body: {} })).status, 200);
  }
  assert.equal((await request("/API/NEW-POSTS", { method: "POST", body: {}, token: "a".repeat(64) })).status, 403);
  assert.equal((await request("/api/new-posts", { method: "POST", body: {}, headers: { Origin: "https://attacker.example" } })).status, 403);
  const other = browser();
  await other("/api/auth/csrf");
  assert.equal((await other("/api/new-posts", { method: "POST", body: {}, token: bootstrap.data.csrfToken })).status, 403);
  assert.equal(hits.length, 4);
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.ok([200, 204].includes((await request("/api/new-posts", { method, token: false })).status));
  }
}));

test("REV-SEC-26: logging in rotates CSRF proof for future API routes too", async () => fixture(async ({ browser, seed }) => {
  const { user } = await seed();
  const request = browser();
  const before = await request("/api/auth/csrf");
  const login = await request("/api/auth/login", { method: "POST", body: { email: user.email, password } });
  assert.equal(login.status, 200);
  assert.notEqual(before.data.csrfToken, login.data.csrfToken);
  assert.equal((await request("/api/new-posts", { method: "POST", body: {}, token: before.data.csrfToken })).status, 403);
  assert.equal((await request("/api/new-posts", { method: "POST", body: {} })).status, 200);
}));

test("REV-SEC-24 ATLAS: atomic counters persist across workers and have a TTL index", {
  skip: process.env.REV_SECURITY_ATLAS !== "1" ? "Explicit Atlas opt-in required." : false,
  timeout: 90000,
}, async () => {
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: envPath, quiet: true });
  const { getDatabaseConfig } = await import("../config/env.js");
  const { uri, dbName } = getDatabaseConfig();
  const name = `_rev_auth_${randomBytes(12).toString("hex")}_login_limits`;
  let connection;
  let created = false;
  try {
    connection = await mongoose.createConnection(uri, { dbName, autoCreate: false, autoIndex: false,
      maxPoolSize: 4, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, socketTimeoutMS: 10000 }).asPromise();
    await connection.db.createCollection(name);
    created = true;
    const collection = connection.db.collection(name);
    const clock = Date.now();
    const options = { collection, secret: signingKey, limit: 5, now: () => clock };
    const workers = [createAccountLoginLimiter(options), createAccountLoginLimiter(options)];
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) => workers[i % 2].consume("fixture@example.invalid")));
    assert.equal(results.filter(result => result.allowed).length, 5);
    assert.equal((await createAccountLoginLimiter(options).consume("fixture@example.invalid")).allowed, false);
    assert.ok((await collection.indexes()).some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
  } catch (error) {
    if (error.name === "AssertionError") throw error;
    throw new Error(`Isolated login-counter check failed (${error.name}, code ${Number(error.code) || 0}); raw connection details suppressed.`);
  } finally {
    if (created && connection?.readyState === 1) {
      assert.ok(/^_rev_auth_[a-f0-9]{24}_login_limits$/.test(name));
      await connection.db.collection(name).drop();
      console.log("Removed isolated login-counter collection.");
    }
    if (connection) await connection.close();
  }
});
