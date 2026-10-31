// Shared response handling, same idea as readResponse() in my video_gameStore
// GamesAPI.js: return the data when the request worked, otherwise throw an Error
// with the server's message so the page can show it.
import { api } from "../api.js";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status; // 0 = couldn't reach the server at all
  }
}

// When the server says "not signed in" (401) anywhere except the login form,
// the session has ended (expired, or logged out in another tab). Tell the
// AuthContext so the header stops showing a username.
export const SIGNED_OUT_EVENT = "rev:signed-out";

export async function request(method, path, body) {
  let result;
  try {
    result = await api(method, path, body);
  } catch {
    throw new ApiError(0, "Can't reach the REV server. Check your connection and try again.");
  }

  if (!result.ok) {
    if (result.status === 401 && path !== "/api/auth/login") {
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
      throw new ApiError(401, "Your session ended. Log in again to continue.");
    }
    const fromServer = result.data && typeof result.data === "object" ? result.data.error : "";
    throw new ApiError(result.status, fromServer || `Request failed (${result.status}).`);
  }
  return result.data;
}

// A friendly message for errors on forms. Pages pass in their own wording for
// the statuses they care about, e.g. { 401: "Wrong email or password." }.
export function messageFor(error, overrides = {}) {
  if (error instanceof ApiError && overrides[error.status]) return overrides[error.status];
  if (error instanceof ApiError && error.status === 429) {
    return "Too many tries in a short time. Wait a few minutes, then try again.";
  }
  return error.message || "Something went wrong. Try again.";
}
