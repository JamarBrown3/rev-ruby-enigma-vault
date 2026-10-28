// REV-SEC-09 (added 2026-10-26): two-step sign-in codes for the owner's
// administrator account.
//
// This implements standard time-based one-time passwords (TOTP, RFC 6238),
// the same 6-digit codes shown by Google Authenticator, Microsoft
// Authenticator, Authy, 1Password, and similar apps. Even if someone steals
// or guesses the admin password, they still cannot open admin routes without
// the code from your phone.
//
// Only Node's built-in crypto module is used, so no extra package is needed.

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// A new random 160-bit secret, the size recommended for SHA-1 TOTP.
export function generateTotpSecret() {
  return randomBytes(20);
}

// Authenticator apps expect the secret written in Base32 (RFC 4648).
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

// HOTP (RFC 4226): the 6-digit code for one specific counter value.
export function hotp(secret, counter, digits = TOTP_DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

// Which 30-second time window ("step") a moment belongs to.
export function totpStep(now = Date.now()) {
  return Math.floor(now / 1000 / TOTP_STEP_SECONDS);
}

// Check a submitted code. It is accepted in the current 30-second window or
// one window either side (phone clocks drift). lastUsedStep blocks REPLAY:
// a code that was already used, or any older code, is refused.
// Returns the matching step number, or null when the code is not valid.
export function verifyTotp(
  secret,
  code,
  { now = Date.now(), window = 1, lastUsedStep = -1 } = {},
) {
  if (typeof code !== "string" || !/^[0-9]{6}$/.test(code)) return null;
  const current = totpStep(now);
  const submitted = Buffer.from(code);
  let matched = null;
  // Check every candidate window without stopping early, so the response
  // time does not reveal which window matched.
  for (let step = current - window; step <= current + window; step += 1) {
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, submitted) && step > lastUsedStep) {
      matched = step;
    }
  }
  return matched;
}

// The link an authenticator app reads (it can be pasted, or turned into a QR code).
export function otpauthUri({ secret, account, issuer = "REV" }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: base32Encode(secret),
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}

// --- Encryption of the stored secret -------------------------------------
// The TOTP secret is stored ENCRYPTED (AES-256-GCM) in MongoDB. Someone who
// obtains a copy of the database still cannot generate your codes without
// ADMIN_MFA_KEY, which lives only in the server environment.
// The account ID is bound into the encryption, so a secret copied onto a
// different account does not decrypt.

export function readMfaKey(value = process.env.ADMIN_MFA_KEY) {
  const text = value?.trim();
  if (!text) return null;
  if (!/^[a-fA-F0-9]{64}$/.test(text)) {
    throw new Error(
      "ADMIN_MFA_KEY must be 64 hexadecimal characters (32 random bytes).",
    );
  }
  return Buffer.from(text, "hex");
}

export function encryptTotpSecret(secret, key, accountId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(String(accountId)));
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptTotpSecret(stored, key, accountId) {
  const [version, iv, tag, ciphertext] = String(stored).split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported two-step secret format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(String(accountId)));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]);
}
