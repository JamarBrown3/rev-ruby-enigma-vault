// REV-SEC-19 (added 2026-10-26): "Can this account have another AI summary today?"
//
// Future controller usage (no route exists yet):
//
//   const usage = createAiUsageService();
//   await usage.reserve(req.authUser._id);   // throws 429 when over a limit
//   try {
//     summary = await callYourAiProvider(...);
//   } catch (error) {
//     await usage.release(req.authUser._id);  // give the credit back on failure
//     throw error;
//   }
//
// reserve() BEFORE calling the AI provider, never after, so a burst of
// simultaneous clicks cannot slip past the limit.
//
// Limits (both can be set in the environment):
//   AI_DAILY_LIMIT_PER_ACCOUNT  default 5   summaries per account per UTC day
//   AI_DAILY_LIMIT_SITE         default 100 summaries for the whole site per day

import AiUsage from "../models/AiUsage.js";
import { trusted } from "../config/mongooseSecurity.js";
import { HttpError } from "../security/input.js";

function readLimit(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100000) {
    throw new Error("AI daily limits must be whole numbers from 0 to 100000.");
  }
  return number;
}

const utcDay = (now) => new Date(now).toISOString().slice(0, 10);

export function createAiUsageService({
  UsageModel = AiUsage,
  perAccountLimit = readLimit(process.env.AI_DAILY_LIMIT_PER_ACCOUNT, 5),
  siteLimit = readLimit(process.env.AI_DAILY_LIMIT_SITE, 100),
  now = () => Date.now(),
} = {}) {
  // Add 1 to a counter only if it is still below its limit, in ONE atomic
  // database step. Returns true when the slot was granted.
  async function take(scope, subject, limit, day, expiresAt) {
    if (limit === 0) return false;
    // Two tries: on the very first request of the day, two simultaneous
    // requests can both try to CREATE the counter; the loser simply retries
    // against the counter the winner just created.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await UsageModel.findOneAndUpdate(
          { scope, subject, day, count: trusted({ $lt: limit }) },
          { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
          { upsert: true, returnDocument: "after" },
        );
        return Boolean(result);
      } catch (error) {
        // Duplicate key: the counter already exists and the filter did not
        // match it. On the retry that means the counter is full.
        if (error?.code !== 11000) throw error;
      }
    }
    return false;
  }

  async function giveBack(scope, subject, day) {
    await UsageModel.updateOne(
      { scope, subject, day, count: trusted({ $gt: 0 }) },
      { $inc: { count: -1 } },
    );
  }

  async function reserve(accountId) {
    const subject = String(accountId);
    if (!/^[a-f0-9]{24}$/.test(subject)) throw new Error("reserve() needs the signed-in account ID.");
    const day = utcDay(now());
    const expiresAt = new Date(now() + 8 * 24 * 60 * 60 * 1000);

    if (!(await take("account", subject, perAccountLimit, day, expiresAt))) {
      throw new HttpError(429, "You have used today's AI summaries. Please try again tomorrow.");
    }
    if (!(await take("site", "all", siteLimit, day, expiresAt))) {
      await giveBack("account", subject, day); // don't charge the user for the site limit
      throw new HttpError(429, "AI summaries are at today's limit. Please try again tomorrow.");
    }
    return { day };
  }

  // Return one reservation, e.g. when the AI provider call failed.
  async function release(accountId) {
    const day = utcDay(now());
    await giveBack("account", String(accountId), day);
    await giveBack("site", "all", day);
  }

  return { reserve, release, limits: { perAccountLimit, siteLimit } };
}
