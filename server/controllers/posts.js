// Imports: the Post model plus Game (to check a review's game exists),
// Comment and Vote (to clean up when a post is deleted).
import Post from "../models/Post.js";
import Game from "../models/Game.js";
import Comment from "../models/Comment.js";
import Vote from "../models/Vote.js";
import { HttpError } from "../security/input.js";
import { readObjectId, findOwned, notFound } from "../security/access.js";

// SECTION 1 HELPER FUNCIONS ---------

// Same text() helper as games.js
function text(value, label, max) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new HttpError(400, `${label} must be 1-${max} characters long.`);
  }
  return value.trim();
}

// Same idea as pickGameFields. Notice: NO imageUrl (text-only posts)
// and NO authorId (the author always comes from the session).
function pickPostFields(body, { partial }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Send a JSON object.");
  }

  // validate each field if it is present, and then copy it to a new json object.
  const allowed = ["kind", "title", "body", "gameId", "rating", "recommend"];

  // using a filter to find any unknown fields in the request body that are not in the allowed list.
  // if there are any unknown fields, it throws an HttpError with a 400 status code and a message indicating which fields are not allowed.
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length)
    throw new HttpError(400, `Unsupported field: ${unknown[0]}`);

  // out is an empty object that will hold the validated and sanitized fields from the request body.
  const out = {};
  // has is a helper function that checks if a specific key exists in the request body and is not undefined.
  // It returns true if the key exists and false otherwise.
  const has = (key) => body[key] !== undefined;

  // seeing if all the required fields are present in the request body. If any required field is missing,
  // it throws an HttpError with a 400 status code and a message indicating which field is required.
  if (!partial) {
    const kind = body.kind ?? "discussion";
    if (kind !== "discussion" && kind !== "review") {
      throw new HttpError(400, `kind must be either "discussion" or "review".`);
    }
    out.kind = kind;
  } else if (has("kind")) {
    throw new HttpError(
      400,
      "Kind must be discussion or review, and cannot be changed.",
    );
  }

  if (!partial || has("title")) out.title = text(body.title, "Title", 400);
  if (!partial || has("body")) out.body = text(body.body, "Body", 10000);
  if (has("gameId")) out.gameId = readObjectId(body.gameId); // must be a real-looking ID
  if (has("rating")) {
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 10) {
      throw new HttpError(400, "Rating must be a whole number from 1 to 10.");
    }
    out.rating = body.rating;
  }

  if (has("recommend")) {
    if (typeof body.recommend !== "boolean")
      throw new HttpError(400, "Recommend must be true or false.");
    out.recommend = body.recommend;
  }
  return out;
}

// SECTION 2 CONTROLLER FUNCTIONS ---------

// POST /api/posts (signed in only)
// SQL VERSION: INSERT INTO posts (..., author_id) VALUES (..., <logged-in user>)
const createPost = async (req, res) => {
  const fields = pickPostFields(req.body, { partial: false });
  if (fields.kind === "review") {
    // check that the gameId and rating are present. If not, throw a 400 error.
    if (!fields.gameId || fields.rating === undefined) {
      throw new HttpError(400, "A review needs a gameId and a rating.");
    }
    // check that the gameId is valid and exists in the database. If not, throw a 404 error.
    if (!(await Game.exists({ _id: fields.gameId }))) {
      throw notFound();
    }
  }

  // NEW addtional idea: the author is the logged-in user, never something the browser sends.
  const post = await Post.create({ ...fields, authorId: req.authUser._id });
  res.status(201).json(post);
};

// GET /api/posts?page=1&gameId=... (anyone can get all posts, optionally filtered by gameId)
const getPosts = async (req, res) => {
  const raw = req.query.page ?? "1";
  // ?? is the nullish coalescing operator (“use the right side if the left is null or undefined”).
  // The optional chaining operator is ? which is used to access the page property of req.query safely,
  //  without throwing an error if req.query is null or undefined.
  if (typeof raw !== "string" || !/^\d{1,4}$/.test(raw)) {
    throw new HttpError(400, "Page must be a whole number between 1 and 1000.");
  }
  const page = Number(raw);
  if (page < 1 || page > 1000) {
    throw new HttpError(400, "Page must be a whole number between 1 and 1000.");
  }

  // if gameId is present, filter by it. Otherwise, return all posts.
  const filter = {};
  if (req.query.gameId !== undefined) {
    filter.gameId = readObjectId(req.query.gameId);
  }
  const limit = 20;
  const posts = await Post.find(filter)
    .sort({ createdAt: -1, _id: -1 }) // newest post first, then by _id to break ties
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("authorId", "username") // like a SQL JOIN, but ONLY the username
    .populate("gameId", "title coverImage"); // the game's name + cover image
  res.status(200).json(posts);
};

// GET /api/posts/:id (anyone can get a specific post by id)
const getPost = async (req, res) => {
  const post = await Post.findById(readObjectId(req.params.id))
    .populate("authorId", "username")
    .populate("gameId", "title coverImage");

  if (!post) throw notFound();
  res.status(200).json(post);
};

// PATCH /api/posts/:id (signed in only, and must be the author)
// SQL VERSION: UPDATE posts SET ... WHERE id = $1 AND author_id = <logged-in user>
const updatePost = async (req, res) => {
  // NEW IDEA: findOwned = "find this post AND it must be mine". Some else's post → 404.
  const post = await findOwned(Post, {
    id: req.params.id,
    ownerId: req.authUser._id,
    ownerField: "authorId",
  });

  if (!post) throw notFound();

  // pickPostFields validates the request body and returns a new object with only the allowed fields.
  const fields = pickPostFields(req.body, { partial: true });
  if (
    post.kind === "discussion" &&
    (fields.gameId ||
      fields.rating !== undefined ||
      fields.recommend !== undefined)
  ) {
    throw new HttpError(
      400,
      "Discussions can't have a game, rating, or recommendation.",
    );
  }

  // if the post is a review, check that the gameId is valid and exists in the database. If not, throw a 404 error.
  if (fields.gameId && !(await Game.exists({ _id: fields.gameId }))) {
    throw notFound();
  }
  Object.assign(post, fields);
  await post.save();
  res.status(200).json(post);
};

// DELETE /api/posts/:id (signed in, ONLY your own post)
// Also deletes its comments and votes
const deletePost = async (req, res) => {
  const post = await findOwned(Post, {
    id: req.params.id,
    ownerId: req.authUser._id,
    ownerField: "authorId",
  });

  if (!post) throw notFound();
  await Comment.deleteMany({ postId: post._id });
  await Vote.deleteMany({ postId: post._id });
  await post.deleteOne();
  res.status(204).end();
};

export default { createPost, getPosts, getPost, updatePost, deletePost };
