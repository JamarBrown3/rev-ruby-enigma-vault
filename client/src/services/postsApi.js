// Post routes (server/routes/posts.js). Reading is public; writing needs a
// signed-in member, and only the author can edit or delete a post.
import { request } from "./request.js";

export const POSTS_PER_PAGE = 20; // matches `limit` in server/controllers/posts.js

function list({ page = 1, gameId } = {}) {
  const query = new URLSearchParams({ page: String(page) });
  if (gameId) query.set("gameId", gameId);
  return request("GET", `/api/posts?${query}`);
}

const get = (id) => request("GET", `/api/posts/${encodeURIComponent(id)}`);
const create = (fields) => request("POST", "/api/posts", fields);
const update = (id, fields) => request("PATCH", `/api/posts/${encodeURIComponent(id)}`, fields);
const remove = (id) => request("DELETE", `/api/posts/${encodeURIComponent(id)}`);

export default { list, get, create, update, remove };
