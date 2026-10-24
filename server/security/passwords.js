import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { HttpError, readNewPassword } from "./input.js";

const derive = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let active = 0;

async function key(password, salt) {
  // Bound memory use under concurrent password attacks. Rate limits are another
  // layer; do not allow an unbounded queue of expensive scrypt operations.
  if (active >= 2) throw new HttpError(503, "Authentication is temporarily busy. Please try again.");
  active++;
  try { return await derive(password, salt, 64, options); }
  finally { active--; }
}

export async function hashPassword(password) {
  readNewPassword(password);
  const salt = randomBytes(16).toString("hex");
  const derived = await key(password, salt);
  return `$scrypt$131072$8$1$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length < 1 || password.length > 128) return false;
  const match = typeof encoded === "string" && /^\$scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded);
  // Unknown accounts still incur the same password-hashing workload. Never
  // accept work-factor values supplied in an untrusted encoded hash.
  const derived = await key(password, match ? match[1] : "0".repeat(32));
  const expected = Buffer.from(match ? match[2] : "0".repeat(128), "hex");
  return timingSafeEqual(derived, expected) && Boolean(match);
}
