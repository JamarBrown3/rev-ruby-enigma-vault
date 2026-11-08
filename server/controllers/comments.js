// Imports: the Comment model, plus Post (to check the post exists).

import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import { HttpError } from "../security/input.js";
import { readObjectId, findOwned, notFound } from "../security/access.js";

// SECTION 1 HELPER FUNCTIONS ---------

// A comment body must be text, 1 to 2000 characters (spaces trimmed).

function readCommentBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "send a JSON object.");
  }

  // only "body" is allowed. No authorId or postId: those come from the session and the URL.
  const unknown = Object.keys(body).filter((key) => key !== "body");
  if (unknown.length)
    throw new HttpError(400, `Unsupported field: ${unknown[0]}`);

  const text = body.body;
  if (
    typeof text !== "string" ||
    text.trim() === "" ||
    text.trim().length > 2000
  ) {
    throw new HttpError(400, "Comment must be 1-2000 characters long.");
  }
  return text.trim();
}

// The post from the URL must exist, or it's a 404.
async function readExistingPostId(value) {
  const postId = readObjectId(value, "postId");
  if (!(await Post.exists({ _id: postId }))) throw notFound();
  return postId;
}

// SECTION 2 CONTROLLER FUNCTIONS ---------

// GET /api/posts/:postId/comments?page=1 (anyone)
// Oldest comment first, 50 per page, with only each author's username.
const getComments = async (req, res) => {
  const postId = await readExistingPostId(req.params.postId);

  const raw = req.query.page ?? "1";
  if (
    typeof raw !== "string" ||
    !/^\d{1,4}$/.test(raw) ||
    Number(raw) < 1 ||
    Number(raw) > 1000
  ) {
    throw new HttpError(400, "Page must be a whole number between 1 and 1000.");
  }

  const page = Number(raw);
  const limit = 50;

  const comments = await Comment.find({ postId })
    .sort({
      createdAt: 1,
      _id: 1,
    }) // oldest first, _id breaks ties
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("authorId", "username"); // like a SQL JOIN, but only the username
  res.status(200).json(comments);
};

// POST /api/posts/:postId/comments (signed in only)
// SQL VERSION: INSERT INTO comments (post_id, author_id, body) VALUES ($1, <logged-in user>, $2)
const createComment = async (req, res) => {
  const postId = await readExistingPostId(req.params.postId);
  const body = readCommentBody(req.body);

  // The author is the logged-in user, never something the browser sends.
  const comment = await Comment.create({
    postId,
    authorId: req.authUser._id,
    body,
  });
  await comment.populate("authorId", "username");
  res.status(201).json(comment);
};

// Find a comment that is on THIS post AND written by the logged-in user/
// Someone else's comment, or a comment on a different post, is a 404.
async function findMyComment(req) {
  const postId = readObjectId(req.params.postId);
  const comment = await findOwned(Comment, {
    id: req.params.commentId,
    ownerId: req.authUser._id,
    ownerField: "authorId",
  });
  if (!comment || String(comment.postId) !== postId) throw notFound();
  return comment;
}

// PATCH /api/posts/:postId/comments/:commentId (signed in only, and only your own comment)

const updateComment = async (req, res) => {
  const comment = await findMyComment(req);
  comment.body = readCommentBody(req.body);
  await comment.save();
  await comment.populate("authorId", "username");
  res.status(200).json(comment);
};

// DELETE /api/posts/:postId/comments/:commentId (signed in, ONLY your own comment)
const deleteComment = async (req, res) => {
  const comment = await findMyComment(req);
  await comment.deleteOne();
  res.status(204).end();
};

export default { getComments, createComment, updateComment, deleteComment };
