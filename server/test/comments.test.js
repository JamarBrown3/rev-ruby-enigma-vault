// Comments: who can read, write, edit and delete. Offline, with stand-in models.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import commentsRoutes from "../routes/comments.js";

const POST = "a".repeat(24);
const OTHER_POST = "b".repeat(24);
const ME = "c".repeat(24);
const SOMEONE = "d".repeat(24);
const MY_COMMENT = "e".repeat(24);
const THEIR_COMMENT = "f".repeat(24);
const OTHER_POST_COMMENT = "9".repeat(24);

// In-memory stand-in for the Comment and Post models.
function fakeDb() {
  const comments = new Map([
    [MY_COMMENT, { _id: MY_COMMENT, postId: POST, authorId: ME, body: "first", createdAt: 1 }],
    [THEIR_COMMENT, { _id: THEIR_COMMENT, postId: POST, authorId: SOMEONE, body: "second", createdAt: 2 }],
    [OTHER_POST_COMMENT, { _id: OTHER_POST_COMMENT, postId: OTHER_POST, authorId: ME, body: "elsewhere", createdAt: 3 }],
  ]);
  const posts = new Set([POST, OTHER_POST]);
  const calls = { find: [], create: [] };
  const toDoc = (record) => ({
    ...record,
    async save() { comments.set(record._id, { ...comments.get(record._id), body: this.body }); },
    async deleteOne() { comments.delete(record._id); },
    async populate() { return this; },
  });
  const originals = { find: Comment.find, create: Comment.create, findOne: Comment.findOne, exists: Post.exists };
  Post.exists = async ({ _id }) => (posts.has(String(_id)) ? { _id } : null);
  Comment.find = (filter) => {
    calls.find.push(filter);
    const rows = [...comments.values()].filter((c) => c.postId === String(filter.postId));
    const chain = { sort: () => chain, skip: () => chain, limit: () => chain, populate: () => chain, then: (ok, bad) => Promise.resolve(rows).then(ok, bad) };
    return chain;
  };
  Comment.findOne = (filter) => {
    const found = comments.get(String(filter._id));
    const match = found && String(found.authorId) === String(filter.authorId);
    const result = match ? toDoc(found) : null;
    return { select: () => Promise.resolve(result), then: (ok, bad) => Promise.resolve(result).then(ok, bad) };
  };
  Comment.create = async (doc) => {
    calls.create.push(doc);
    const record = { _id: "1".repeat(24), ...doc, postId: String(doc.postId), authorId: String(doc.authorId) };
    comments.set(record._id, record);
    return toDoc(record);
  };
  return { comments, calls, restore: () => { Object.assign(Comment, { find: originals.find, create: originals.create, findOne: originals.findOne }); Post.exists = originals.exists; } };
}

// A small server with the comments router. "signedIn" decides who requireAuth lets in.
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
  app.use("/api/posts/:postId/comments", commentsRoutes(auth));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  };
  return { call, close: () => server.close() };
}

test("COMMENTS: anyone can read a post's comments, and only that post's", async () => {
  const db = fakeDb(); const api = await start({ signedIn: null });
  try {
    const result = await api.call("GET", `/api/posts/${POST}/comments`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.map((c) => c.body), ["first", "second"]);
  } finally { api.close(); db.restore(); }
});

test("COMMENTS: reading a missing post or a bad id is a 404; a bad page is a 400", async () => {
  const db = fakeDb(); const api = await start();
  try {
    assert.equal((await api.call("GET", `/api/posts/${"0".repeat(24)}/comments`)).status, 404);
    assert.equal((await api.call("GET", `/api/posts/not-an-id/comments`)).status, 404);
    assert.equal((await api.call("GET", `/api/posts/${POST}/comments?page=0`)).status, 400);
    assert.equal((await api.call("GET", `/api/posts/${POST}/comments?page=abc`)).status, 400);
  } finally { api.close(); db.restore(); }
});

test("COMMENTS: a visitor can't comment (401)", async () => {
  const db = fakeDb(); const api = await start({ signedIn: null });
  try {
    assert.equal((await api.call("POST", `/api/posts/${POST}/comments`, { body: "hi" })).status, 401);
    assert.equal(db.calls.create.length, 0);
  } finally { api.close(); db.restore(); }
});

test("COMMENTS: a member can comment; the author comes from the session, not the browser", async () => {
  const db = fakeDb(); const api = await start();
  try {
    const result = await api.call("POST", `/api/posts/${POST}/comments`, { body: "  Great review!  " });
    assert.equal(result.status, 201);
    assert.equal(result.data.body, "Great review!");
    assert.equal(String(db.calls.create[0].authorId), ME);
    assert.equal(String(db.calls.create[0].postId), POST);
  } finally { api.close(); db.restore(); }
});

test("COMMENTS: bad comment bodies are refused", async () => {
  const db = fakeDb(); const api = await start();
  try {
    for (const body of [{}, { body: "" }, { body: "   " }, { body: 42 }, { body: "x".repeat(2001) }, { body: "hi", authorId: SOMEONE }, { body: "hi", postId: OTHER_POST }, ["hi"]]) {
      assert.equal((await api.call("POST", `/api/posts/${POST}/comments`, body)).status, 400, JSON.stringify(body).slice(0, 40));
    }
    assert.equal((await api.call("POST", `/api/posts/${"0".repeat(24)}/comments`, { body: "hi" })).status, 404);
    assert.equal(db.calls.create.length, 0);
  } finally { api.close(); db.restore(); }
});

test("COMMENTS: you can edit and delete your own comment", async () => {
  const db = fakeDb(); const api = await start();
  try {
    const edited = await api.call("PATCH", `/api/posts/${POST}/comments/${MY_COMMENT}`, { body: "edited" });
    assert.equal(edited.status, 200);
    assert.equal(db.comments.get(MY_COMMENT).body, "edited");
    assert.equal((await api.call("DELETE", `/api/posts/${POST}/comments/${MY_COMMENT}`)).status, 204);
    assert.equal(db.comments.has(MY_COMMENT), false);
  } finally { api.close(); db.restore(); }
});

test("COMMENTS: someone else's comment is a 404, never changed", async () => {
  const db = fakeDb(); const api = await start();
  try {
    assert.equal((await api.call("PATCH", `/api/posts/${POST}/comments/${THEIR_COMMENT}`, { body: "hacked" })).status, 404);
    assert.equal((await api.call("DELETE", `/api/posts/${POST}/comments/${THEIR_COMMENT}`)).status, 404);
    assert.equal(db.comments.get(THEIR_COMMENT).body, "second");
  } finally { api.close(); db.restore(); }
});

test("COMMENTS: your comment through the WRONG post's URL is a 404", async () => {
  const db = fakeDb(); const api = await start();
  try {
    assert.equal((await api.call("DELETE", `/api/posts/${POST}/comments/${OTHER_POST_COMMENT}`)).status, 404);
    assert.equal(db.comments.has(OTHER_POST_COMMENT), true);
  } finally { api.close(); db.restore(); }
});
