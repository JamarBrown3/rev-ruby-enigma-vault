// REV-SEC-27 (added 2026-11-07): username rules and the admin rename route.
// Offline: no database needed. The rename route runs against a stand-in User
// model so its rules can be tested without touching Atlas.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { usernameProblem, isOffensiveUsername, looksLikePhoneNumber } from "../security/usernames.js";
import { readUsername, parseRegistration, isReservedUsername } from "../security/input.js";
import { createApp } from "../app.js";
import adminRoutes from "../routes/admin.js";

const password = "long isolated regression password";

// ---------------------------------------------------------------- the rules

const OFFENSIVE = ["fuck", "f_u_c_k", "fvck", "sh1t", "shit_head", "b1tch", "a55hole", "p.u.s.s.y", "dickhead", "motherfucker", "nazi_fan", "hitler"];
for (const name of OFFENSIVE) {
  test(`REV-SEC-27: offensive name "${name}" is refused`, () => assert.equal(usernameProblem(name), "offensive"));
}

const IMPERSONATION = ["admin", "Ad_Min", "a.d.m.i.n", "rev_support", "realadmin", "official_jah", "jah-official", "the_moderator", "SystemBot", "security.team"];
for (const name of IMPERSONATION) {
  test(`REV-SEC-27: impersonation name "${name}" is refused`, () => assert.equal(usernameProblem(name, { extraReserved: "jah,jamar" }), "reserved"));
}

test("REV-SEC-27: the owner's names from RESERVED_USERNAMES are blocked as parts and long names anywhere", () => {
  assert.equal(isReservedUsername("jah_gamer", "jah,jamar"), true);   // "jah" is a whole part
  assert.equal(isReservedUsername("jamarbrown", "jah,jamar"), true);  // 5+ letters, found anywhere
  assert.equal(isReservedUsername("Jahmal", "jah,jamar"), false);     // short word inside a real name is fine
});

for (const name of ["5551234567", "555_123_4567", "call.5551234"]) {
  test(`REV-SEC-27: phone-number name "${name}" is refused`, () => assert.equal(looksLikePhoneNumber(name), true));
}

const ALLOWED = ["jah_gamer", "Jahmal", "trevor", "model_maker", "assassin", "classic_gamer", "scunthorpe", "therapist", "Xenoblade_fan", "gamer2026", "bassist", "kevin.r", "shitake"];
for (const name of ALLOWED) {
  test(`REV-SEC-27: normal name "${name}" is allowed`, () => assert.equal(usernameProblem(name, { extraReserved: "" }), null));
}

test("REV-SEC-27: known accepted false positive is documented (cockpit)", () => {
  // The library flags "cockpit". Rare for usernames, and the admin can rename.
  assert.equal(isOffensiveUsername("cockpit_pilot"), true);
});

// ---------------------------------------------------------- readUsername()

test("REV-SEC-27: new usernames are 3 to 20 characters", () => {
  assert.equal(readUsername("abc"), "abc");
  assert.equal(readUsername("a".repeat(20)), "a".repeat(20));
  assert.throws(() => readUsername("ab"), { status: 400 });
  assert.throws(() => readUsername("a".repeat(21)), { status: 400 });
});

test("REV-SEC-27: offensive and reserved names get the same vague 409 as a taken name", () => {
  for (const name of ["sh1t", "rev_support"]) {
    assert.throws(() => readUsername(name), (error) => error.status === 409 && error.message === "That username is not available.");
  }
});

test("REV-SEC-27: phone numbers get a clear 400 message", () => {
  assert.throws(() => readUsername("5551234567"), (error) => error.status === 400 && /phone/.test(error.message));
});

test("REV-SEC-27: format rules still apply (no spaces, symbols or look-alike letters)", () => {
  for (const name of ["jah gamer", "<script>", "jah@gmail", "аdmin", "_jah", "jah."]) {
    assert.throws(() => readUsername(name), { status: 400 }, name);
  }
});

test("REV-SEC-27: registration uses the same rules", () => {
  assert.throws(() => parseRegistration({ username: "f_u_c_k", email: "fixture@example.invalid", password }), { status: 409 });
  assert.equal(parseRegistration({ username: " gamer2026 ", email: "fixture@example.invalid", password }).username, "gamer2026");
});

// --------------------------------------------------------- the User schema

test("REV-SEC-27: previousUsernames fits the User schema and never reaches the browser", () => {
  const admin = new mongoose.Types.ObjectId();
  const user = new User({
    username: "new_name", email: "fixture@example.invalid", passwordHash: "x",
    previousUsernames: [{ username: "old_name", changedAt: new Date(), changedBy: admin, reason: "Offensive name" }],
  });
  assert.equal(user.validateSync(), undefined);
  assert.equal("previousUsernames" in user.toJSON(), false);
  assert.equal(User.schema.path("previousUsernames").options.select, false);
});

// ------------------------------------------------------ the rename route

const memberId = "a".repeat(24);
const adminId = new mongoose.Types.ObjectId();

// Stand-in for the User model's two database calls.
function fakeUsers(start = { _id: memberId, username: "bad_name", role: "user" }) {
  const state = { user: { ...start }, updates: [] };
  const originals = { findById: User.findById, findOneAndUpdate: User.findOneAndUpdate };
  User.findById = async (id) => (String(id) === state.user._id ? { ...state.user } : null);
  User.findOneAndUpdate = async (filter, update) => {
    state.updates.push({ filter, update });
    if (update.$set.username.toLowerCase() === "taken_name") throw Object.assign(new Error("dup"), { code: 11000 });
    if (filter.username !== state.user.username) return null;
    state.user.username = update.$set.username;
    return { _id: { toString: () => state.user._id }, username: state.user.username, role: state.user.role };
  };
  state.restore = () => Object.assign(User, originals);
  return state;
}

// A tiny server with the admin router; "isAdmin" decides whether the stand-in
// requireAdmin lets the request through.
async function startRouter({ isAdmin }) {
  const app = express();
  app.use(express.json());
  const auth = {
    requireAdmin(req, res, next) {
      if (!isAdmin) return res.status(403).json({ error: "Administrative access is required." });
      req.authUser = { _id: adminId };
      next();
    },
  };
  app.use("/api/admin", adminRoutes(auth));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const rename = async (id, body) => {
    const response = await fetch(`${base}/api/admin/users/${id}/username`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  return { rename, close: () => server.close() };
}

test("REV-SEC-27: admin rename changes the name and records the old one", async () => {
  const users = fakeUsers();
  const api = await startRouter({ isAdmin: true });
  try {
    const result = await api.rename(memberId, { username: "member_101", reason: "Offensive name" });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { user: { id: memberId, username: "member_101", role: "user" }, previousUsername: "bad_name" });
    const { filter, update } = users.updates[0];
    assert.deepEqual(filter, { _id: memberId, username: "bad_name" });           // only if nobody changed it meanwhile
    assert.equal(update.$push.previousUsernames.username, "bad_name");
    assert.equal(update.$push.previousUsernames.reason, "Offensive name");
    assert.equal(String(update.$push.previousUsernames.changedBy), String(adminId));
  } finally { api.close(); users.restore(); }
});

test("REV-SEC-27: admin rename follows the same username rules", async () => {
  const users = fakeUsers();
  const api = await startRouter({ isAdmin: true });
  try {
    assert.equal((await api.rename(memberId, { username: "sh1t_lord" })).status, 409);
    assert.equal((await api.rename(memberId, { username: "rev_support" })).status, 409);
    assert.equal((await api.rename(memberId, { username: "5551234567" })).status, 400);
    assert.equal((await api.rename(memberId, { username: "a" })).status, 400);
    assert.equal(users.updates.length, 0, "nothing reaches the database when the name is refused");
  } finally { api.close(); users.restore(); }
});

test("REV-SEC-27: admin rename edge cases", async () => {
  const users = fakeUsers();
  const api = await startRouter({ isAdmin: true });
  try {
    assert.equal((await api.rename(memberId, { username: "BAD_NAME" })).status, 400);                 // same name
    assert.equal((await api.rename(memberId, { username: "taken_name" })).status, 409);               // unique index
    assert.equal((await api.rename("not-an-id", { username: "member_101" })).status, 404);            // bad id
    assert.equal((await api.rename("b".repeat(24), { username: "member_101" })).status, 404);         // no such user
    assert.equal((await api.rename(memberId, { username: "member_101", role: "admin" })).status, 400); // extra field
    assert.equal((await api.rename(memberId, { username: "member_101", reason: "x".repeat(201) })).status, 400);
  } finally { api.close(); users.restore(); }
});

test("REV-SEC-27: a non-admin cannot rename anyone", async () => {
  const users = fakeUsers();
  const api = await startRouter({ isAdmin: false });
  try {
    assert.equal((await api.rename(memberId, { username: "member_101" })).status, 403);
    assert.equal(users.updates.length, 0);
  } finally { api.close(); users.restore(); }
});

test("REV-SEC-27: app.js locks /api/admin before the router (CSRF and admin check)", async () => {
  const calls = [];
  const auth = {
    sessionMiddleware: (req, res, next) => next(),
    router: express.Router(),
    csrfForMutations: (req, res, next) => (calls.push("csrf"), req.get("x-csrf-token") === "ok" ? next() : res.status(403).json({ error: "csrf" })),
    requireAuth: (req, res, next) => next(),
    requireAdmin: (req, res, next) => (calls.push("admin"), res.status(403).json({ error: "admin" })),
  };
  const server = createApp({ auth, checkDatabase: async () => true, mountRoutes: (app, { auth }) => app.use("/api/admin", adminRoutes(auth)) }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/admin/users/${memberId}/username`;
    const noToken = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" }, body: "{}" });
    assert.equal(noToken.status, 403);
    const notAdmin = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json", Origin: "http://localhost:5173", "x-csrf-token": "ok" }, body: "{}" });
    assert.equal(notAdmin.status, 403);
    assert.deepEqual(calls, ["csrf", "csrf", "admin"]);
  } finally { server.close(); }
});
