// This is for liking and disliking posts and the Totals are public; voting needs to be a signed-in member.
// Every reply is {likes, dislikes} plus myVote when signed in.

import { request } from "./request.js";

// Get the current vote totals for a post
const base = (postId) => `/api/posts/${encodeURIComponent(postId)}/votes`;

const totals = (postId) => request("GET", base(postId)); // anyone
const mine = (postId) => request("GET", `${base(postId)}/me`); // signed-in member only
const set = (postId, value) => request("PUT", base(postId), { value }); // 1 or -1
const clear = (postId) => request("DELETE", base(postId)); // remove my vote

export default { totals, mine, set, clear };
