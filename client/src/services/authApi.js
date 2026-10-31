// Sign-in routes from server/security/auth.js.
import { api } from "../api.js";
import { request } from "./request.js";

// GET /api/auth/me -> the signed-in user ({ id, username, role }) or null.
async function me() {
  const result = await api("GET", "/api/auth/me");
  if (result.status === 401) return null; // not signed in = a visitor
  if (!result.ok) throw new Error("Couldn't check your session.");
  return result.data.user;
}

// The admin account must also send `code` (6 digits). Everyone else leaves it out.
async function login({ email, password, code }) {
  const body = { email, password };
  if (code) body.code = code;
  const data = await request("POST", "/api/auth/login", body);
  return data.user;
}

// 202 means "request received". It doesn't prove a new account was created
// (so nobody can use this form to find out which emails are registered).
async function register({ username, email, password }) {
  return request("POST", "/api/auth/register", { username, email, password });
}

async function logout() {
  return request("POST", "/api/auth/logout", {});
}

export default { me, login, register, logout };
