import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve .env relative to this file, not the terminal's working directory.
// Existing deployment environment variables take precedence over .env.
dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

export function getDatabaseConfig() {
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB_NAME?.trim();

  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error("Set a valid MONGODB_URI in server/.env.");
  }
  if (!dbName || /[\/\\. "$*<>:|?\u0000]/.test(dbName)) {
    throw new Error("Set a valid MONGODB_DB_NAME in server/.env.");
  }
  return { uri, dbName };
}

export function getPort() {
  const port = Number(process.env.PORT || 3002);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }
  return port;
}
