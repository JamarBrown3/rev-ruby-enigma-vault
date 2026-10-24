import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pingDatabase } from "./config/database.js";
import { HttpError, rejectUnsafeJson } from "./security/input.js";

// Separating app creation from app.listen makes HTTP behavior testable
// without needing a live Atlas cluster for every unit test.
export function createApp({
  checkDatabase = pingDatabase,
  clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173",
  auth = null,
  trustProxy = false,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  // Configure proxy trust explicitly in deployment; never trust arbitrary
  // X-Forwarded-* headers merely because the client sends them.
  app.set("trust proxy", trustProxy);
  app.use(helmet());
  // Only the configured frontend gets credentialed CORS response headers.
  // CORS is a browser policy, NOT a replacement for authentication or CSRF checks.
  app.use(cors({
    origin(origin, callback) {
      callback(null, origin === clientOrigin);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: "100kb" }));
  app.use(rejectUnsafeJson);

  if (auth) {
    app.use(auth.sessionMiddleware);
    app.use("/api/auth", auth.router);
    // Dashboard/content routes are still a future feature, but their prefixes
    // cannot accidentally become public when added later.
    app.use(["/api/admin", "/api/dashboard"], auth.requireAdmin);
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
    res.status(500).json({ error: "An unexpected server error occurred." });
  });

  return app;
}
