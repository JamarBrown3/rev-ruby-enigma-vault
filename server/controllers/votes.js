// Imports: the Vote model, plus Post (to check the post exists).
import Vote from "../models/Vote.js";
import Post from "../models/Post.js";
import { HttpError } from "../security/input.js";
import { readObjectId, notFound } from "../security/access.js";

// SECTION 1 HELPER FUNCTIONS ---------

// A vote must be { "value": 1} (like) or {"value": -1} (dislike). Nothing else.

function readVoteValue(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Send a JSON object.");
  }

  // Only "value" is allowed. No userId or postId: those come from the session and the URL.
  const unknown = Object.keys(body).filter((key) => key !== "value");
  if (unknown.length)
    throw new HttpError(400, `Unsupported field: ${unknown[0]}`);

  // Strict check: the NUMBER 1 or -1. The text "1", true, 2, 0.5 are all refused.
  if (body.value !== 1 && body.value !== -1) {
    throw new HttpError(400, "Vote value must be 1 (like) or -1 (dislike).");
  }
  return body.value;
}

// The post from the URL must exist, or it's a 404.
async function readExistingPostId(value) {
  const postId = readObjectId(value);
  if (!(await Post.exists({ _id: postId }))) throw notFound();
  return postId;
}

// Count likes and dislikes for one post.
// SQL VERSION: SELECT COUNT(*) FROM votes WHERE post_id = $1 AND value = 1 (and again for -1)
async function countVotes(postId) {
  const [likes, dislikes] = await Promise.all([
    Vote.countDocuments({ postId, value: 1 }),
    Vote.countDocuments({ postId, value: -1 }),
  ]);
  return { likes, dislikes };
}

// The logged-in user's vote on this post: 1, -1, or null (hasn't voted).
async function readMyVote(postId, userId) {
  const vote = await Vote.findOne({ postId, userId }).select("value");
  return vote ? vote.value : null;
}

// SECTION 2 CONTROLLER FUNCTIONS ---------

// GET /api/posts/:postId/votes (anyone)
// Just the totals. Never shows WHO voted.
const getVotes = async (req, res) => {
  const postId = await readExistingPostId(req.params.postId);
  res.status(200).json(await countVotes(postId));
};

// GET /api/posts/:postId/votes/me (signed in)
// The totals plus YOUR vote, so the page can highlight the button you pressed.
const getMyVote = async (req, res) => {
  const postId = await readExistingPostId(req.params.postId);
  const myVote = await readMyVote(postId, req.authUser._id);
  res.status(200).json({ ...(await countVotes(postId)), myVote });
};

// PUT /api/posts/:postId/votes body: { "value": 1 } or { "value": -1 } (signed in)
// PUT = "set my vote to this". Voting again just changes it; you never get two votes.
// SQL VERSION: INSERT INTO votes (post_id, user_id) VALUES ($1, $2, $3)
// ON CONFLICT (post_id, user_id, value) DO UPDATE SET value = $3
const setVote = async (req, res) => {
  const postId = await readExistingPostId(req.params.postId);
  const value = readVoteValue(req.body);
  const userId = req.authUser._id; // from the session, never from the browser.

  const filter = { postId, userId };
  const update = { $set: { value } };
  const options = {
    upsert: true,
    returnDocument: "after",
    runValidators: true,
  };

  try {
    // upsert: update my vote if it exists, otherwise create it.
    await Vote.findOneAndUpdate(filter, update, options);
  } catch (error) {
    // Two clicks at the same instant can both try to CREATE. The unique index
    // (postId + userId) stops the second one with error 11000, so we just retry
    // once; this thime it finds the vote and updates it.
    if (error?.code !== 11000) throw error;
    await Vote.findOneAndUpdate(filter, update, options);
  }
  res.status(200).json({ ...(await countVotes(postId)), myVote: value });
};

// DELETE /api/posts/:postId/votes (signed in)
// Removes YOUR vote (clicking an already-pressed button "un-presses" it).
// Deleting a vote you don't have is fine: the result is the same.
const removeVote = async (req, res) => {
  const postId = await readExistingPostId(req.params.postId);
  await Vote.deleteOne({ postId, userId: req.authUser._id });
  res.status(200).json({ ...(await countVotes(postId)), myVote: null });
};

export default { getVotes, getMyVote, setVote, removeVote };
