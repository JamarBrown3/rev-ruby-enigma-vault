// Small formatting helpers shared by pages and cards.

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// First `max` characters, cut at a word, with "..." when shortened.
export function excerpt(text = "", max = 170) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : max)}...`;
}

// "1 review" / "3 reviews"
export function plural(count, word, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`;
}

// Images from the database go into CSS (the blurred backdrop on game cards).
// Only allow the same shapes the server allows (https:// or a /site path) and
// nothing that could break out of url("...").
export function cssImageUrl(src) {
  if (typeof src !== "string") return undefined;
  if (!/^(https:\/\/|\/)[^"'()\\\s]+$/.test(src)) return undefined;
  return `url("${src}")`;
}

// The author's name from a post (the API sends { _id, username } or null if
// the account was deleted).
export function authorName(post) {
  return post?.authorId?.username ?? "Former member";
}
