import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { pingDatabase } from "./config/database.js";
// REV-SEC-13: rejectUnsafeQuery checks the URL query string the way
// rejectUnsafeJson already checks JSON bodies.
import { HttpError, rejectUnsafeJson, rejectUnsafeQuery } from "./security/input.js";

// Separating app creation from app.listen makes HTTP behavior testable
// without needing a live Atlas cluster for every unit test.
export function createApp({
  checkDatabase = pingDatabase,
  clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173",
  auth = null,
  trustProxy = false,
  // REV-SEC-05: requests allowed per visitor IP per 5 minutes, across the whole API.
  globalRateLimitMax = 300,
  // REV-SEC-18: a function that adds your future routers, e.g.
  //   mountRoutes: (app) => { app.use("/api/posts", postRoutes); }
  // It runs AFTER all the security middleware below and BEFORE the 404 handler.
  mountRoutes = null,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  // Configure proxy trust explicitly in deployment; never trust arbitrary
  // X-Forwarded-* headers merely because the client sends them.
  app.set("trust proxy", trustProxy);
  // REV-SEC-13: lock in Express 5's "simple" query parser. It never builds
  // nested objects, so ?email[$ne]=x stays a harmless literal key. (The
  // "extended" parser would turn it into { email: { $ne: "x" } }.)
  app.set("query parser", "simple");

  // REV-SEC-15 (added 2026-10-26): give every request a random ID. It is sent
  // back in the X-Request-Id header and printed with any server error, so you
  // can match a user's "something went wrong" to the right log line. An ID
  // supplied by the client is ignored (it could be used to fake log entries).
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set("X-Request-Id", req.id);
    next();
  });

  app.use(helmet());

  // REV-SEC-23: compare against the normalized origin (scheme://host:port),
  // matching what security/auth.js does. Before, a CLIENT_ORIGIN written with
  // a trailing slash ("https://site.netlify.app/") silently blocked the real
  // frontend, because browsers never send that slash in the Origin header.
  const allowedOrigin = new URL(clientOrigin).origin;

  // Only the configured frontend gets credentialed CORS response headers.
  // CORS is a browser policy, NOT a replacement for authentication or CSRF checks.
  app.use(cors({
    origin(origin, callback) {
      callback(null, origin === allowedOrigin);
    },
    credentials: true,
  }));

  // REV-SEC-05 (added 2026-10-26): one overall speed limit for every visitor IP,
  // in addition to the stricter login/register/reset limits in auth.js. It
  // runs before the body is read or the database is touched, so a flooding
  // bot is turned away cheaply. It comes AFTER cors() so the website can
  // still read the 429 response. /api/health is skipped so the hosting
  // provider's health checks never get the server marked as "down".
  // This limit lives in this server's memory: it resets on restart and is
  // per server instance. Large floods (DDoS) must be stopped before they
  // reach Render, for example by Cloudflare. See the security report.
  app.use(rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: globalRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.path === "/api/health",
    message: { error: "Too many requests. Please slow down and try again shortly." },
  }));

  // REV-SEC-16: API answers may contain private data, so browsers, proxies,
  // and CDNs must never store them. (Auth routes already did this; now every
  // /api route does.) A future PUBLIC, cacheable route can override it.
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.use(express.json({ limit: "100kb" }));
  app.use(rejectUnsafeJson);
  // REV-SEC-13: operator-looking or oversized query parameters are refused.
  app.use(rejectUnsafeQuery);

  if (auth) {
    app.use(auth.sessionMiddleware);
    // REV-SEC-26: protect every unsafe API method BEFORE auth or future routers.
    app.use("/api", auth.csrfForMutations);
    app.use("/api/auth", auth.router);
    // Dashboard/content routes are still a future feature, but their prefixes
    // cannot accidentally become public when added later.
    app.use(["/api/admin", "/api/dashboard"], auth.requireAdmin);
    // REV-SEC-18 (added 2026-10-26): areas for ANY signed-in account.
    //   /api/account : a member's own profile, posts, settings
    //   /api/demo    : the visitor "try my dashboard + AI summary + PDF" demo.
    //                  Requiring an account keeps bots from spending your AI
    //                  credits (see services/aiUsageService.js).
    // Put each future router under the right prefix and it is protected
    // automatically.
    app.use(["/api/account", "/api/demo"], auth.requireAuth);
  }

  app.get("/", (req, res) => {
    res.json({ message: "REV API is running." });
  });

  // Liveness checks Express. Readiness below also checks MongoDB.
  app.get("/api/health", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ status: "ok", service: "rev-api" });
  });

  app.get("/api/health/database", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await checkDatabase();
      res.json({ status: "ok", database: "connected" });
    } catch {
      // Never expose the URI, password, server address, or driver stack.
      res.status(503).json({ status: "error", database: "unavailable" });
    }
  });

  // REV-SEC-18: future routers plug in here, behind every protection above.
  // Routes are refused without authentication middleware, so a test or a
  // mistake can never run them with the admin/account guards missing.
  if (mountRoutes) {
    if (!auth) throw new Error("mountRoutes requires authentication middleware (auth).");
    mountRoutes(app, { auth });
  }

  app.use((req, res) => {
    res.status(404).json({ error: "Route not found." });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large." });
    }
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON request body." });
    }
    // REV-SEC-15: other problems with the REQUEST itself (unsupported charset
    // or compression, an aborted upload) are the client's mistake: 4xx, not
    // 500. Their messages come from body-parser and are marked safe to show.
    if (error.expose === true && Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
      return res.status(error.status).json({ error: "The request could not be processed." });
    }
    // REV-SEC-15: database validation/cast errors mean the submitted data was
    // invalid. Answer 400 without echoing field values or schema details.
    if (["ValidationError", "CastError", "StrictModeError"].includes(error.name)) {
      return res.status(400).json({ error: "The request contains invalid data." });
    }
    // REV-SEC-15: log unexpected errors on the server WITHOUT the request body
    // (it may contain passwords) and without the message in production
    // (MongoDB messages can include emails, e.g. duplicate-key errors).
    console.error(JSON.stringify({
      level: "error",
      requestId: req.id,
      method: req.method,
      path: req.path,
      name: error?.name,
      code: error?.code,
      ...(process.env.NODE_ENV === "production" ? {} : { stack: error?.stack }),
    }));
    res.status(500).json({ error: "An unexpected server error occurred.", requestId: req.id });
  });

  return app;
}
