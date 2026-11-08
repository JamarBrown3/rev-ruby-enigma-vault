// REV-SEC-27 (added 2026-11-07): username rules for a public portfolio site.
// Usernames show next to every post and comment, so they must not be:
//   - offensive (profanity, slurs, hate terms)
//   - impersonation ("official_jah", "rev_support", "realadmin")
//   - personal information (phone numbers; "@" for emails is already impossible)
//
// The format rules (letters, numbers, _ - . only) live in models/validators.js.
// This file adds the "is this name acceptable?" rules on top.
//
// Blocked names get the same vague answer as a taken name ("That username is
// not available."), so people can't probe the filter word by word.
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

// New usernames: 3 to 20 characters. (Older accounts may keep up to 35.)
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// ---------- 1. Offensive words ----------

// obscenity's English list understands tricks like "sh1t", "a55hole" and "fvck",
// and knows innocent words that contain bad ones ("assassin", "scunthorpe").
const profanity = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Hate terms the library's list doesn't include. Checked as "contains".
const EXTRA_BLOCKED = ["nazi", "hitler", "kkk", "heil"];

// "f_u_c_k" -> "fuck": separators are removed before checking, so splitting a
// word with _ . or - doesn't sneak it through.
const squash = (name) => name.trim().toLowerCase().replace(/[_.-]/g, "");

export function isOffensiveUsername(username) {
  const squashed = squash(username);
  return (
    profanity.hasMatch(username) ||
    profanity.hasMatch(squashed) ||
    EXTRA_BLOCKED.some((word) => squashed.includes(word))
  );
}

// ---------- 2. Impersonation (staff and owner names) ----------

// Names nobody may use, plus the owner's own names from the environment:
//   RESERVED_USERNAMES=jah,jamar
const RESERVED = [
  "admin", "administrator", "root", "system", "support", "moderator", "mod",
  "staff", "owner", "official", "security", "rev", "help", "api", "null",
  "undefined",
];

function reservedList(extra = process.env.RESERVED_USERNAMES) {
  return [...RESERVED, ...String(extra ?? "").split(",")]
    .map(squash)
    .filter(Boolean);
}

// Blocked if:
//  a) the whole name is reserved:            "Ad_Min", "a.d.m.i.n"
//  b) any part between separators is reserved: "rev_support", "jah-official"
//  c) a long reserved word (5+ letters) appears anywhere: "realadmin", "officialjah"
// Short words (rev, mod, jah) only count as whole parts, so normal names like
// "trevor", "model_maker" and "Jahmal" stay allowed.
export function isReservedUsername(username, extra) {
  const reserved = reservedList(extra);
  const whole = squash(username);
  const parts = username.toLowerCase().split(/[_.-]+/).filter(Boolean);
  return (
    reserved.includes(whole) ||
    parts.some((part) => reserved.includes(part)) ||
    reserved.some((word) => word.length >= 5 && whole.includes(word))
  );
}

// ---------- 3. Personal information ----------

// 7 or more digits in a row, ignoring separators, looks like a phone number:
// "5551234567", "555_123_4567". Short numbers like "gamer2026" are fine.
export function looksLikePhoneNumber(username) {
  return /\d{7,}/.test(username.replace(/[_.-]/g, ""));
}

// ---------- All together ----------

// Returns null when the name is acceptable, or the reason it isn't.
// The reason is for logs and tests; users only ever see a vague message.
export function usernameProblem(username, { extraReserved } = {}) {
  if (looksLikePhoneNumber(username)) return "phone";
  if (isReservedUsername(username, extraReserved)) return "reserved";
  if (isOffensiveUsername(username)) return "offensive";
  return null;
}
