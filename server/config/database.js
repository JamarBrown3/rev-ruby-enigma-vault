import mongoose from "mongoose";
import { getDatabaseConfig } from "./env.js";
import { assertApplicationRoles } from "../security/databaseAccess.js";

export async function connectDatabase() {
  const { uri, dbName } = getDatabaseConfig();

  // Mongoose includes the MongoDB driver. Wait for the connection before
  // listening for requests; do not pretend the database is ready early.
  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 10000,
    maxPoolSize: 5,
  });
  const status = await mongoose.connection.db.admin().command({ connectionStatus: 1 });
  assertApplicationRoles(status.authInfo, dbName);
}

export async function pingDatabase() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Database unavailable.");
  }
  const result = await mongoose.connection.db.command(
    { ping: 1 },
    { maxTimeMS: 3000 },
  );
  if (result.ok !== 1) throw new Error("Database ping failed.");
  return true;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

// Do not print raw driver errors: they may contain connection information.
export function explainDatabaseError(error) {
  if (error?.code === "EXCESS_DATABASE_PRIVILEGES") {
    return "Use a database account with only readWrite on the configured application database; broad administrator credentials are refused.";
  }
  if (error?.code === 18 || error?.codeName === "AuthenticationFailed") {
    return "MongoDB authentication failed. Check the database user's credentials locally.";
  }
  if (error?.code === 13 || error?.codeName === "Unauthorized") {
    return "MongoDB denied this operation. Check the database user's permissions.";
  }
  if (error?.name === "MongooseServerSelectionError") {
    return "MongoDB is unreachable. Check Atlas status, your IP access list, DNS, and connection settings.";
  }
  if (!process.env.MONGODB_URI?.trim()) {
    return "MONGODB_URI is missing. Enter it privately in server/.env.";
  }
  return "MongoDB connection/check failed. Check the URI, database name, credentials, and Atlas access settings locally.";
}
