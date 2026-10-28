import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import User from "../models/User.js";
import Reset from "../models/PasswordResetToken.js";
import { createAuthService, tokenDigest } from "../services/authService.js";
import { createAuth } from "../security/auth.js";
import { assertApplicationRoles } from "../security/databaseAccess.js";

// REV-SEC-10 (2026-10-26): reset links now carry the token after "#", where
// browsers never send it to any server. Read it from the fragment.
const tokenFrom = (resetUrl) => new URLSearchParams(new URL(resetUrl).hash.slice(1)).get("token");

test("ATLAS AUTH: real controllers, session persistence, reset transaction and revocation", {
  skip: process.env.REV_SECURITY_ATLAS !== "1" ? "Explicit Atlas opt-in required." : false,
  timeout: 90000,
}, async (t) => {
  const { getDatabaseConfig } = await import("../config/env.js");
  const { createApp } = await import("../app.js");
  const { uri, dbName } = getDatabaseConfig();
  const prefix = `_rev_auth_${randomBytes(12).toString("hex")}`;
  const names = [`${prefix}_users`, `${prefix}_tokens`, `${prefix}_sessions`, `${prefix}_login_limits`];
  let connection;
  let server;
  const created = new Set();
  try {
    connection = await mongoose.createConnection(uri, { dbName, autoCreate: false, autoIndex: false, maxPoolSize: 3, serverSelectionTimeoutMS: 10000, socketTimeoutMS: 10000 }).asPromise();
    const status = await connection.db.admin().command({ connectionStatus: 1 });
    await t.test("application uses only database-scoped readWrite", () => assertApplicationRoles(status.authInfo, dbName));
    const Users = connection.model(`${prefix}_User`, User.schema.clone(), names[0]);
    const Tokens = connection.model(`${prefix}_Reset`, Reset.schema.clone(), names[1]);
    for (const Model of [Users, Tokens]) {
      await Model.createCollection(); created.add(Model.collection.name); await Model.createIndexes();
    }
    await connection.db.createCollection(names[2]); created.add(names[2]);
    await connection.db.createCollection(names[3]); created.add(names[3]);
    const store = MongoStore.create({ client: connection.getClient(), dbName, collectionName: names[2], ttl: 1800 });
    const deliveries = [];
    let onDelivery;
    const service = createAuthService({
      UserModel: Users, TokenModel: Tokens, connection,
      resetOrigin: "https://rev.example",
      deliverResetEmail: async (message) => { deliveries.push(message); onDelivery?.(); },
      // REV-SEC-10: this test deliberately asks for a second email right away,
      // so the one-per-minute rule is switched off here (the hourly cap stays).
      resetEmailMinGapMs: 0,
    });
    const auth = createAuth({ connection, service, store, secret: randomBytes(32).toString("hex"), production: false, rateLimitMax: 100, loginAccountCollection: connection.db.collection(names[3]) });
    server = createApp({ auth, checkDatabase: async () => true }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    let cookie = "";
    let csrfToken = "";
    async function request(path, body, overrideCookie) {
      const response = await fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { ...(overrideCookie || cookie ? { Cookie: overrideCookie || cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie && !overrideCookie) cookie = setCookie.split(";")[0];
      const data = await response.json();
      if (data.csrfToken && !overrideCookie) csrfToken = data.csrfToken;
      return { response, data, setCookie };
    }
    const password = "original fixture password only";
    const newPassword = "new fixture password only please";
    const email = "auth-fixture@example.invalid";
    await t.test("CSRF bootstrap saves an anonymous session in the isolated Mongo store", async () => {
      const result = await request("/api/auth/csrf");
      assert.equal(result.response.status, 200);
      assert.match(result.setCookie, /HttpOnly/i);
      assert.ok(await connection.db.collection(names[2]).countDocuments({}));
      const indexes = await connection.db.collection(names[2]).indexes();
      assert.ok(indexes.some((index) => index.key.expires === 1 && index.expireAfterSeconds === 0));
    });
    await t.test("registration creates a normal user, never a client-selected admin", async () => {
      const rejected = await request("/api/auth/register", { username: "auth-fixture", email, password, role: "admin" });
      assert.equal(rejected.response.status, 400);
      assert.equal(await Users.countDocuments({}), 0);
      assert.equal((await request("/api/auth/register", { username: "auth-fixture", email, password })).response.status, 202);
      assert.equal((await Users.findOne({ email })).role, "user");
    });
    await t.test("login rotates the session and does not expose password material", async () => {
      const before = cookie;
      const result = await request("/api/auth/login", { email, password });
      assert.equal(result.response.status, 200);
      assert.notEqual(cookie, before);
      assert.equal(result.data.user.passwordHash, undefined);
      assert.equal(result.data.user.sessionVersion, undefined);
    });
    const oldCookie = cookie;
    await t.test("a regular authenticated account cannot access dashboard routes", async () => assert.equal((await request("/api/dashboard")).response.status, 403));
    await t.test("recovery queues delivery but never returns the secret in HTTP JSON", async () => {
      const delivered = new Promise((resolve) => { onDelivery = resolve; });
      const result = await request("/api/auth/forgot-password", { email });
      assert.equal(result.response.status, 202);
      assert.deepEqual(Object.keys(result.data), ["message"]);
      await Promise.race([delivered, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error("Fixture delivery timed out.")), 10000); timer.unref(); })]);
      onDelivery = undefined;
      const token = tokenFrom(deliveries[0].resetUrl);
      assert.equal(typeof token, "string");
      // REV-SEC-10: the secret must not appear in the query string (server logs).
      assert.equal(new URL(deliveries[0].resetUrl).search, "");
      assert.equal(token.length, 64);
      const record = await Tokens.findOne({}).select("+tokenHash");
      assert.ok(record.tokenHash === tokenDigest(token));
      assert.ok(record.tokenHash !== token);
      assert.equal(record.sessionVersion, 0);
    });
    await t.test("a second request uses a different high-entropy secret", async () => {
      await service.requestReset({ email });
      assert.equal(deliveries.length, 2);
      assert.ok(deliveries[0].resetUrl !== deliveries[1].resetUrl);
      assert.equal(await Tokens.countDocuments({}), 2);
    });
    const token = tokenFrom(deliveries[0].resetUrl);
    await t.test("actual reset transaction changes the password, advances the version and invalidates all requests", async () => {
      const result = await request("/api/auth/reset-password", { token, newPassword });
      assert.equal(result.response.status, 200);
      assert.equal(await Tokens.countDocuments({}), 0);
      assert.equal((await Users.findOne({ email })).sessionVersion, 1);
      assert.equal(result.data.token, undefined);
    });
    await t.test("an old authenticated session is rejected after password reset", async () => assert.equal((await request("/api/auth/me", undefined, oldCookie)).response.status, 401));
    await request("/api/auth/csrf");
    await t.test("the same exact token cannot reset the password twice", async () => assert.equal((await request("/api/auth/reset-password", { token, newPassword })).response.status, 400));
    await t.test("a second outstanding token was invalidated by the first successful reset", async () => {
      const second = tokenFrom(deliveries[1].resetUrl);
      assert.equal((await request("/api/auth/reset-password", { token: second, newPassword })).response.status, 400);
    });
    await t.test("the old password no longer signs in", async () => assert.equal((await request("/api/auth/login", { email, password })).response.status, 401));
    await t.test("the new password signs in through the actual login controller", async () => assert.equal((await request("/api/auth/login", { email, password: newPassword })).response.status, 200));
    await t.test("expired records are rejected without depending on TTL cleanup", async () => {
      await service.requestReset({ email });
      const expiredToken = tokenFrom(deliveries[2].resetUrl);
      await Tokens.updateOne({ tokenHash: tokenDigest(expiredToken) }, { $set: { expiresAt: new Date(0) } });
      assert.equal((await request("/api/auth/reset-password", { token: expiredToken, newPassword })).response.status, 400);
      assert.equal((await Users.findOne({ email })).sessionVersion, 1);
    });
    await t.test("logout revokes the session rather than merely deleting a browser cookie", async () => {
      const authenticated = cookie;
      assert.equal((await request("/api/auth/logout", {})).response.status, 200);
      assert.equal((await request("/api/auth/me", undefined, authenticated)).response.status, 401);
    });
  } catch (error) {
    throw new Error(`Isolated authentication check failed (${error.name || "Error"}, code ${Number(error.code) || 0}); raw driver details suppressed.`);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    if (connection?.readyState === 1) {
      const failures = [];
      for (const name of created) {
        assert.ok(names.includes(name) && name.startsWith(`${prefix}_`));
        try { await connection.db.collection(name).drop(); t.diagnostic(`Removed temporary collection ${name}.`); }
        catch (error) { if (error.code !== 26) failures.push(name); }
      }
      await connection.close();
      if (failures.length) throw new Error(`Temporary cleanup needs attention: ${failures.join(", ")}`);
    }
  }
});
