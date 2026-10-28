import { createHash, randomBytes } from "node:crypto";
import User from "../models/User.js";
import PasswordResetToken from "../models/PasswordResetToken.js";

import {
  HttpError,
  parseRegistration,
  parseLogin,
  parseRecovery,
  parseReset,
} from "../security/input.js";

// REV-SEC-01 (fixed 2026-10-26): passwords.js exports hashNewPassword, not
// hashPassword. Importing a name that does not exist is a SyntaxError in ES
// modules, so this line stopped the entire server from starting.
import {
  hashNewPassword,
  needsRehash,
  verifyPassword,
} from "../security/passwords.js";

// REV-SEC-14: marks operators written by THIS server code as safe (see config/mongooseSecurity.js).
import { trusted } from "../config/mongooseSecurity.js";
// REV-SEC-08: case-insensitive username comparison rule.
import { USERNAME_COLLATION } from "../models/validators.js";
// REV-SEC-09: two-step codes for the owner's admin account.
import { decryptTotpSecret, readMfaKey, verifyTotp } from "../security/totp.js";

export const RESET_LIFETIME_MS = 15 * 60 * 1000;

// REV-SEC-10 (added 2026-10-26): limits on reset emails, stored in MongoDB.
// The in-memory rate limiters in auth.js reset whenever the server restarts.
// A free Render server sleeps and restarts often, and in testing 3 restarts
// allowed 9 reset emails to the same inbox. These limits are checked against
// the saved reset records, so they survive restarts:
//   - at most 3 reset emails per account per hour, and
//   - at most 1 reset email per account per minute.
// Requests over the limit are silently skipped; the person still sees the
// same generic "If an account exists..." message, so nothing is revealed.
// (Both numbers can be changed per service with the options below.)
export const RESET_EMAILS_PER_HOUR = 3;
export const RESET_EMAIL_MIN_GAP_MS = 60 * 1000;

// Reset tokens are cryptographically random, unlike human passwords.
// Store their digest, not the usable token itself.
export const tokenDigest = (token) =>
  createHash("sha256").update(token).digest("hex");

export function createAuthService({
  UserModel = User,
  TokenModel = PasswordResetToken,
  connection = UserModel.db,
  deliverResetEmail = null,
  resetOrigin = "http://localhost:5173",
  // REV-SEC-09: key that decrypts the admin's two-step secret (ADMIN_MFA_KEY).
  mfaKey = readMfaKey(),
  // REV-SEC-10: database-backed reset-email limits (see the top of this file).
  resetEmailsPerHour = RESET_EMAILS_PER_HOUR,
  resetEmailMinGapMs = RESET_EMAIL_MIN_GAP_MS,
} = {}) {
  // Use a server-configured frontend origin when building reset links.
  // Never build these links from a client-supplied Host header.
  const origin = new URL(resetOrigin);

  if (
    !["https:", "http:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error(
      "Configure a trusted frontend origin for password recovery.",
    );
  }

  // REGISTER: validate, hash, then save explicitly allowed fields.
  async function register(body) {
    const { username, email, password } = parseRegistration(body);

    // REV-SEC-08 (added 2026-10-26): usernames are public (they appear on
    // posts), so it is safe and friendlier to say when one is taken. The
    // check ignores capital letters: "Jah" blocks "jah". It happens BEFORE
    // anything involving the email, so the answer never depends on whether
    // the email is registered. Duplicate EMAILS still get the generic 202.
    const usernameTaken = await UserModel.exists({ username }).collation(
      USERNAME_COLLATION,
    );
    if (usernameTaken) {
      throw new HttpError(409, "That username is not available.");
    }

    const passwordHash = await hashNewPassword(password);

    try {
      await UserModel.create({
        username,
        email,
        passwordHash,
        role: "user",
        status: "active",
        sessionVersion: 0,
      });
    } catch (error) {
      // Duplicate email/username gets the same public response.
      // Other database failures must still reach the error handler.
      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  // LOGIN: validate input and check the stored password hash.
  async function authenticate(body) {
    const { email, password, code } = parseLogin(body);

    // passwordHash is normally excluded by the User schema.
    // This trusted authentication operation explicitly requests it.
    // REV-SEC-09: the encrypted two-step fields are hidden the same way.
    const user = await UserModel.findOne({ email }).select(
      "+passwordHash +mfa.secretEnc +mfa.lastUsedStep",
    );

    const matches = await verifyPassword(password, user?.passwordHash);

    if (
      !matches ||
      !user ||
      user.status !== "active" ||
      !Number.isSafeInteger(user.sessionVersion)
    ) {
      throw new HttpError(401, "Invalid credentials.");
    }

    // REV-SEC-09: an account with two-step sign-in turned on (the owner's
    // admin account, set up with scripts/create-admin.js) must also send the
    // current 6-digit code. A wrong, missing, or reused code gets the SAME
    // "Invalid credentials" answer as a wrong password. Because this check
    // happens before any session exists, every session on that account has
    // passed the code check.
    // REV-SEC-25: an admin without an enrolled second factor cannot sign in.
    // Merely changing the stored role must not create an admin login path.
    const mfaEnabled = Boolean(user.mfa?.enabledAt && user.mfa?.secretEnc);
    if (user.role === "admin" && !mfaEnabled) {
      throw new HttpError(401, "Invalid credentials.");
    }
    let mfaVerified = false;
    if (mfaEnabled) {
      const codeAccepted = await checkTwoStepCode(user, code);
      if (!codeAccepted) {
        throw new HttpError(401, "Invalid credentials.");
      }
      mfaVerified = true;
    }

    // REV-SEC-02: quietly upgrade old password hashes (legacy scrypt or older
    // Argon2 costs) now that we know the password is correct. Best effort: a
    // failure here must never block a valid sign-in.
    if (needsRehash(user.passwordHash)) {
      try {
        const upgraded = await hashNewPassword(password);
        await UserModel.updateOne(
          { _id: user._id, passwordHash: user.passwordHash },
          { $set: { passwordHash: upgraded } },
        );
      } catch {
        // Keep the old (still valid) hash; the next sign-in will try again.
      }
    }

    // REV-SEC-25: return explicit, server-generated authentication assurance.
    return {
      user,
      mfaVerified,
      mfaEnabledAt: mfaVerified ? new Date(user.mfa.enabledAt).getTime() : null,
    };
  }

  // Preserve the existing service helper for callers that only need the user.
  async function login(body) {
    return (await authenticate(body)).user;
  }

  // REV-SEC-09: verify the 6-digit code and claim it so it can't be reused.
  async function checkTwoStepCode(user, code) {
    if (!mfaKey || !code) return false;

    let secret;
    try {
      secret = decryptTotpSecret(user.mfa.secretEnc, mfaKey, user._id.toString());
    } catch {
      return false; // wrong ADMIN_MFA_KEY or a damaged record: fail closed
    }

    const step = verifyTotp(secret, code, {
      lastUsedStep: user.mfa.lastUsedStep ?? -1,
    });
    if (step === null) return false;

    // Record the code's time window in the database in ONE atomic update.
    // If two requests race with the same code, only one can win.
    const claim = await UserModel.updateOne(
      {
        _id: user._id,
        $or: [
          { "mfa.lastUsedStep": trusted({ $lt: step }) },
          { "mfa.lastUsedStep": trusted({ $exists: false }) },
        ],
      },
      { $set: { "mfa.lastUsedStep": step } },
    );
    return claim.matchedCount === 1;
  }

  // REQUEST RESET: create a temporary token and deliver its link.
  async function requestReset(body) {
    const { email } = parseRecovery(body);

    if (!deliverResetEmail) {
      throw new HttpError(503, "Password recovery is not configured yet.");
    }

    // REV-SEC-07: email is hidden from normal queries now, so this trusted
    // recovery operation asks for it explicitly.
    const user = await UserModel.findOne({
      email,
      status: "active",
    }).select("+email");

    // The HTTP route gives generic feedback either way.
    if (!user) {
      return;
    }

    // REV-SEC-10: database-backed limits that survive server restarts.
    const now = Date.now();
    const recent = await TokenModel.find({
      userId: user._id,
      createdAt: trusted({ $gt: new Date(now - 60 * 60 * 1000) }),
    })
      .select("createdAt")
      .lean();
    const tooMany = recent.length >= resetEmailsPerHour;
    const tooSoon = recent.some(
      (record) => now - new Date(record.createdAt).getTime() < resetEmailMinGapMs,
    );
    if (tooMany || tooSoon) {
      return; // silently skip: same public response, no new email
    }

    const rawToken = randomBytes(32).toString("hex");

    const record = await TokenModel.create({
      userId: user._id,
      sessionVersion: user.sessionVersion,
      tokenHash: tokenDigest(rawToken),
      expiresAt: new Date(Date.now() + RESET_LIFETIME_MS),
    });

    // REV-SEC-10: the token now goes in the URL FRAGMENT (#token=...) instead
    // of the query string (?token=...). Browsers never send the part after
    // "#" to any server, so the secret stays out of Netlify/Render access
    // logs and out of Referer headers. The future reset page reads it with:
    //   new URLSearchParams(window.location.hash.slice(1)).get("token")
    const resetUrl = new URL("/reset-password", origin);
    resetUrl.hash = new URLSearchParams({ token: rawToken }).toString();

    try {
      // Only a trusted, server-supplied email adapter receives this.
      // Never return or log this URL in the public API.
      await deliverResetEmail({
        to: user.email,
        resetUrl: resetUrl.toString(),
      });
    } catch {
      // Remove the token record if delivery reports failure.
      await TokenModel.deleteOne({ _id: record._id });

      throw new HttpError(503, "Password recovery is temporarily unavailable.");
    }
  }

  // RESET PASSWORD: consume the token and change the password together.
  async function resetPassword(body) {
    const { token, newPassword } = parseReset(body);

    if (!deliverResetEmail) {
      throw new HttpError(503, "Password recovery is not configured yet.");
    }

    const tokenHash = tokenDigest(token);

    // REV-SEC-10 (added 2026-10-26): make sure the link is real BEFORE doing
    // the expensive Argon2 hash. Otherwise a bot could post random tokens
    // and make the server burn CPU on hashes that are thrown away. The
    // transaction below still re-checks everything atomically.
    const looksValid = await TokenModel.exists({
      tokenHash,
      usedAt: null,
      expiresAt: trusted({ $gt: new Date() }),
    });
    if (!looksValid) {
      throw new HttpError(400, "Reset link is invalid or expired.");
    }

    const passwordHash = await hashNewPassword(newPassword);

    const session = await connection.startSession();

    try {
      await session.withTransaction(async () => {
        const now = new Date();

        // Require the exact digest, unused token, and future expiry.
        // Claim the token within this transaction.
        const record = await TokenModel.findOneAndUpdate(
          {
            tokenHash,
            usedAt: null,
            // REV-SEC-14: trusted() marks this server-written operator as safe.
            expiresAt: trusted({ $gt: now }),
          },
          {
            $set: { usedAt: now },
          },
          {
            session,
            returnDocument: "after",
            runValidators: true,
          },
        );

        if (
          !record ||
          !Number.isSafeInteger(record.sessionVersion) ||
          record.sessionVersion < 0 ||
          record.sessionVersion >= Number.MAX_SAFE_INTEGER
        ) {
          throw new HttpError(400, "Reset link is invalid or expired.");
        }

        // Change only the active account with the expected version.
        // Incrementing the version invalidates its existing logins.
        const result = await UserModel.updateOne(
          {
            _id: record.userId,
            status: "active",
            sessionVersion: record.sessionVersion,
          },
          {
            $set: { passwordHash },
            $inc: { sessionVersion: 1 },
          },
          {
            session,
            runValidators: true,
          },
        );

        if (result.matchedCount !== 1) {
          throw new HttpError(400, "Reset link is invalid or expired.");
        }

        // Invalidate all outstanding reset links for this account.
        await TokenModel.deleteMany({ userId: record.userId }, { session });
      });
    } finally {
      await session.endSession();
    }
  }

  return {
    register,
    login,
    authenticate,
    requestReset,
    resetPassword,
    recoveryEnabled: Boolean(deliverResetEmail),
    // REV-SEC-09: lets startup warn when admin two-step codes can't be checked.
    mfaConfigured: Boolean(mfaKey),
    UserModel,
  };
}
