import { createApp } from "./app.js";
import { getPort } from "./config/env.js";
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

try {
  const port = getPort();
  await connectDatabase();
  await pingDatabase();
  // Do not accept registrations before unique account/token indexes exist.
  await Promise.all([mongoose.model("User").init(), mongoose.model("PasswordResetToken").init()]);
  console.log("MongoDB connection and ping succeeded.");

  const service = createAuthService({ resetOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173" });
  const auth = createAuth({ connection: mongoose.connection, service });
  if (!process.env.SESSION_SECRET) console.warn("Development sessions use a temporary signing key; restarting requires signing in again. Set SESSION_SECRET before deployment.");
  const trustProxy = process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : false;
  if (trustProxy !== false && (!Number.isInteger(trustProxy) || trustProxy < 1 || trustProxy > 3)) throw new Error("Invalid proxy configuration.");
  server = createApp({ auth, trustProxy }).listen(port, process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1", () => {
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
  console.error("Startup failed:", explainDatabaseError(error));
  process.exitCode = 1;
  await disconnectDatabase();
}
