// Treat HTTP input as data, never as MongoDB filters or trusted account fields.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function assertSafeObject(value, depth = 0) {
  if (depth > 10) throw new HttpError(400, "Request body is too deeply nested.");
  if (value === null || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".") || ["__proto__", "constructor", "prototype"].includes(key)) {
      throw new HttpError(400, "Request body contains an unsupported field.");
    }
    assertSafeObject(value[key], depth + 1);
  }
}

export function rejectUnsafeJson(req, res, next) {
  try {
    if (req.body !== undefined) assertSafeObject(req.body);
    next();
  } catch (error) { next(error); }
}

function fields(body, allowed) {
  if (!body || Array.isArray(body) || Object.getPrototypeOf(body) !== Object.prototype) {
    throw new HttpError(400, "Send a JSON object.");
  }
  assertSafeObject(body);
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw new HttpError(400, "Request body contains an unsupported field.");
  }
}

function string(value, label, min, max, trim = false) {
  if (typeof value !== "string") throw new HttpError(400, `${label} must be text.`);
  const result = trim ? value.trim() : value;
  if (result.length < min || result.length > max) {
    throw new HttpError(400, `${label} must contain ${min} to ${max} characters.`);
  }
  return result;
}

export function readEmail(value) {
  const email = string(value, "Email", 3, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  return email;
}

export function readNewPassword(value) {
  // Do not trim or silently truncate passwords. Permit spaces and Unicode.
  return string(value, "Password", 15, 128);
}

export function parseRegistration(body) {
  fields(body, ["username", "email", "password"]);
  const username = string(body.username, "Username", 3, 35, true);
  if (/[\u0000-\u001f\u007f]/.test(username)) throw new HttpError(400, "Username contains an unsupported character.");
  return { username, email: readEmail(body.email), password: readNewPassword(body.password) };
}

export function parseLogin(body) {
  fields(body, ["email", "password"]);
  return { email: readEmail(body.email), password: string(body.password, "Password", 1, 128) };
}

export function parseRecovery(body) {
  fields(body, ["email"]);
  return { email: readEmail(body.email) };
}

export function readResetToken(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new HttpError(400, "Reset link is invalid or expired.");
  }
  return value;
}

export function parseReset(body) {
  fields(body, ["token", "newPassword"]);
  return { token: readResetToken(body.token), newPassword: readNewPassword(body.newPassword) };
}

export function publicUser(user) {
  // Explicit response allowlist; never return a saved User document directly.
  return { id: user._id.toString(), username: user.username, role: user.role };
}
