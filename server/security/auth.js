import { Router } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { rateLimit } from "express-rate-limit";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { createAuthService } from "../services/authService.js";

import { HttpError, publicUser, parseLogin, parseRecovery } from "./input.js";
import { createAccountLoginLimiter } from "./accountLoginLimit.js";

// server.js supplies the real MongoDB connection and service.
// Test can supply isolated substitutes.

// Return a router, session middleware, access checks, and cookie settings.
export function createAuth({
  connection,
  service = createAuthService(),
  store,
  secret = process.env.SESSION_SECRET,
  production = process.env.NODE_ENV === "production",
  clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173",
  sameSite = process.env.SESSION_SAME_SITE || "strict",
  rateLimitMax = 20,
  // Server-injected alternatives are for isolated tests, never request input.
  accountLoginLimiter,
  loginAccountCollection = connection?.db?.collection("loginAccountLimits"),
  accountLoginLimit = 20,
} = {}) {
  /* SECTION 1: Validate configuration parameters to ensure they meet
   security and operational requirements. */
  // Development fallback only for now.
  // Restarting changes this temporary key.

  // Generate a temporary signing key only when it is missing in development.
  // The separate check below rejects a missing production key.
  if (!secret && !production) {
    secret = randomBytes(32).toString("hex");
    console.warn(
      "Warning: Using a temporary session secret. Restarting the server will invalidate all sessions.",
    );
  }

  // Reject a missing, non-text, or too-short signing key.
  // Length alone does not prove randomness; generate production secrets securely.
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw new Error(
      "Set a strong SESSION_SECRET before deploying authentication.",
    );
  }

  // Validate the SameSite configuration for session cookies.
  if (
    !["strict", "lax", "none"].includes(sameSite) ||
    (sameSite === "none" && !production)
  ) {
    throw new Error("Invalid sessions SameSite configuration.");
  }

  // Normalize the configured frontend URL for Origin comparisons.
  const allowedOrigin = new URL(clientOrigin).origin;

  // Production authentication requires and must use an HTTPS frontend origin.
  if (production && !allowedOrigin.startsWith("https://")) {
    throw new Error(
      "Production authentication requires a HTTPS frontend origin.",
    );
  }
  // Require a supplied store or a connection from which to create a store.
  // A supplied test store may be in memory; production uses MongoDB here.
  if (!store && !connection) {
    throw new Error("Authentication requires a persistent session store.");
  }

  // SECTION 2: Configure persistent sessions.

  // Reuse the already-connected MongoDB client.
  store ||= MongoStore.create({
    client: connection.getClient(),
    dbName: connection.name,
    collectionName: "sessions",
    ttl: 1800,
    touchAfter: 60,
  });

  // Set the session cookie name based on the environment.
  // name the cookie with the "__Host-" prefix to enforce secure cookie attributes in production.
  const name = production ? "__Host-rev.sid" : "rev.sid";

  // Configure the session cookie with security settings.
  const cookie = {
    httpOnly: true,
    secure: production,
    sameSite,
    path: "/",
    maxAge: 30 * 60 * 1000,
  };

  // Create the session middleware with the configured options.
  const sessionMiddleware = session({
    name,
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie,
  });

  const router = Router();

  // REV-SEC-24: count known and unknown addresses identically, before hashing.
  accountLoginLimiter ||= createAccountLoginLimiter({
    collection: loginAccountCollection,
    secret,
    limit: accountLoginLimit,
  });

  async function limitAccountLogin(req, res, next) {
    try {
      req.loginInput = parseLogin(req.body);
      const result = await accountLoginLimiter.consume(req.loginInput.email);
      if (!result.allowed) {
        res.set("Retry-After", String(result.retryAfter));
        throw new HttpError(429, "Too many attempts. Please try again later.");
      }
      next();
    } catch (error) {
      next(error);
    }
  }

  // SECTION 3: Limit repeated authentication requests.

  // Seperate instances create separate endpoint counters.

  // Limit repeated requests per IP; this reduces abuse but does not stop all bots.
  const makeLimit = () =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: rateLimitMax,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "Too many attempts. Please try again later.",
      },
    });

  // Create separate rate limiters for login, registration, and password reset endpoints to prevent abuse.
  const loginLimit = makeLimit();
  const registerLimit = makeLimit();
  const resetLimit = makeLimit();

  // Create a rate limiter for CSRF token requests to prevent abuse.
  const csrfLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many attempts. Please try again later.",
    },
  });

  const recoveryAccountLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 3,

    // avoid using raw email addresses as counter keys.
    keyGenerator: (req) => {
      return createHash("sha256").update(req.recoveryInput.email).digest("hex");
    },

    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Too many attempts. Please try again later.",
    },
  });

  // SECTION 4: KEEP recovery work bounded.

  // This queue is local to one running Node process.
  // A scaled deployment needs a durable worker and shared limits.
  const recoveryQueue = [];
  let recoveryWorking = false;

  // Process queued password-recovery requests one at a time to avoid overwhelming the email service.
  async function drainRecovery() {
    if (recoveryWorking) return;

    recoveryWorking = true;
    // try to process all queued recovery requests, handling any errors that occur during processing.
    try {
      while (recoveryQueue.length) {
        const input = recoveryQueue.shift();
        // Attempt to process the password recovery request using the provided input.
        try {
          await service.requestReset(input);
        } catch {
          console.warn("A queued password-recovery could not be completed.");
        }
      }
      // Always release the worker flag, including after an error.
    } finally {
      recoveryWorking = false;
    }
  }

  // SECTION 5: Apply authentication-response protections.

  // Prevent caching of sensitive authentication responses and enforce a strict referrer policy to enhance security.
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });

  // Reject a supplied Origin that differs from the configured frontend origin.
  // Requests without Origin are not rejected here; this is not authentication.
  router.use((req, res, next) => {
    const origin = req.get("Origin");

    if (origin && origin !== allowedOrigin) {
      return next(new HttpError(403, "Request origin is not allowed."));
    }
    next();
  });

  // SECTION 6: Validate CSRF tokens.

  // Express middleware: inspect CSRF token before routes use it.
  function csrf(req, res, next) {
    const supplied = req.get("X-CSRF-Token");
    const expected = req.session?.csrfToken;

    // Reject missing, malformed, or mismatched CSRF tokens.
    // A valid token is not proof that the requester is human.
    if (
      typeof supplied !== "string" ||
      typeof expected !== "string" ||
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !/^[a-f0-9]{64}$/.test(expected) ||
      supplied.length !== expected.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    ) {
      return next(new HttpError(403, "Refresh the form and try again."));
    }
    next();
  }

  // REV-SEC-26: future API mutations are protected even if their router forgets
  // to add csrf itself. GET/HEAD/OPTIONS must remain read-only in route code.
  function csrfForMutations(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("Origin");
    if (origin && origin !== allowedOrigin) {
      return next(new HttpError(403, "Request origin is not allowed."));
    }
    return csrf(req, res, next);
  }

  // SECTION 7: Authenticate the current request.

  // Express middleware: inspect session before routes use it.
  async function requireAuth(req, res, next) {
    try {
      const auth = req.session?.auth;
      if (
        !auth ||
        typeof auth.userId !== "string" ||
        !/^[a-f0-9]{24}$/.test(auth.userId) ||
        !Number.isSafeInteger(auth.sessionVersion) ||
        !Number.isFinite(auth.authenticatedAt) ||
        Date.now() - auth.authenticatedAt > 8 * 60 * 60 * 1000
      ) {
        throw new HttpError(401, "Please sign in.");
      }

      // Re-check the actual account, not a browswer-supplied role.
      const user = await service.UserModel.findById(auth.userId);
      // If the user is not found, inactive, or has a different session version than the one stored in the session, destroy the session and clear the cookie to force re-authentication.
      if (
        !user ||
        user.status !== "active" ||
        user.sessionVersion !== auth.sessionVersion
      ) {
        await new Promise((resolve, reject) => {
          req.session.destroy((error) => (error ? reject(error) : resolve()));
        });

        // Remove this matching browser cookie after invalidating the server session.
        // Cookie removal does not erase logs or remove every trace of a session.
        res.clearCookie(name, {
          httpOnly: true,
          secure: production,
          sameSite,
          path: "/",
        });
        throw new HttpError(401, "Please sign in.");
      }
      // If the user is found and valid, attach the user object to the request
      // for use in subsequent middleware or route handlers, and call next() to proceed.
      req.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  }

  // Authenticate first, then check administrative privileges.
  // Check the administrator role only after the session/account is authenticated.
  async function requireAdmin(req, res, next) {
    return requireAuth(req, res, (error) => {
      if (error) return next(error);

      // request authorized user and sees if they have the "admin" role.
      //  If not, return a 403 error to indicate that administrative access is required.
      // REV-SEC-25: database role alone is insufficient. This exact session
      // must have signed in AS an administrator and passed the MFA check.
      // Bind proof to enrollment so disabling/re-enrolling invalidates it.
      const auth = req.session.auth;
      const enabledAt = new Date(req.authUser.mfa?.enabledAt ?? 0).getTime();
      if (
        req.authUser.role !== "admin" ||
        auth.roleAtLogin !== "admin" ||
        auth.mfaVerified !== true ||
        !Number.isFinite(enabledAt) || enabledAt <= 0 ||
        auth.mfaEnabledAt !== enabledAt
      ) {
        return next(new HttpError(403, "Administrative access is required."));
      }
      next();
    });
  }

  // SECTION 8: Authentication routes.

  // Provide a CSRF token for forms that require it, generating one if it doesn't already exist in the session.
  router.get("/csrf", csrfLimit, (req, res) => {
    req.session.csrfToken ||= randomBytes(32).toString("hex");

    res.json({
      csrfToken: req.session.csrfToken,
    });
  });

  // Return the currently authenticated user's public information, if any, or an error if the user is not authenticated.
  router.get("/me", requireAuth, (req, res) => {
    res.json({
      user: publicUser(req.authUser),
    });
  });

  // Delegate registration to the service and return generic feedback.
  // A 202 response does not prove that a new account was created.
  router.post("/register", registerLimit, csrf, async (req, res) => {
    await service.register(req.body);

    res.status(202).json({
      message: "Registration request received. You can try signing in.",
    });
  });

  // Accept a login request, validate it, and create a new session if the credentials are correct. Rate-limited to prevent brute-force attacks.
  router.post("/login", loginLimit, csrf, limitAccountLogin, async (req, res) => {
    // The service creates assurance only after actually verifying the code.
    // It is never copied from req.body or a role/MFA flag in the database.
    const { user, mfaVerified, mfaEnabledAt } = await service.authenticate(req.loginInput);

    // Replace the pre-login session identifier.
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });

    req.session.auth = {
      userId: user._id.toString(),
      sessionVersion: user.sessionVersion,
      authenticatedAt: Date.now(),
      roleAtLogin: user.role,
      mfaVerified: mfaVerified === true,
      mfaEnabledAt,
    };

    // The old session's CSRF token is no longer used.
    req.session.csrfToken = randomBytes(32).toString("hex");

    // Finish saving before the next request uses the session.
    await new Promise((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });

    // Return the authenticated user's public information and a new CSRF token for subsequent requests.
    res.json({
      user: publicUser(user),
      csrfToken: req.session.csrfToken,
    });
  });

  // Accept a logout request, destroy the session, and clear the session cookie to log the user out.
  router.post("/logout", csrf, async (req, res) => {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });

    res.clearCookie(name, {
      httpOnly: true,
      secure: production,
      sameSite,
      path: "/",
    });

    res.json({
      message: "Signed out.",
    });
  });

  // Validate and enqueue recovery input when delivery is configured.
  // The worker must also be scheduled for queued requests to be processed.

  router.post(
    "/forgot-password",
    resetLimit,
    csrf,

    // Validate the body before the account-based limiter uses it.
    (req, res, next) => {
      try {
        req.recoveryInput = parseRecovery(req.body);
        next();
      } catch (error) {
        next(error);
      }
    },
    recoveryAccountLimit,
    (req, res) => {
      if (!service.recoveryEnabled) {
        throw new HttpError(503, "Password recovery is not configured yet.");
      }

      // Keep the process-local queue bounded.
      if (recoveryQueue.length >= 20) {
        throw new HttpError(429, "Too many attemps. Please try again later.");
      }
      recoveryQueue.push(req.recoveryInput);

      // Do not reveal whether this email belongs to an account.
      res.status(202).json({
        message: "If an account exists, a recovery email will be sent.",
      });

      // Start processing the queue after sending the response.
      setImmediate(() => {
        void drainRecovery();
      });
    },
  );

  // Accept a password reset request, validate it, and reset the user's password if the token is valid. Rate-limited to prevent abuse.
  router.post("/reset-password", resetLimit, csrf, async (req, res) => {
    await service.resetPassword(req.body);
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });

    // Remove the matching browser cookie after the server session is destroyed.
    res.clearCookie(name, {
      httpOnly: true,
      secure: production,
      sameSite,
      path: "/",
    });

    // Return a message indicating that the password has been changed and the user needs to sign in again.
    res.json({
      message: "Password changed. Please sign in again.",
    });
  });

  // SECTION 9: Return the router and middleware for use in the main application.
  return {
    router,
    sessionMiddleware,
    requireAuth,
    requireAdmin,
    csrf,
    csrfForMutations,
    ready: () => accountLoginLimiter.ready?.(),
    cookieOptions: {
      name,
      ...cookie,
    },
  };
}
