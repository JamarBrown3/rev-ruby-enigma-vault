// REV-SEC-09 (added 2026-10-26): create or manage the owner's admin account
// from YOUR OWN computer. There is deliberately no website route that can make
// an administrator, so the only way to become admin is to run this script with
// the database password from server/.env.
//
// Run inside the server folder:
//
//   npm run admin:create -- --email you@example.com --username Jah
//       Creates a brand-new admin account. Do this BEFORE the site is public,
//       so nobody else can register your email address first.
//
//   npm run admin:create -- --email you@example.com --promote
//       Makes an account you ALREADY registered on the site the admin.
//
//   npm run admin:create -- --email you@example.com --reset-mfa
//       Lost your phone? Sets up a new authenticator app for the admin account.
//
// Every option also turns on two-step sign-in: after typing your password on
// the login form, you must also type the 6-digit code from an authenticator
// app (Google Authenticator, Microsoft Authenticator, Authy, 1Password, ...).
//
// Needs ADMIN_MFA_KEY in server/.env (or the hosting settings). Create one with:
//   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
// Use the SAME value on your computer and on the server, and keep it secret.

import readline from "node:readline";
import mongoose from "mongoose";
import {
  connectDatabase,
  disconnectDatabase,
  explainDatabaseError,
} from "../config/database.js";
import User from "../models/User.js";
import { USERNAME_PATTERN } from "../models/validators.js";
import { readEmail, readNewPassword } from "../security/input.js";
import { hashNewPassword } from "../security/passwords.js";
import {
  base32Encode,
  encryptTotpSecret,
  generateTotpSecret,
  otpauthUri,
  readMfaKey,
  verifyTotp,
} from "../security/totp.js";

// ---- small terminal helpers ------------------------------------------------
const interactive = Boolean(process.stdin.isTTY);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: interactive,
});
let muted = false;
if (interactive) {
  // Hide what you type while entering a password.
  const write = rl._writeToOutput.bind(rl);
  rl._writeToOutput = (text) => {
    if (!muted || text === "\n" || text === "\r\n") write(text);
  };
}
const queued = [];
const waiting = [];
let inputClosed = false;
rl.on("line", (line) => {
  const next = waiting.shift();
  if (next) next.resolve(line);
  else queued.push(line);
});
rl.on("close", () => {
  inputClosed = true;
  while (waiting.length) waiting.shift().reject(new Error("Input ended."));
});

function ask(prompt, { hidden = false } = {}) {
  process.stdout.write(prompt);
  muted = hidden;
  return new Promise((resolve, reject) => {
    const finish = (line) => {
      muted = false;
      if (hidden && interactive) process.stdout.write("\n");
      resolve(line); // kept exactly as typed (passwords may contain spaces)
    };
    if (queued.length) return finish(queued.shift());
    if (inputClosed) return reject(new Error("Input ended."));
    waiting.push({ resolve: finish, reject });
  });
}

function fail(message) {
  const error = new Error(message);
  error.safe = true;
  throw error;
}

function readArguments(argv) {
  const options = { email: null, username: null, mode: "create" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--email") options.email = argv[++index];
    else if (argument === "--username") options.username = argv[++index];
    else if (argument === "--promote") options.mode = "promote";
    else if (argument === "--reset-mfa") options.mode = "reset-mfa";
    else fail(`Unknown option: ${argument}`);
  }
  if (!options.email) fail("Add --email you@example.com");
  if (options.mode === "create" && !options.username) fail("Add --username YourName for a new account.");
  return options;
}

// Walk through authenticator setup; returns the encrypted secret + used step.
async function enrollAuthenticator({ accountId, label, key }) {
  const secret = generateTotpSecret();
  const setupKey = base32Encode(secret).match(/.{1,4}/g).join(" ");

  console.log("\nTwo-step sign-in setup");
  console.log("1. Open your authenticator app and choose 'Add account' > 'Enter a setup key'.");
  console.log(`2. Account name: ${label}`);
  console.log(`   Setup key:    ${setupKey}`);
  console.log("   Type: Time based, 6 digits");
  console.log("   (Or turn this link into a QR code with an app you trust:)");
  console.log(`   ${otpauthUri({ secret, account: label })}`);
  console.log("Do not screenshot or share the setup key; anyone with it can create your codes.\n");

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const code = (await ask("3. Enter the 6-digit code your app shows now: ")).replace(/\s/g, "");
    const step = verifyTotp(secret, code);
    if (step !== null) {
      return {
        secretEnc: encryptTotpSecret(secret, key, accountId),
        enabledAt: new Date(),
        // The code you just typed counts as used; sign in with the next one.
        lastUsedStep: step,
      };
    }
    console.log("That code did not match. Check that your phone's clock is set automatically.");
  }
  fail("Two-step setup was not confirmed, so nothing was changed.");
}

async function main() {
  const options = readArguments(process.argv.slice(2));
  const email = readEmail(options.email);

  const key = readMfaKey();
  if (!key) {
    fail(
      "ADMIN_MFA_KEY is not set. Create one with\n" +
        "  node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\"\n" +
        "and add ADMIN_MFA_KEY=<that value> to server/.env and to your hosting settings.",
    );
  }

  await connectDatabase(); // also refuses over-privileged database accounts
  await User.init(); // make sure the unique email/username indexes exist

  const existing = await User.findOne({ email }).select("+email");

  if (options.mode === "create") {
    if (existing) {
      fail(
        `An account with that email already exists (username "${existing.username}", created ${existing.createdAt?.toISOString()}).\n` +
          "If it is yours, run the same command with --promote instead of --username.\n" +
          "If you did NOT create it, someone registered your email first: use a different email for your admin account.",
      );
    }

    const username = options.username.trim();
    if (username.length < 3 || username.length > 35 || !USERNAME_PATTERN.test(username)) {
      fail("Username must be 3-35 letters, numbers, _, -, or . and start/end with a letter or number.");
    }

    const password = await ask("Choose a password (15-128 characters, input is hidden): ", { hidden: true });
    readNewPassword(password);
    const again = await ask("Type the password again: ", { hidden: true });
    if (again !== password) fail("The passwords did not match. Nothing was changed.");

    const accountId = new mongoose.Types.ObjectId();
    const passwordHash = await hashNewPassword(password);
    const mfa = await enrollAuthenticator({ accountId, label: email, key });

    await User.create({
      _id: accountId,
      username,
      email,
      passwordHash,
      role: "admin",
      status: "active",
      sessionVersion: 0,
      mfa,
    });

    console.log(`\nDone. Admin account created: ${username} (account ID ${accountId}).`);
  } else {
    if (!existing) fail("No account uses that email. Check the spelling, or create one without --promote.");

    if (options.mode === "promote") {
      console.log(`Found "${existing.username}", created ${existing.createdAt?.toISOString()}, role ${existing.role}.`);
      const confirm = await ask("Type PROMOTE to make this account the admin: ");
      if (confirm.trim() !== "PROMOTE") fail("Cancelled. Nothing was changed.");
    } else if (existing.role !== "admin") {
      fail("--reset-mfa is only for the admin account.");
    }

    const mfa = await enrollAuthenticator({ accountId: existing._id, label: email, key });

    // Raising sessionVersion signs this account out everywhere, so any session
    // that existed before this change has to sign in again with the code.
    await User.updateOne(
      { _id: existing._id },
      {
        $set: {
          role: "admin",
          status: "active",
          "mfa.secretEnc": mfa.secretEnc,
          "mfa.enabledAt": mfa.enabledAt,
          "mfa.lastUsedStep": mfa.lastUsedStep,
        },
        $inc: { sessionVersion: 1 },
      },
    );

    console.log(`\nDone. "${existing.username}" (account ID ${existing._id}) is the admin with two-step sign-in on.`);
  }

  console.log("Next steps:");
  console.log("- Sign in on the site with your email, password, AND the current 6-digit code.");
  console.log("- Add your username to RESERVED_USERNAMES so look-alike names can't be registered.");
  console.log("- Never commit ADMIN_MFA_KEY or server/.env to Git.");
}

try {
  await main();
} catch (error) {
  process.exitCode = 1;
  // Our own messages (and input-check messages) are safe to show; driver
  // errors go through explainDatabaseError so no connection string is printed.
  const message = error.safe || error.status ? error.message : explainDatabaseError(error);
  console.error(`\nAdmin setup stopped: ${message}`);
} finally {
  rl.close();
  await disconnectDatabase();
}
