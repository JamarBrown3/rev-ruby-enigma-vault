// Load environment variables from .env file, where API keys and passwords are configured.
import dotenv from "dotenv";
// Load environment variables from .env file, where API keys and passwords are configured.
import { fileURLToPath } from "node:url";

// Load environment variables from .env file, where API keys and passwords are configured.
// Resolve .env relative to this file, not the terminal's working directory.
// Existing deployment environment variables take precedence over .env.
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

// REad and validate the MongoDB connection settings.
// This doesn not connect to the MongoDB database yet.
export function getDatabaseConfig() {
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB_NAME?.trim();

  // Accept either supported MongoDB connection-string scheme.
  const validScheme =
    uri?.startsWith("mongodb://") || uri?.startsWith("mongodb+srv://");

  if (!validScheme) {
    throw new Error("Set a valid MONGODB_URI in server/.env.");
  }

  // REV's naming policy: letters, numbers, underscores,
  // and hyphens only.
  if (!dbName || !/^[a-zA-Z0-9_-]+$/.test(dbName)) {
    throw new Error(
      "MONGODB_DB_NAME must contain only letters, numbers, underscores, and hyphens.",
    );
  }

  // Return only the settings the database module needs.
  return { uri, dbName };
}

// Environment variables are strings.
// Convert the port to a number and validate it.

export function getPort() {
  const port = Number(process.env.PORT || 3002);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

// REV-SEC-06 (added 2026-10-26): how many reverse proxies sit in front of the API.
//
// On Render, every visitor's request arrives through Render's proxy. If Express
// is not told about that proxy, EVERY visitor appears to come from the proxy's
// single IP address. Every per-IP rate limit then becomes one shared limit for
// the whole website: in testing, a bot's 20 bad logins locked a different,
// real user out with 429. (Secure cookies also need this setting behind a proxy.)
//
// So production now refuses to start until you choose a value:
//   TRUST_PROXY_HOPS=1   Render (one proxy)
//   TRUST_PROXY_HOPS=2   Render behind Cloudflare, or a Netlify /api proxy (check)
//   TRUST_PROXY_HOPS=0   no proxy at all
// Never set a number higher than the real number of proxies: visitors could then
// fake their IP address with an X-Forwarded-For header and dodge rate limits.
export function getTrustProxy(env = process.env) {
  const raw = env.TRUST_PROXY_HOPS?.trim();

  if (!raw) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "Set TRUST_PROXY_HOPS in production (1 on Render, 0 if there is no proxy).",
      );
    }
    return false; // local development: trust no forwarded headers
  }

  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) {
    throw new Error("TRUST_PROXY_HOPS must be a whole number from 0 to 3.");
  }
  return hops === 0 ? false : hops;
}
