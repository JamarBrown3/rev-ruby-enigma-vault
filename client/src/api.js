// One helper for every call to the REV backend.
// It handles the two things that made Postman painful:
//   1. The session cookie: the browser stores and sends it automatically
//      (credentials: "same-origin").
//   2. The CSRF token: fetched once, sent as X-CSRF-Token on every
//      POST/PATCH/DELETE, and swapped for the new one the server returns at login.
// Pages don't call this directly; they use the small files in src/services/.

let csrfToken = null;

// The exact message the server sends when the CSRF token doesn't match the session
// (security/auth.js). Usually it means the session expired or was replaced.
const CSRF_FAILED = "Refresh the form and try again.";

export async function refreshCsrf() {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin" });
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function send(method, path, body, options) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const isWrite = method !== "GET";
  if (isWrite && !options.skipCsrf) {
    if (!csrfToken) await refreshCsrf();
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Some replies (204 No Content) have no body, so read text first.
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // Login hands back a NEW token (the old one stops working). Keep it.
  if (data && typeof data === "object" && data.csrfToken) csrfToken = data.csrfToken;
  // After logout the session is gone, so the token is useless too.
  if (path === "/api/auth/logout" && response.ok) csrfToken = null;

  return { status: response.status, ok: response.ok, data };
}

// api("POST", "/api/games", { title: "..." })  ->  { status, ok, data }
// options.skipCsrf = true sends the request WITHOUT the token (only the route
// tester uses it, to prove the server blocks that). Never use it in real pages.
export async function api(method, path, body, options = {}) {
  const result = await send(method, path, body, options);

  // If the session expired, the old token stops matching. Get a fresh token and
  // try once more. (Only this site's own JavaScript can read the token, so a
  // retry here doesn't help an attacker on another site.)
  const tokenRejected =
    result.status === 403 && result.data && result.data.error === CSRF_FAILED;
  if (tokenRejected && method !== "GET" && !options.skipCsrf) {
    await refreshCsrf();
    return send(method, path, body, options);
  }
  return result;
}
