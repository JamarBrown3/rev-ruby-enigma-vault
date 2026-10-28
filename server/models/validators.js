// REV-SEC-08 / REV-SEC-17 / REV-SEC-21 (added 2026-10-26)
// Shared format rules used by BOTH the Mongoose models and the HTTP input
// parsers in security/input.js. Keeping one copy means the database and the
// API can never disagree about what a valid username, email, or link is.

// REV-SEC-08: Usernames are shown publicly next to reviews and posts.
// Only plain letters, digits, underscore, hyphen, and period are allowed, and
// the first and last characters must be a letter or digit. This blocks
// look-alike Unicode names (for example a Cyrillic "а" posing as "a"),
// invisible characters, and names that are only punctuation.
export const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$/;

// REV-SEC-08: Case-insensitive comparison rule for usernames. "Jah", "jah",
// and "JAH" are treated as the same name by the unique database index.
export const USERNAME_COLLATION = Object.freeze({ locale: "en", strength: 2 });

// REV-SEC-21: Basic email shape check. \s blocks spaces and line breaks
// (which also stops email-header injection), \p{Cc} blocks control
// characters, and \p{Cf} blocks invisible formatting characters such as
// zero-width spaces. A format check still does NOT prove mailbox ownership.
export const EMAIL_PATTERN =
  /^[^\s@\p{Cc}\p{Cf}]+@[^\s@\p{Cc}\p{Cf}]+\.[^\s@\p{Cc}\p{Cf}]+$/u;

// REV-SEC-17: Links and image addresses stored in the database.
// Browsers treat some URL schemes as code (javascript:) or as embedded
// documents (data:, file:), so only real web addresses are accepted.
// allowRelative lets admin-managed records point at the site's own assets,
// such as "/images/cover.png", but never at "//other-site.example".
export function isSafeWebUrl(
  value,
  { allowRelative = false, allowHttp = false } = {},
) {
  // Optional fields may be empty; "required" rules handle mandatory ones.
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string" || value.length > 2000) return false;

  // A site-relative path: starts with exactly one "/" and uses safe characters.
  if (allowRelative && /^\/(?!\/)[A-Za-z0-9._~\-/]+$/.test(value)) return true;

  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const allowedProtocols = allowHttp ? ["https:", "http:"] : ["https:"];

  // Reject other schemes, embedded usernames/passwords, and empty hosts.
  return (
    allowedProtocols.includes(url.protocol) &&
    !url.username &&
    !url.password &&
    url.hostname.length > 0
  );
}

// REV-SEC-17: Mongoose validator factory, e.g. validate: safeUrl({ allowRelative: true })
export function safeUrl(options = {}) {
  return {
    validator: (value) => isSafeWebUrl(value, options),
    message: options.allowRelative
      ? "Use an https:// address or a site path that starts with /."
      : "Use a full https:// address.",
  };
}
