// Comment routes (server/routes/comments.js). Reading is public; writing needs a
// signed-in member, and only a comment's author can edit or delete it.

import { request } from "./request.js";

export const COMMENTS_PER_PAGE = 50; // matches `limit` in server/controllers/comments.js
export const COMMENT_MAX = 2000; // matches readCommentBody() on the server

// Every comment URL starts with the post it belongs to.
const base = (postId) => `/api/posts/${encodeURIComponent(postId)}/comments`;
const one = (postId, commentId) =>
  `${base(postId)}/${encodeURIComponent(commentId)}`;

const list = (postId, page = 1) =>
  request("GET", `${base(postId)}?page=${page}`); // returns an array of up to 50 comments, oldest first

const create = (postId, body) => request("POST", base(postId), { body }); // returns the new comment (with the author's username)

const update = (postId, commentId, body) =>
  request("PATCH", one(postId, commentId), { body }); // returns the updated comment

const remove = (postId, commentId) => request("DELETE", one(postId, commentId)); // returns nothing (204 No Content)

export default { list, create, update, remove };
