// REV-SEC-19 (added 2026-10-26): daily counters for AI summary requests.
//
// Each AI explanation you generate costs real money in OpenAI/Claude tokens.
// A public "explain my dashboard" button is a favorite bot target ("denial of
// wallet"): a script presses it thousands of times and empties your credit.
// services/aiUsageService.js uses these counters to cap requests per account
// per day and for the whole site per day. No route uses them yet.

import mongoose from "mongoose";
// REV-SEC-14: database-wide safety settings; must load before the schema below.
import "../config/mongooseSecurity.js";

const aiUsageSchema = new mongoose.Schema(
  {
    // "account" = one signed-in user's counter; "site" = everyone combined.
    scope: { type: String, enum: ["account", "site"], required: true },

    // The account's ID for scope "account"; the word "all" for scope "site".
    subject: { type: String, required: true, maxlength: 64 },

    // The UTC calendar day this counter covers, like "2026-10-26".
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },

    // How many AI requests were reserved that day.
    count: { type: Number, required: true, min: 0, default: 0 },

    // Old counters delete themselves (see the TTL index below).
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: "aiUsage" },
);

// Exactly one counter per scope + subject + day. The unique index is what
// makes the "only N per day" rule hold even when many requests arrive at once.
aiUsageSchema.index({ scope: 1, subject: 1, day: 1 }, { unique: true });

// Background cleanup of old counters (not part of the limit check).
aiUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AiUsage = mongoose.model("AiUsage", aiUsageSchema);

export default AiUsage;
