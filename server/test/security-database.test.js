// REV-SEC attack tests against a REAL MongoDB (added 2026-10-26).
//
// Opt-in, exactly like the older Atlas tests:
//   REV_SECURITY_ATLAS=1 node --test test/security-database.test.js
// It uses the database settings from server/.env (read privately by
// config/env.js; nothing is printed) and touches ONLY randomly named
// temporary collections ("_rev_hardening_<random>_..."), which are dropped
// at the end. Real users, posts and sessions are never read or changed.
// Sends no email: password-reset "emails" go to an in-memory list.

import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import User from "../models/User.js";
import Post from "../models/Post.js";
import Reset from "../models/PasswordResetToken.js";
import AiUsage from "../models/AiUsage.js";
import { createAuthService, tokenDigest } from "../services/authService.js";
import { createAiUsageService } from "../services/aiUsageService.js";
import { createAuth } from "../security/auth.js";
import { findOwned } from "../security/access.js";
import { hashNewPassword } from "../security/passwords.js";
import * as totp from "../security/totp.js";

const enabled = process.env.REV_SECURITY_ATLAS === "1";
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const tokenFrom = (resetUrl) => new URLSearchParams(new URL(resetUrl).hash.slice(1)).get("token");

test("REV-SEC database attack suite (isolated temporary collections)", {
  skip: enabled ? false : "Opt in explicitly with REV_SECURITY_ATLAS=1.",
  timeout: 300000,
}, async (t) => {
  const { getDatabaseConfig } = await import("../config/env.js");
  const { createApp } = await import("../app.js");
  const { uri, dbName } = getDatabaseConfig();
  const prefix = `_rev_hardening_${randomBytes(10).toString("hex")}`;
  const names = Object.fromEntries(["users", "tokens", "posts", "sessions", "aiusage", "legacy", "loginlimits"].map((name) => [name, `${prefix}_${name}`]));
  const created = new Set();
  let connection;
  const servers = [];

  // Isolated models: same schemas (and security plugins) as production,
  // stored in the temporary collections only.
  const models = {};
  async function boot({
    trustProxy = false, rateLimitMax = 20, globalRateLimitMax = 300,
    deliveries = null, mountRoutes = null, mfaKey = null, resetEmailMinGapMs,
  } = {}) {
    const service = createAuthService({
      UserModel: models.Users, TokenModel: models.Tokens, connection,
      resetOrigin: "https://rev.example",
      deliverResetEmail: deliveries ? async (message) => { deliveries.push(message); } : null,
      mfaKey,
      ...(resetEmailMinGapMs === undefined ? {} : { resetEmailMinGapMs }),
    });
    const store = MongoStore.create({ client: connection.getClient(), dbName, collectionName: names.sessions, ttl: 1800 });
    const auth = createAuth({ connection, service, store, secret: "isolated-shared-test-signing-key-not-production-0123456789", production: false, rateLimitMax, loginAccountCollection: connection.db.collection(names.loginlimits) });
    const server = createApp({ auth, trustProxy, globalRateLimitMax, checkDatabase: async () => true, mountRoutes }).listen(0, "127.0.0.1");
    await once(server, "listening");
    servers.push(server);
    return {
      base: `http://127.0.0.1:${server.address().port}`,
      close: () => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); },
    };
  }

  // A tiny browser stand-in: keeps its cookie and CSRF token like a real tab.
  function browser(base, extraHeaders = {}) {
    let cookie = "";
    let csrf = "";
    return async function request(path, body, headers = {}) {
      const started = performance.now();
      const response = await fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
          ...extraHeaders, ...headers,
        },
        ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      });
      const ms = performance.now() - started;
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      let data = null;
      try { data = await response.json(); } catch { /* empty body */ }
      if (data?.csrfToken) csrf = data.csrfToken;
      return { status: response.status, data, ms, setCookie };
    };
  }

  const password = "correct horse battery staple 42";
  async function register(request, username, email) {
    return request("/api/auth/register", { username, email, password });
  }

  try {
    connection = await mongoose.createConnection(uri, {
      dbName, autoCreate: false, autoIndex: false, maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, socketTimeoutMS: 20000,
    }).asPromise();

    models.Users = connection.model(`${prefix}_User`, User.schema.clone(), names.users);
    models.Tokens = connection.model(`${prefix}_Reset`, Reset.schema.clone(), names.tokens);
    models.Posts = connection.model(`${prefix}_Post`, Post.schema.clone(), names.posts);
    models.Usage = connection.model(`${prefix}_AiUsage`, AiUsage.schema.clone(), names.aiusage);
    for (const Model of [models.Users, models.Tokens, models.Posts, models.Usage]) {
      await Model.createCollection();
      created.add(Model.collection.name);
      await Model.createIndexes();
    }
    await connection.db.createCollection(names.sessions);
    created.add(names.sessions);
    await connection.db.createCollection(names.loginlimits);
    created.add(names.loginlimits);
    t.diagnostic(`Created ${created.size} temporary collections under ${prefix}.`);

    // ------------------------------------------------------------------ injection
    await t.test("INJECTION: NoSQL operator, array and prototype payloads never reach the database", async () => {
      const app = await boot({ rateLimitMax: 1000 });
      const request = browser(app.base);
      const anonymous = (await request("/api/auth/csrf")).setCookie.split(";")[0];
      const payloads = [
        { email: { $ne: null }, password: { $ne: null } },
        { email: { $gt: "" }, password: "x" },
        { email: { $regex: ".*" }, password: { $exists: true } },
        { email: ["a@b.co", "c@d.co"], password },
        { email: "a@b.co", password: [password] },
        { email: "a@b.co", password, $where: "return true" },
        { "email.$": "a@b.co", password },
        JSON.parse('{"email":"a@b.co","password":"x","__proto__":{"role":"admin"}}'),
        { email: "a@b.co", password: "x", constructor: { prototype: { role: "admin" } } },
        { email: "' OR '1'='1", password: "' OR '1'='1" },
        { email: "admin@example.com'; DROP TABLE users; --", password },
      ];
      for (const body of payloads) {
        const result = await request("/api/auth/login", body);
        assert.ok([400, 401].includes(result.status), `${JSON.stringify(body)} -> ${result.status}`);
        // No login happened: a successful login would issue a NEW session ID.
        if (result.setCookie) assert.equal(result.setCookie.split(";")[0], anonymous);
      }
      assert.equal((await request("/api/auth/me")).status, 401);
      for (const body of [{ username: "mallory", email: "m@example.com", password, role: "admin" }, { username: { $gt: "" }, email: "m@example.com", password }]) {
        assert.equal((await request("/api/auth/register", body)).status, 400);
      }
      assert.equal(await models.Users.countDocuments({}), 0);
      assert.equal(Object.prototype.role, undefined);
      await app.close();
    });

    await t.test("REV-SEC-14: operator filters are neutralized even if a future route forgets validation", async () => {
      const owner = await models.Users.create({ username: "owner1", email: "owner1@example.test", passwordHash: "x" });
      for (const run of [
        () => models.Users.findOne({ email: { $ne: null } }),
        () => models.Users.countDocuments({ email: { $exists: true } }),
        () => models.Users.updateOne({ email: { $ne: "x" } }, { $set: { role: "admin" } }),
        () => models.Users.deleteMany({ email: { $regex: "." } }),
        () => models.Users.findOne({ $where: "return true" }),
      ]) {
        await assert.rejects(run().exec());
      }
      const unchanged = await models.Users.findById(owner._id);
      assert.equal(unchanged.role, "user");
      assert.equal((await models.Users.find({ createdAt: mongoose.trusted({ $lte: new Date() }) })).length, 1);
      await models.Users.deleteMany({});
    });

    await t.test("REV-SEC-14: reads get a default time limit so runaway queries are cancelled", async () => {
      const query = models.Users.find({});
      await query.exec();
      assert.equal(query.getOptions().maxTimeMS, 5000);
      const pipeline = models.Users.aggregate([{ $match: { role: "user" } }]);
      await pipeline.exec();
      assert.equal(pipeline.options.maxTimeMS, 15000);
    });

    // --------------------------------------------------------------- privacy
    await t.test("REV-SEC-07: emails never leak through populate() or res.json(user)", async () => {
      const author = await models.Users.create({ username: "author1", email: "author1@example.test", passwordHash: "x" });
      await models.Posts.create({ authorId: author._id, title: "t", body: "b" });
      const post = await models.Posts.findOne({}).populate({ path: "authorId", model: models.Users });
      assert.equal(post.authorId.username, "author1");
      assert.equal(post.authorId.email, undefined);
      assert.equal(JSON.stringify(post).includes("author1@example.test"), false);
      assert.equal((await models.Users.findById(author._id)).email, undefined);
      assert.equal((await models.Users.findById(author._id).select("+email")).email, "author1@example.test");
      await models.Posts.deleteMany({});
      await models.Users.deleteMany({});
    });

    await t.test("REV-SEC-02: login timing does not reveal which emails are registered", async () => {
      const app = await boot({ rateLimitMax: 10000 });
      const request = browser(app.base);
      await request("/api/auth/csrf");
      await register(request, "timing1", "timing1@example.test");
      const sample = async (email) => {
        const times = [];
        for (let index = 0; index < 15; index += 1) times.push((await request("/api/auth/login", { email, password: "wrong guess" })).ms);
        return median(times);
      };
      await sample("warmup@example.test");
      const known = await sample("timing1@example.test");
      const unknown = await sample(`nobody-${Date.now()}@example.test`);
      t.diagnostic(`median login: registered ${known.toFixed(1)} ms, unregistered ${unknown.toFixed(1)} ms`);
      assert.ok(known / unknown < 2 && unknown / known < 2, `ratio ${(known / unknown).toFixed(2)}`);
      await app.close();
      await models.Users.deleteMany({});
    });

    // ------------------------------------------------------------ usernames
    await t.test("REV-SEC-08: 'Jah' blocks 'jah' and 'JAH' (database index + clear 409)", async () => {
      const app = await boot({ rateLimitMax: 1000 });
      const request = browser(app.base);
      await request("/api/auth/csrf");
      assert.equal((await register(request, "Jah", "jah1@example.test")).status, 202);
      for (const name of ["jah", "JAH", "jAh"]) {
        const result = await register(request, name, `${name}-other@example.test`);
        assert.equal(result.status, 409);
        assert.deepEqual(result.data, { error: "That username is not available." });
      }
      // Even a race that skips the pre-check is stopped by MongoDB itself.
      await assert.rejects(models.Users.create({ username: "JAH", email: "race@example.test", passwordHash: "x" }), (error) => error.code === 11000);
      // A duplicate EMAIL with a fresh username looks exactly like success.
      const fresh = await register(request, "brandnew", "fresh@example.test");
      const duplicateEmail = await register(request, "anothername", "jah1@example.test");
      assert.equal(duplicateEmail.status, fresh.status);
      assert.deepEqual(duplicateEmail.data, fresh.data);
      assert.equal(await models.Users.countDocuments({}), 2);
      await app.close();
      await models.Users.deleteMany({});
    });

    await t.test("REV-SEC-08: an existing database with the old username index still starts", async () => {
      const Legacy = connection.model(`${prefix}_LegacyUser`, User.schema.clone(), names.legacy);
      await Legacy.createCollection();
      created.add(names.legacy);
      await Legacy.collection.createIndex({ username: 1 }, { unique: true, name: "username_1" });
      await assert.doesNotReject(Legacy.createIndexes());
      const indexNames = (await Legacy.collection.indexes()).map((index) => index.name);
      assert.ok(indexNames.includes("username_1") && indexNames.includes("username_case_insensitive_unique"));
    });

    // ------------------------------------------------------- password reset
    await t.test("REV-SEC-10: reset-email spam is capped even across server restarts", async () => {
      const deliveries = [];
      const seed = await boot({ rateLimitMax: 1000, deliveries });
      const seeder = browser(seed.base);
      await seeder("/api/auth/csrf");
      await register(seeder, "victim1", "victim1@example.test");
      await seed.close();
      for (let restart = 0; restart < 4; restart += 1) {
        const app = await boot({ rateLimitMax: 1000, deliveries, resetEmailMinGapMs: 0 });
        const request = browser(app.base);
        await request("/api/auth/csrf");
        for (let index = 0; index < 5; index += 1) {
          const result = await request("/api/auth/forgot-password", { email: "victim1@example.test" });
          assert.ok([202, 429].includes(result.status));
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
        await app.close();
      }
      t.diagnostic(`reset emails delivered across 4 restarts: ${deliveries.length} (before the fix: 3 per restart)`);
      assert.equal(deliveries.length, 3);
      assert.equal(await models.Tokens.countDocuments({}), 3);
    });

    await t.test("REV-SEC-10: one reset email per minute; responses identical for real and fake emails", async () => {
      await models.Tokens.deleteMany({});
      const deliveries = [];
      const app = await boot({ rateLimitMax: 1000, deliveries });
      const request = browser(app.base);
      await request("/api/auth/csrf");
      const real = await request("/api/auth/forgot-password", { email: "victim1@example.test" });
      const again = await request("/api/auth/forgot-password", { email: "victim1@example.test" });
      const fake = await request("/api/auth/forgot-password", { email: `nobody-${Date.now()}@example.test` });
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(deliveries.length, 1);
      for (const result of [again, fake]) {
        assert.equal(result.status, real.status);
        assert.deepEqual(result.data, real.data);
      }
      await app.close();
    });

    await t.test("REV-SEC-10: the reset token travels after '#', never in the query string", async () => {
      const [{ resetUrl } = {}] = await (async () => {
        const deliveries = [];
        const service = createAuthService({ UserModel: models.Users, TokenModel: models.Tokens, connection, resetOrigin: "https://rev.example", deliverResetEmail: async (message) => { deliveries.push(message); }, resetEmailsPerHour: 100, resetEmailMinGapMs: 0 });
        await service.requestReset({ email: "victim1@example.test" });
        return deliveries;
      })();
      const url = new URL(resetUrl);
      assert.equal(url.origin + url.pathname, "https://rev.example/reset-password");
      assert.equal(url.search, "");
      assert.match(tokenFrom(resetUrl), /^[a-f0-9]{64}$/);
      const stored = await models.Tokens.findOne({ tokenHash: tokenDigest(tokenFrom(resetUrl)) }).select("+tokenHash");
      assert.ok(stored, "only the SHA-256 digest is stored");
      assert.equal(await models.Tokens.findOne({ tokenHash: tokenFrom(resetUrl) }), null);
    });

    await t.test("REV-SEC-10: fake reset links are refused before any expensive password hashing", async () => {
      const service = createAuthService({ UserModel: models.Users, TokenModel: models.Tokens, connection, resetOrigin: "https://rev.example", deliverResetEmail: async () => {} });
      let started = performance.now();
      await hashNewPassword(password);
      const hashTime = performance.now() - started;
      const fakeTimes = [];
      for (let index = 0; index < 5; index += 1) {
        started = performance.now();
        await assert.rejects(service.resetPassword({ token: randomBytes(32).toString("hex"), newPassword: password }), { status: 400 });
        fakeTimes.push(performance.now() - started);
      }
      t.diagnostic(`one Argon2 hash ${hashTime.toFixed(1)} ms; fake-link rejection median ${median(fakeTimes).toFixed(1)} ms`);
      assert.ok(median(fakeTimes) < hashTime, "a fake link should be cheaper than a hash");
    });

    await t.test("REV-SEC-10: password-reset floods from 60 different IPs send at most 3 emails", async () => {
      await models.Tokens.deleteMany({});
      const deliveries = [];
      const app = await boot({ trustProxy: 1, rateLimitMax: 20, deliveries, resetEmailMinGapMs: 0 });
      const statuses = {};
      for (let index = 0; index < 60; index += 1) {
        const request = browser(app.base, { "X-Forwarded-For": `198.51.100.${index + 1}` });
        await request("/api/auth/csrf");
        const result = await request("/api/auth/forgot-password", { email: "victim1@example.test" });
        statuses[result.status] = (statuses[result.status] || 0) + 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      t.diagnostic(`60 reset requests from 60 IPs -> ${JSON.stringify(statuses)}, emails sent: ${deliveries.length}`);
      assert.ok(deliveries.length <= 3);
      await app.close();
      await models.Tokens.deleteMany({});
      await models.Users.deleteMany({});
    });

    // ---------------------------------------------------- admin two-step
    const mfaKey = randomBytes(32);
    const adminSecret = totp.generateTotpSecret();
    const adminId = new mongoose.Types.ObjectId();
    const adminRoutes = (expressApp) => {
      const router = express.Router();
      router.get("/", (req, res) => res.json({ ok: true, admin: req.authUser.username }));
      expressApp.use("/api/admin/stats", router);
    };
    async function freshCode(lastStep) {
      // Wait for the next 30-second window if this one's code was just used.
      while (totp.totpStep() <= lastStep) await new Promise((resolve) => setTimeout(resolve, 500));
      return totp.hotp(adminSecret, totp.totpStep());
    }

    await t.test("REV-SEC-09: the admin account needs password AND the 6-digit code; codes can't be replayed", async () => {
      await models.Users.create({
        _id: adminId, username: "owner", email: "owner@example.test",
        passwordHash: await hashNewPassword(password), role: "admin", status: "active", sessionVersion: 0,
        mfa: { secretEnc: totp.encryptTotpSecret(adminSecret, mfaKey, adminId.toString()), enabledAt: new Date(), lastUsedStep: -1 },
      });
      const app = await boot({ rateLimitMax: 1000, mfaKey, mountRoutes: adminRoutes });

      const noCode = browser(app.base);
      await noCode("/api/auth/csrf");
      const missing = await noCode("/api/auth/login", { email: "owner@example.test", password });
      const wrongPassword = await noCode("/api/auth/login", { email: "owner@example.test", password: "not the password at all" });
      const wrongCode = await noCode("/api/auth/login", { email: "owner@example.test", password, code: "000000" });
      for (const result of [missing, wrongPassword, wrongCode]) {
        assert.equal(result.status, 401);
        assert.deepEqual(result.data, { error: "Invalid credentials." });
      }
      assert.equal((await noCode("/api/admin/stats")).status, 401);

      const owner = browser(app.base);
      await owner("/api/auth/csrf");
      const code = await freshCode(-1);
      const login = await owner("/api/auth/login", { email: "owner@example.test", password, code });
      assert.equal(login.status, 200);
      const stats = await owner("/api/admin/stats");
      assert.equal(stats.status, 200);
      assert.deepEqual(stats.data, { ok: true, admin: "owner" });

      // Someone who watched the code being typed tries it right away.
      const thief = browser(app.base);
      await thief("/api/auth/csrf");
      assert.equal((await thief("/api/auth/login", { email: "owner@example.test", password, code })).status, 401);

      // With a wrong ADMIN_MFA_KEY on the server, nobody gets in (fail closed).
      const misconfigured = await boot({ rateLimitMax: 1000, mfaKey: randomBytes(32) });
      const attempt = browser(misconfigured.base);
      await attempt("/api/auth/csrf");
      const stored = await models.Users.findById(adminId).select("+mfa.lastUsedStep");
      assert.equal((await attempt("/api/auth/login", { email: "owner@example.test", password, code: await freshCode(stored.mfa.lastUsedStep) })).status, 401);
      await misconfigured.close();
      await app.close();
    });

    await t.test("REV-SEC-09: regular members are refused by admin routes", async () => {
      const app = await boot({ rateLimitMax: 1000, mfaKey, mountRoutes: adminRoutes });
      const member = browser(app.base);
      await member("/api/auth/csrf");
      await register(member, "member1", "member1@example.test");
      assert.equal((await member("/api/auth/login", { email: "member1@example.test", password })).status, 200);
      assert.equal((await member("/api/admin/stats", undefined, { "X-User-Role": "admin" })).status, 403);
      await app.close();
    });

    await t.test("REV-SEC-25: changing a member's database role cannot upgrade its existing session", async () => {
      const app = await boot({ rateLimitMax: 1000, mfaKey, mountRoutes: adminRoutes });
      const member = browser(app.base);
      await member("/api/auth/csrf");
      await member("/api/auth/login", { email: "member1@example.test", password });
      await models.Users.updateOne({ username: "member1" }, { $set: { role: "admin" } });
      assert.equal((await member("/api/admin/stats")).status, 403);
      assert.equal((await member("/api/auth/login", { email: "member1@example.test", password })).status, 401);
      await app.close();
      await models.Users.deleteMany({});
    });

    // ------------------------------------------------------------- bots
    await t.test("BOT FLOOD: 400 login attempts from one IP: only 20 processed, the site stays up for others", async () => {
      const app = await boot({ trustProxy: 1, rateLimitMax: 20, globalRateLimitMax: 1000 });
      const bot = browser(app.base, { "X-Forwarded-For": "203.0.113.66" });
      await bot("/api/auth/csrf");
      const statuses = {};
      const attempts = Array.from({ length: 400 }, (_, index) => bot("/api/auth/login", { email: "victim@example.test", password: `guess-${index}` }));
      // Meanwhile a real visitor from another network uses the site.
      const visitor = browser(app.base, { "X-Forwarded-For": "192.0.2.10" });
      const visitorStart = performance.now();
      const visitorResult = await visitor("/api/auth/csrf");
      const visitorMs = performance.now() - visitorStart;
      for (const result of await Promise.all(attempts)) statuses[result.status] = (statuses[result.status] || 0) + 1;
      t.diagnostic(`bot statuses ${JSON.stringify(statuses)}; visitor answered in ${visitorMs.toFixed(0)} ms`);
      assert.equal(visitorResult.status, 200);
      assert.equal((statuses[401] || 0) + (statuses[503] || 0), 20);
      assert.equal(statuses[429], 380);
      await app.close();
    });

    await t.test("BOT FLOOD: the site-wide limit stops a scraper; health checks keep working", async () => {
      const app = await boot({ trustProxy: 1, globalRateLimitMax: 300 });
      const scraper = browser(app.base, { "X-Forwarded-For": "203.0.113.77" });
      const statuses = {};
      for (let batch = 0; batch < 8; batch += 1) {
        const results = await Promise.all(Array.from({ length: 50 }, () => scraper("/api/not-a-real-page")));
        for (const result of results) statuses[result.status] = (statuses[result.status] || 0) + 1;
      }
      t.diagnostic(`400 scraper requests -> ${JSON.stringify(statuses)}`);
      assert.equal(statuses[404], 300);
      assert.equal(statuses[429], 100);
      assert.equal((await scraper("/api/health")).status, 200);
      assert.equal((await browser(app.base, { "X-Forwarded-For": "192.0.2.11" })("/api/not-a-real-page")).status, 404);
      await app.close();
    });

    await t.test("BOT FLOOD: cookie-less bots can create at most 60 anonymous sessions per IP per 15 minutes", async () => {
      const before = await connection.db.collection(names.sessions).countDocuments();
      const app = await boot({ rateLimitMax: 1000 });
      let ok = 0;
      for (let index = 0; index < 100; index += 1) if ((await fetch(`${app.base}/api/auth/csrf`)).status === 200) ok += 1;
      const createdSessions = (await connection.db.collection(names.sessions).countDocuments()) - before;
      t.diagnostic(`100 cookie-less /csrf calls -> ${ok} answered, ${createdSessions} sessions stored`);
      assert.equal(createdSessions, 60);
      await app.close();
    });

    await t.test("REV-SEC-24: account login attempts are capped across many IPs", async () => {
      const app = await boot({ trustProxy: 1, rateLimitMax: 20 });
      const seed = browser(app.base, { "X-Forwarded-For": "192.0.2.50" });
      await seed("/api/auth/csrf");
      await register(seed, "guessme", "guessme@example.test");
      let processed = 0;
      let limited = 0;
      for (let index = 0; index < 40; index += 1) {
        const request = browser(app.base, { "X-Forwarded-For": `203.0.113.${index + 1}` });
        await request("/api/auth/csrf");
        const status = (await request("/api/auth/login", { email: "guessme@example.test", password: `guess-${index}` })).status;
        if (status === 401) processed += 1;
        if (status === 429) limited += 1;
      }
      t.diagnostic(`${processed}/40 guesses checked; ${limited}/40 rate-limited across different IPs`);
      assert.ok(processed <= 20);
      assert.equal(processed + limited, 40);
      await app.close();
      await models.Users.deleteMany({});
    });

    // -------------------------------------------------------------- future
    await t.test("REV-SEC-19: 20 simultaneous AI requests with a limit of 5 -> exactly 5 allowed", async () => {
      const usage = createAiUsageService({ UsageModel: models.Usage, perAccountLimit: 5, siteLimit: 100 });
      const accountId = new mongoose.Types.ObjectId();
      const results = await Promise.allSettled(Array.from({ length: 20 }, () => usage.reserve(accountId)));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 5);
      assert.ok(results.filter((result) => result.status === "rejected").every((result) => result.reason.status === 429));
      await usage.release(accountId);
      await assert.doesNotReject(usage.reserve(accountId));
      await assert.rejects(usage.reserve(accountId), { status: 429 });
    });

    await t.test("REV-SEC-19: the site-wide daily AI budget holds across many accounts", async () => {
      await models.Usage.deleteMany({});
      const usage = createAiUsageService({ UsageModel: models.Usage, perAccountLimit: 5, siteLimit: 7 });
      const accounts = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId());
      const results = await Promise.allSettled(accounts.flatMap((id) => Array.from({ length: 5 }, () => usage.reserve(id))));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 7);
      const perAccount = await models.Usage.find({ scope: "account" }).lean();
      assert.equal(perAccount.reduce((sum, row) => sum + row.count, 0), 7, "refused requests are not charged to the account");
    });

    await t.test("REV-SEC-20: changing the ID in the URL can't load someone else's record", async () => {
      const alice = new mongoose.Types.ObjectId();
      const mallory = new mongoose.Types.ObjectId();
      const post = await models.Posts.create({ authorId: alice, title: "private draft", body: "b" });
      assert.equal(await findOwned(models.Posts, { id: post._id.toString(), ownerId: mallory, ownerField: "authorId" }), null);
      assert.equal((await findOwned(models.Posts, { id: post._id.toString(), ownerId: alice, ownerField: "authorId" })).title, "private draft");
      await assert.rejects(findOwned(models.Posts, { id: { $ne: null }, ownerId: mallory, ownerField: "authorId" }), { status: 404 });
    });
  } finally {
    for (const server of servers) { server.closeAllConnections(); server.close(); }
    if (connection?.readyState === 1) {
      const failures = [];
      for (const name of created) {
        assert.ok(name.startsWith(`${prefix}_`));
        try { await connection.db.collection(name).drop(); }
        catch (error) { if (error.code !== 26) failures.push(name); }
      }
      t.diagnostic(`Removed ${created.size - failures.length} temporary collections.`);
      await connection.close();
      if (failures.length) throw new Error(`Temporary cleanup needs attention: ${failures.join(", ")}`);
    }
  }
});
