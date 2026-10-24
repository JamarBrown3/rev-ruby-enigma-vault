import { createHash, randomBytes } from "node:crypto";
import User from "../models/User.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import { HttpError, parseRegistration, parseLogin, parseRecovery, parseReset } from "../security/input.js";
import { hashPassword, verifyPassword } from "../security/passwords.js";

export const RESET_LIFETIME_MS = 15 * 60 * 1000;
export const tokenDigest = (token) => createHash("sha256").update(token).digest("hex");

export function createAuthService({
  UserModel = User, TokenModel = PasswordResetToken,
  connection = UserModel.db, deliverResetEmail = null,
  resetOrigin = "http://localhost:5173",
} = {}) {
  const origin = new URL(resetOrigin);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("Configure a trusted frontend origin for password recovery.");
  }

  async function register(body) {
    const { username, email, password } = parseRegistration(body);
    const passwordHash = await hashPassword(password);
    try {
      // Client role/status/hash/version fields are not accepted by the parser.
      await UserModel.create({ username, email, passwordHash, role: "user", status: "active", sessionVersion: 0 });
    } catch (error) {
      // Use the same public response for duplicate usernames/emails.
      if (error.code !== 11000) throw error;
    }
  }

  async function login(body) {
    const { email, password } = parseLogin(body);
    const user = await UserModel.findOne({ email }).select("+passwordHash");
    const matches = await verifyPassword(password, user?.passwordHash);
    if (!matches || !user || user.status !== "active" || !Number.isSafeInteger(user.sessionVersion)) {
      throw new HttpError(401, "Invalid credentials.");
    }
    return user;
  }

  async function requestReset(body) {
    const { email } = parseRecovery(body);
    if (!deliverResetEmail) throw new HttpError(503, "Password recovery is not configured yet.");
    const user = await UserModel.findOne({ email, status: "active" });
    if (!user) return;
    const rawToken = randomBytes(32).toString("hex");
    const record = await TokenModel.create({
      userId: user._id, sessionVersion: user.sessionVersion,
      tokenHash: tokenDigest(rawToken), expiresAt: new Date(Date.now() + RESET_LIFETIME_MS),
    });
    const resetUrl = new URL("/reset-password", origin);
    resetUrl.searchParams.set("token", rawToken);
    try {
      // Trusted server-injected delivery adapter only. The HTTP response never
      // receives this token, the URL, account data, or a delivery diagnostic.
      await deliverResetEmail({ to: user.email, resetUrl: resetUrl.toString() });
    } catch {
      await TokenModel.deleteOne({ _id: record._id });
      throw new HttpError(503, "Password recovery is temporarily unavailable.");
    }
  }

  async function resetPassword(body) {
    const { token, newPassword } = parseReset(body);
    if (!deliverResetEmail) throw new HttpError(503, "Password recovery is not configured yet.");
    const tokenHash = tokenDigest(token);
    const passwordHash = await hashPassword(newPassword);
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const record = await TokenModel.findOneAndUpdate(
          { tokenHash, usedAt: null, expiresAt: { $gt: now } },
          { $set: { usedAt: now } },
          { session, returnDocument: "after", runValidators: true },
        );
        if (!record || !Number.isSafeInteger(record.sessionVersion) || record.sessionVersion < 0 || record.sessionVersion >= Number.MAX_SAFE_INTEGER) throw new HttpError(400, "Reset link is invalid or expired.");
        // The version snapshot also invalidates old tokens that were issued
        // concurrently with an earlier password change.
        const result = await UserModel.updateOne(
          { _id: record.userId, status: "active", sessionVersion: record.sessionVersion },
          { $set: { passwordHash }, $inc: { sessionVersion: 1 } },
          { session, runValidators: true },
        );
        if (result.matchedCount !== 1) throw new HttpError(400, "Reset link is invalid or expired.");
        await TokenModel.deleteMany({ userId: record.userId }, { session });
      });
    } finally { await session.endSession(); }
  }

  return { register, login, requestReset, resetPassword, recoveryEnabled: Boolean(deliverResetEmail), UserModel };
}
