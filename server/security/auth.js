import { Router } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { rateLimit } from "express-rate-limit";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createAuthService } from "../services/authService.js";
import { HttpError, publicUser, parseRecovery } from "./input.js";

export function createAuth({
  connection, service = createAuthService(), store,
  secret = process.env.SESSION_SECRET,
  production = process.env.NODE_ENV === "production",
  clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173",
  sameSite = process.env.SESSION_SAME_SITE || "strict",
  rateLimitMax = 20,
} = {}) {
  if (!secret && !production) secret = randomBytes(32).toString("hex");
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) throw new Error("Set a strong SESSION_SECRET before deploying authentication.");
  if (!["strict", "lax", "none"].includes(sameSite) || (sameSite === "none" && !production)) throw new Error("Invalid session SameSite configuration.");
  const allowedOrigin = new URL(clientOrigin).origin;
  if (production && !allowedOrigin.startsWith("https://")) throw new Error("Production authentication requires an HTTPS frontend origin.");
  if (!store && !connection) throw new Error("Authentication requires a persistent session store.");
  store ||= MongoStore.create({ client: connection.getClient(), dbName: connection.name, collectionName: "sessions", ttl: 1800, touchAfter: 60 });
  const name = production ? "__Host-rev.sid" : "rev.sid";
  const cookie = { httpOnly: true, secure: production, sameSite, path: "/", maxAge: 30 * 60 * 1000 };
  const sessionMiddleware = session({ name, secret, store, resave: false, saveUninitialized: false, rolling: true, cookie });
  const router = Router();
  const limit = () => rateLimit({ windowMs: 15 * 60 * 1000, limit: rateLimitMax, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many attempts. Please try again later." } });
  const loginLimit = limit();
  const registerLimit = limit();
  const resetLimit = limit();
  const csrfLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many attempts. Please try again later." } });
  const recoveryAccountLimit = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 3,
    // Count existing and nonexistent addresses identically; do not store raw
    // email addresses in the rate-limit keys.
    keyGenerator: (req) => createHash("sha256").update(req.recoveryInput.email).digest("hex"),
    standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });
  const recoveryQueue = [];
  let recoveryWorking = false;
  async function drainRecovery() {
    if (recoveryWorking) return;
    recoveryWorking = true;
    try {
      while (recoveryQueue.length) {
        const input = recoveryQueue.shift();
        try { await service.requestReset(input); }
        catch { console.warn("A queued password-recovery request could not be completed."); }
      }
    } finally { recoveryWorking = false; }
  }
  router.use((req, res, next) => { res.set("Cache-Control", "no-store"); res.set("Referrer-Policy", "no-referrer"); next(); });
  router.use((req, res, next) => {
    const origin = req.get("Origin");
    if (origin && origin !== allowedOrigin) return next(new HttpError(403, "Request origin is not allowed."));
    next();
  });

  function csrf(req, res, next) {
    const supplied = req.get("X-CSRF-Token");
    const expected = req.session?.csrfToken;
    if (typeof supplied !== "string" || typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(supplied) || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return next(new HttpError(403, "Refresh the form and try again."));
    }
    next();
  }

  async function requireAuth(req, res, next) {
    try {
      const auth = req.session?.auth;
      if (!auth || typeof auth.userId !== "string" || !/^[a-f0-9]{24}$/.test(auth.userId) || !Number.isSafeInteger(auth.sessionVersion) || !Number.isFinite(auth.authenticatedAt) || Date.now() - auth.authenticatedAt > 8 * 60 * 60 * 1000) {
        throw new HttpError(401, "Please sign in.");
      }
      const user = await service.UserModel.findById(auth.userId);
      if (!user || user.status !== "active" || user.sessionVersion !== auth.sessionVersion) {
        await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
        res.clearCookie(name, { httpOnly: true, secure: production, sameSite, path: "/" });
        throw new HttpError(401, "Please sign in.");
      }
      req.authUser = user;
      next();
    } catch (error) { next(error); }
  }

  async function requireAdmin(req, res, next) {
    await requireAuth(req, res, (error) => {
      if (error) return next(error);
      if (req.authUser.role !== "admin") return next(new HttpError(403, "Administrator access is required."));
      next();
    });
  }

  router.get("/csrf", csrfLimit, (req, res) => {
    req.session.csrfToken ||= randomBytes(32).toString("hex");
    res.json({ csrfToken: req.session.csrfToken });
  });
  router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.authUser) }));
  router.post("/register", registerLimit, csrf, async (req, res) => {
    await service.register(req.body);
    res.status(202).json({ message: "Registration request received. You can try signing in." });
  });
  router.post("/login", loginLimit, csrf, async (req, res) => {
    const user = await service.login(req.body);
    // Prevent session fixation and discard the anonymous/pre-login session ID.
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    req.session.auth = { userId: user._id.toString(), sessionVersion: user.sessionVersion, authenticatedAt: Date.now() };
    req.session.csrfToken = randomBytes(32).toString("hex");
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  });
  router.post("/logout", csrf, async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie(name, { httpOnly: true, secure: production, sameSite, path: "/" });
    res.json({ message: "Signed out." });
  });
  router.post("/forgot-password", resetLimit, csrf, (req, res, next) => {
    try { req.recoveryInput = parseRecovery(req.body); next(); }
    catch (error) { next(error); }
  }, recoveryAccountLimit, (req, res) => {
    if (!service.recoveryEnabled) throw new HttpError(503, "Password recovery is not configured yet.");
    if (recoveryQueue.length >= 20) throw new HttpError(429, "Too many attempts. Please try again later.");
    // Respond before looking up the account or calling the mail provider. No
    // existence-dependent query/delivery delay is part of the HTTP response.
    // This bounded queue is single-process; use a durable worker/shared rate
    // limit store before scaling to multiple production instances.
    recoveryQueue.push(req.recoveryInput);
    res.status(202).json({ message: "If the account is eligible, password-reset instructions will be sent." });
    setImmediate(() => { void drainRecovery(); });
  });
  router.post("/reset-password", resetLimit, csrf, async (req, res) => {
    await service.resetPassword(req.body);
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie(name, { httpOnly: true, secure: production, sameSite, path: "/" });
    res.json({ message: "Password changed. Please sign in again." });
  });

  return { router, sessionMiddleware, requireAuth, requireAdmin, csrf, cookieOptions: { name, ...cookie } };
}
