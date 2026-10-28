import http from "node:http";
import { createApp } from "./app.js";
// REV-SEC-06: getTrustProxy validates TRUST_PROXY_HOPS (required in production).
import { getPort, getTrustProxy } from "./config/env.js";
import mongoose from "mongoose";
import { createAuth } from "./security/auth.js";
import { createAuthService } from "./services/authService.js";
import {
  connectDatabase,
  pingDatabase,
  disconnectDatabase,
  explainDatabaseError,
} from "./config/database.js";

let server;
let stopping = false;

// REV-SEC-11 (added 2026-10-26): limits for slow or stalled clients.
// A "Slowloris" bot opens connections and sends its request a few bytes at a
// time so the server keeps waiting. With Node's defaults a test client held a
// connection for over 70 seconds; with these settings it is cut off with
// "408 Request Timeout" after about 20-25 seconds.
const HTTP_LIMITS = {
  headersTimeout: 20_000, // the request headers must arrive within 20 s
  requestTimeout: 30_000, // the whole request must arrive within 30 s
  connectionsCheckingInterval: 5_000, // how often Node checks those deadlines
};
// Render's proxy keeps idle connections open for up to 120 s. Node must keep
// them slightly longer, or the proxy sometimes reuses a connection Node just
// closed and the visitor sees a random 502 error.
const PRODUCTION_KEEP_ALIVE_MS = 121_000;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  // Bound shutdown if a client holds an HTTP connection open.
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  } finally {
    clearTimeout(timer);
  }
}

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });

// REV-SEC-06: remember which startup step failed. Before, EVERY startup error
// (including "Set a strong SESSION_SECRET") was printed as a MongoDB
// connection problem, which hid the real cause. Database errors still go
// through explainDatabaseError so connection strings are never printed.
let stage = "configuration";

try {
  const port = getPort();
  // REV-SEC-06: replaces the old inline TRUST_PROXY_HOPS parsing; production
  // now refuses to start without an explicit value.
  const trustProxy = getTrustProxy();

  stage = "database";
  await connectDatabase();
  await pingDatabase();
  // Do not accept registrations before unique account/token indexes exist.
  await Promise.all([mongoose.model("User").init(), mongoose.model("PasswordResetToken").init()]);
  console.log("MongoDB connection and ping succeeded.");

  stage = "authentication setup";
  const service = createAuthService({ resetOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173" });
  const auth = createAuth({ connection: mongoose.connection, service });
  // REV-SEC-24: establish shared-counter expiry before accepting logins.
  await auth.ready();
  if (!process.env.SESSION_SECRET) console.warn("Development sessions use a temporary signing key; restarting requires signing in again. Set SESSION_SECRET before deployment.");
  // REV-SEC-09: two-step codes for the admin account can't be checked without the key.
  if (!service.mfaConfigured) console.warn("ADMIN_MFA_KEY is not set: an admin account with two-step sign-in turned on cannot sign in until it is.");

  stage = "HTTP server";
  // REV-SEC-11: create the HTTP server with the slow-client limits above.
  // FUTURE ROUTES: pass mountRoutes to createApp, e.g.
  //   createApp({ auth, trustProxy, mountRoutes: (app) => app.use("/api/posts", postRoutes) })
  server = http.createServer(HTTP_LIMITS, createApp({ auth, trustProxy }));
  if (process.env.NODE_ENV === "production") server.keepAliveTimeout = PRODUCTION_KEEP_ALIVE_MS;
  server.listen(port, process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1", () => {
    console.log(`REV API listening on port ${port}.`);
  });
  server.on("error", async (error) => {
    console.error(error.code === "EADDRINUSE"
      ? "Port is already in use. Choose another PORT in server/.env."
      : "HTTP server failed to start.");
    process.exitCode = 1;
    await shutdown();
  });
} catch (error) {
  // REV-SEC-06: our own configuration messages are safe to print as written.
  console.error(
    `Startup failed during ${stage}:`,
    stage === "database" ? explainDatabaseError(error) : error.message,
  );
  process.exitCode = 1;
  await disconnectDatabase();
}
