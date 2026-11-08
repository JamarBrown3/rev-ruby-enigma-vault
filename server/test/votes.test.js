// Likes and dislikes: who can vote, one vote per person, totals. Offline, with stand-in models.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import Vote from "../models/Vote.js";
import Post from "../models/Post.js";
import votesRoutes from "../routes/votes.js";

const POST = "a".repeat(24);
const OTHER_POST = "b".repeat(24);
const ME = "c".repeat(24);
const SOMEONE = "d".repeat(24);
const THIRD = "e".repeat(24);

// In-memory stand-in for the Vote and Post models. A vote's key is "postId:userId",
// which acts like the real unique index: one vote per person per post.
function fakeDb({ raceOnce = false } = {}) {
  const votes = new Map([
    [`${POST}:${SOMEONE}`, { postId: POST, userId: SOMEONE, value: 1 }],
    [`${POST}:${THIRD}`, { postId: POST, userId: THIRD, value: -1 }],
    [`${OTHER_POST}:${ME}`, { postId: OTHER_POST, userId: ME, value: 1 }],
  ]);
  const posts = new Set([POST, OTHER_POST]);
  const calls = { upsert: [], deleteOne: [] };
  const key = (f) => `${String(f.postId)}:${String(f.userId)}`;
  let raced = false;
  const originals = { countDocuments: Vote.countDocuments, findOne: Vote.findOne, findOneAndUpdate: Vote.findOneAndUpdate, deleteOne: Vote.deleteOne, exists: Post.exists };

  Post.exists = async ({ _id }) => (posts.has(String(_id)) ? { _id } : null);
  Vote.countDocuments = async (f) => [...votes.values()].filter((v) => v.postId === String(f.postId) && v.value === f.value).length;
  Vote.findOne = (f) => {
    const found = votes.get(key(f)) ?? null;
    return { select: () => Promise.resolve(found), then: (ok, bad) => Promise.resolve(found).then(ok, bad) };
  };
  Vote.findOneAndUpdate = async (f, update, options) => {
    calls.upsert.push({ filter: f, update, options });
    if (raceOnce && !raced) { raced = true; const e = new Error("E11000 duplicate key"); e.code = 11000; throw e; }
    const record = { postId: String(f.postId), userId: String(f.userId), value: update.$set.value };
    votes.set(key(f), record);
    return record;
  };
  Vote.deleteOne = async (f) => { calls.deleteOne.push(f); return { deletedCount: votes.delete(key(f)) ? 1 : 0 }; };

  return { votes, calls, restore: () => { Object.assign(Vote, { countDocuments: originals.countDocuments, findOne: originals.findOne, findOneAndUpdate: originals.findOneAndUpdate, deleteOne: originals.deleteOne }); Post.exists = originals.exists; } };
}

// A small server with the votes router. "signedIn" decides who requireAuth lets in.
async function start({ signedIn = ME } = {}) {
  const app = express();
  app.use(express.json());
  const auth = {
    requireAuth(req, res, next) {
      if (!signedIn) return res.status(401).json({ error: "Please sign in." });
      req.authUser = { _id: signedIn };
      next();
    },
  };
  app.use("/api/posts/:postId/votes", votesRoutes(auth));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  };
  return { call, close: () => server.close() };
}

test("VOTES: anyone can see the totals, but never who voted", async () => {
  const db = fakeDb(); const api = await start({ signedIn: null });
  try {
    const result = await api.call("GET", `/api/posts/${POST}/votes`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { likes: 1, dislikes: 1 });
  } finally { api.close(); db.restore(); }
});

test("VOTES: a missing post or a bad id is a 404", async () => {
  const db = fakeDb(); const api = await start();
  try {
    assert.equal((await api.call("GET", `/api/posts/${"0".repeat(24)}/votes`)).status, 404);
    assert.equal((await api.call("GET", `/api/posts/not-an-id/votes`)).status, 404);
    assert.equal((await api.call("PUT", `/api/posts/${"0".repeat(24)}/votes`, { value: 1 })).status, 404);
    assert.equal(db.calls.upsert.length, 0);
  } finally { api.close(); db.restore(); }
});

test("VOTES: a visitor can't vote or see 'my vote' (401)", async () => {
  const db = fakeDb(); const api = await start({ signedIn: null });
  try {
    assert.equal((await api.call("GET", `/api/posts/${POST}/votes/me`)).status, 401);
    assert.equal((await api.call("PUT", `/api/posts/${POST}/votes`, { value: 1 })).status, 401);
    assert.equal((await api.call("DELETE", `/api/posts/${POST}/votes`)).status, 401);
    assert.equal(db.calls.upsert.length + db.calls.deleteOne.length, 0);
  } finally { api.close(); db.restore(); }
});

test("VOTES: 'my vote' is null before voting, and only counts THIS post", async () => {
  const db = fakeDb(); const api = await start();
  try {
    const result = await api.call("GET", `/api/posts/${POST}/votes/me`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { likes: 1, dislikes: 1, myVote: null });
  } finally { api.close(); db.restore(); }
});

test("VOTES: like, switch to dislike, then remove; always ONE vote, from the session", async () => {
  const db = fakeDb(); const api = await start();
  try {
    let result = await api.call("PUT", `/api/posts/${POST}/votes`, { value: 1 });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { likes: 2, dislikes: 1, myVote: 1 });
    assert.equal(String(db.calls.upsert[0].filter.userId), ME);
    assert.equal(db.calls.upsert[0].options.upsert, true);

    result = await api.call("PUT", `/api/posts/${POST}/votes`, { value: -1 });
    assert.deepEqual(result.data, { likes: 1, dislikes: 2, myVote: -1 });

    result = await api.call("DELETE", `/api/posts/${POST}/votes`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { likes: 1, dislikes: 1, myVote: null });

    // Removing a vote you don't have is harmless.
    result = await api.call("DELETE", `/api/posts/${POST}/votes`);
    assert.deepEqual(result.data, { likes: 1, dislikes: 1, myVote: null });
  } finally { api.close(); db.restore(); }
});

test("VOTES: bad vote bodies are refused", async () => {
  const db = fakeDb(); const api = await start();
  try {
    for (const body of [{}, { value: 0 }, { value: 2 }, { value: "1" }, { value: true }, { value: 0.5 }, { value: null }, { value: 1, userId: SOMEONE }, { value: 1, postId: OTHER_POST }, [1]]) {
      assert.equal((await api.call("PUT", `/api/posts/${POST}/votes`, body)).status, 400, JSON.stringify(body));
    }
    assert.equal(db.calls.upsert.length, 0);
  } finally { api.close(); db.restore(); }
});

test("VOTES: you can't change or remove someone else's vote", async () => {
  const db = fakeDb(); const api = await start();
  try {
    await api.call("DELETE", `/api/posts/${POST}/votes`);
    await api.call("PUT", `/api/posts/${POST}/votes`, { value: -1 });
    assert.deepEqual(db.votes.get(`${POST}:${SOMEONE}`).value, 1);
    assert.deepEqual(db.votes.get(`${POST}:${THIRD}`).value, -1);
    assert.equal(db.calls.deleteOne.every((f) => String(f.userId) === ME), true);
  } finally { api.close(); db.restore(); }
});

test("VOTES: two clicks at once (duplicate key 11000) is retried, not a 500", async () => {
  const db = fakeDb({ raceOnce: true }); const api = await start();
  try {
    const result = await api.call("PUT", `/api/posts/${POST}/votes`, { value: 1 });
    assert.equal(result.status, 200);
    assert.equal(db.calls.upsert.length, 2);
    assert.equal(result.data.myVote, 1);
  } finally { api.close(); db.restore(); }
});
