// information on the users table in the database

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // username of the user
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 35,
      unique: true,
    },

    // email of the user
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      // A format check is not proof that the person owns this mailbox.
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      unique: true,
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
        return result;
      },
    },
  },
);

const User = mongoose.model("User", userSchema);
export default User;
