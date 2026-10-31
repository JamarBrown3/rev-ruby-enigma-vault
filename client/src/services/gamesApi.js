// Game routes (server/routes/games.js). Reading is public; writing is admin only.
// Same five functions as my video_gameStore GamesAPI.js.
import { request } from "./request.js";

export const GAMES_PER_PAGE = 24; // matches `limit` in server/controllers/games.js

const list = (page = 1) => request("GET", `/api/games?page=${page}`);
const get = (id) => request("GET", `/api/games/${encodeURIComponent(id)}`);
const create = (fields) => request("POST", "/api/games", fields);
const update = (id, fields) => request("PATCH", `/api/games/${encodeURIComponent(id)}`, fields);
const remove = (id) => request("DELETE", `/api/games/${encodeURIComponent(id)}`);

export default { list, get, create, update, remove };
