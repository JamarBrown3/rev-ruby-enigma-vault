// information on the users table in the database

import mongoose from "mongoose";
// REV-SEC-14: database-wide safety settings; must load before the schema below.
import "../config/mongooseSecurity.js";
// REV-SEC-08 / REV-SEC-21: the same username/email rules the API uses.
import {
  EMAIL_PATTERN,
  USERNAME_COLLATION,
  USERNAME_PATTERN,
} from "./validators.js";

const userSchema = new mongoose.Schema(
  {
    // username of the user
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 35,
      // REV-SEC-08: letters, digits, "_", "-", "." only (no look-alike Unicode).
      match: USERNAME_PATTERN,
      // REV-SEC-08: uniqueness now ignores capital letters. It is enforced
      // by the "username_case_insensitive_unique" index declared below,
      // so "Jah" and "jah" can no longer both exist.
    },

    // email of the user
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      // A format check is not proof that the person owns this mailbox.
      // REV-SEC-21: the shared pattern also refuses control/invisible characters.
      match: EMAIL_PATTERN,
      unique: true,
      // REV-SEC-07 (added 2026-10-26): hide email from ordinary queries.
      // Before this, Post.find().populate("authorId") or res.json(user) in
      // a future route would have sent every author's email to the browser
      // (confirmed in testing). Trusted code that truly needs the address
      // (password-reset email delivery) asks for it with .select("+email").
      select: false,
    },
    // password hash of the user
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    // role of the user, can be either "user" or "admin"
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    // status of the user, can be either "active" or "banned"
    status: {
      type: String,
      enum: ["active", "banned"],
      default: "active",
    },

    // session version of the user, used for invalidating sessions
    sessionVersion: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Session version must be a nonnegative safe integer.",
      },
    },

    // REV-SEC-09 (added 2026-10-26): two-step sign-in for the owner's admin
    // account. These fields are written ONLY by scripts/create-admin.js on
    // your own computer; no website route can set them.
    mfa: {
      // The authenticator secret, encrypted with ADMIN_MFA_KEY (security/totp.js).
      secretEnc: { type: String, select: false, maxlength: 300 },
      // When two-step sign-in was turned on (null = off).
      enabledAt: { type: Date, default: null },
      // Time window of the last accepted code, so a code can't be reused.
      lastUsedStep: { type: Number, select: false, default: -1 },
    },
  },
  // timestamps and collection name for the schema
  {
    timestamps: true,
    collection: "users",
    toJSON: {
      transform(document, result) {
        delete result.passwordHash;
        delete result.sessionVersion;
        delete result.__v;
        // REV-SEC-07 / REV-SEC-09: never send email or two-step data to a browser by accident.
        delete result.email;
        delete result.mfa;
        return result;
      },
    },
  },
);

// REV-SEC-08: case-insensitive unique usernames. A NEW index name is used on
// purpose: an existing database keeps its old case-sensitive "username_1"
// index, and MongoDB refuses two different indexes with the same name.
// Keeping both is harmless; the stricter one below is what matters.
userSchema.index(
  { username: 1 },
  {
    unique: true,
    name: "username_case_insensitive_unique",
    collation: USERNAME_COLLATION,
  },
);

const User = mongoose.model("User", userSchema);
export default User;
