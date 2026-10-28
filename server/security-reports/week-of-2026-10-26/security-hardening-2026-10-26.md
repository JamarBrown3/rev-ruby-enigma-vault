# REV backend security hardening — 26 October 2026

**Replaces** `week-of-2026-10-19/security-fixes-2026-10-23.md` as the current status.
The older reports stay in that folder as history.

**Scope:** everything in `server/` except `.env` files, `security/auth.js`,
`routes/` and `controllers/`. The frontend (`client/`) was not touched.
`security/auth.js` is **unchanged** in this pass; see [Still open](#still-open).

## How to find every change

Each change is marked in the code with a tag such as `REV-SEC-02`. The numbers
match the headings below. To list them all, run this inside `server/`:

```sh
grep -rn "REV-SEC-" --include=*.js . | grep -v node_modules
```

Every new test name also starts with its `REV-SEC-##` number.

## Summary

| | Before (tested on your code) | After |
|---|---|---|
| Server start-up | **Crashed**: `LEGACY_FORMAT is not defined`, and `hashPassword` didn't exist. None of the 45 login tests even ran. | Starts. All tests run. |
| Finding out which emails have accounts by timing login | Registered email 24 ms vs unknown email 2.8 ms (8.6× gap) | 25.9 ms vs 24.6 ms (no usable gap) |
| 8 people signing in at the same moment | 4 of 8 got 503 "busy" | 8 of 8 succeed |
| Emails leaking through `populate()` / `res.json(user)` | Yes | No; email has to be asked for on purpose |
| Look-alike usernames (`Jah`/`jah`/`JAH`, `admin`) | All accepted | `409 That username is not available.` |
| Reset-email spam to one inbox over 3–4 restarts | 9 emails, 9 live links | 3 emails total |
| Reset token in the link | `?token=` (lands in server logs) | `#token=` (never sent to a server) |
| Production without proxy setting | Every visitor shared one rate-limit bucket (a bot locked out a real user) | Server refuses to start until `TRUST_PROXY_HOPS` is set |
| Slow "Slowloris" client | Held a connection 70+ s | Cut off with 408 after about 25 s |
| One IP flooding the API | Only auth routes were limited | Whole API: 300 requests per 5 min per IP |
| Admin account protection | Password only | Password **and** 6-digit authenticator code |
| NoSQL ("SQL") injection: `$ne`, `$gt`, `$regex`, arrays, `__proto__` | Blocked by your input guard ✅ | Still blocked, plus a database-level safety net |
| Known vulnerable packages (`npm audit`) | 0 | 0 (no packages added) |

A note on "SQL injection": REV uses MongoDB, which doesn't run SQL. Text such as
`' OR '1'='1` or `DROP TABLE users` is just stored as text. The MongoDB version of
the attack is **operator injection**: sending `{ "$ne": null }` instead of an email.
That was already blocked and has more layers now (REV-SEC-13, REV-SEC-14).

## The changes, one by one

### REV-SEC-01: the server can start again

**Problem.** The Argon2 switch was half-finished. `passwords.js` had
`LEGACY_FORMAT = /…/` with no `const`. ES modules always run in strict mode, so
that line threw `ReferenceError` the moment the file loaded. `authService.js`
also imported `hashPassword`, which no longer exists (it's `hashNewPassword` now).
Together, `server.js` couldn't start and `test/auth.test.js` crashed on load. The
older "561 passed" number only counted tests that never touch login.

**Change.** Added `const`, fixed the import, and updated `auth.test.js` to
expect Argon2id hashes instead of scrypt.

**Files:** `security/passwords.js`, `services/authService.js`, `test/auth.test.js`.

### REV-SEC-02: login timing no longer reveals registered emails

**Problem.** `verifyPassword()` returned `false` straight away when no stored
hash was given. That's exactly what happens when the email has no account. The
comment said a dummy hash was used, but the early `return` skipped it. Unknown
emails answered 8.6× faster, so a bot could time logins to build a list of your
users' emails.

**Change.** Missing or unsupported hashes now go through the same dummy Argon2
check as real accounts. The type check on the password (in the old scrypt
version, dropped in the rewrite) is back. Also added:
- `needsRehash()`: true for old formats.
- After a **successful** sign-in, `authService.login` quietly re-hashes old
  passwords with the current Argon2 settings. Legacy scrypt accounts upgrade
  themselves, and you can raise the Argon2 costs later without locking anyone out
  (add the old setting to `SUPPORTED_ARGON_PARAMETERS`).

**Files:** `security/passwords.js`, `services/authService.js`.

### REV-SEC-03: sign-in bursts wait in line instead of failing

**Problem.** Only 2 password checks could run at once; the 3rd got an instant
503. In testing, 4 of 8 simultaneous **correct** logins were refused.

**Change.** Up to 4 run at once (Node runs Argon2 on 4 background threads), up to
32 more wait in line, and anything that waits more than 10 s gets the 503. Worst
case is about 76 MiB of memory. Legacy scrypt checks (128 MiB each) run one at a
time so a few of them can't exhaust a small server.

**File:** `security/passwords.js`.

### REV-SEC-05: one speed limit for the whole API

**Problem.** Only `/api/auth/*` had rate limits. Every future route (games, posts,
dashboards) would be open to unlimited scraping.

**Change.** `app.js` now allows each IP 300 requests per 5 minutes across the
whole API (changeable with `createApp({ globalRateLimitMax })`). Extra requests get
`429` before the body is read or the database is touched, so rejecting them is
cheap. `/api/health` is skipped so Render's health checks never fail. The stricter
login/register/reset limits in `auth.js` still apply on top.

**File:** `app.js`.

### REV-SEC-06: production must say how many proxies are in front

**Problem.** On Render every request arrives through Render's proxy. Unless
`TRUST_PROXY_HOPS` is set, Express sees the **proxy's** IP for every visitor. Every
"per-IP" limit then becomes one shared limit for the whole site. In testing, a
bot's 20 bad logins locked out a different, real user. (Secure cookies also need
this setting behind a proxy.) Separately, every startup error was printed as a
MongoDB problem, which hid messages like "Set a strong SESSION_SECRET".

**Change.**
- New `getTrustProxy()` in `config/env.js`. In production the server refuses to
  start without `TRUST_PROXY_HOPS`.
- `server.js` now says which startup step failed. Database errors still go
  through `explainDatabaseError`, so connection strings are never printed.

**Files:** `config/env.js`, `server.js`.

### REV-SEC-07: emails are hidden unless code asks for them

**Problem.** `User.email` was returned by every query and by `toJSON()`. A future
`Post.find().populate("authorId")` or `res.json(user)` would have sent every
author's email to the browser (confirmed in testing).

**Change.**
- `email` is `select: false` and removed in `toJSON`, the same treatment as
  `passwordHash`.
- The password-reset email step asks for it explicitly with `.select("+email")`.
- When you build "admin: list users" later, send the fields you choose rather
  than the whole document.

**Files:** `models/User.js`, `services/authService.js`.

### REV-SEC-08: no look-alike or staff-style usernames

**Problem.** `Jah`, `jah` and `JAH` could all exist, as could `admin`. Any Unicode
was allowed, so `Jаh` with a Cyrillic "а" could pose as you.

**Change.**
- Usernames use letters, numbers, `_`, `-`, `.` only, and start and end with a
  letter or number.
- Uniqueness ignores capital letters. A new database index,
  `username_case_insensitive_unique`, enforces this even during races.
- Staff-like names (`admin`, `root`, `support`, `moderator`, `rev`, ...) are
  reserved. Add your own with `RESERVED_USERNAMES=jah,jamar`.
- Because usernames are public anyway, a taken one now gets a clear
  `409 That username is not available.` That check runs **before** anything about
  the email, so the answer never reveals whether an email is registered. A
  duplicate **email** still gets the same `202` as a brand-new account.

**Database note.** If your Atlas `users` collection already has the old
`username_1` index, it stays; both can exist together. If startup ever fails
while building `username_case_insensitive_unique`, two existing accounts differ
only by capital letters. Rename one in Atlas, then restart.

**Files:** `models/validators.js` (new), `models/User.js`, `security/input.js`,
`services/authService.js`, `test/auth.test.js`.

### REV-SEC-09: two-step sign-in for your admin account

**Problem.** The admin account was protected by a password only.

**Change.**
- **New `scripts/create-admin.js`** (`npm run admin:create`). It runs on your
  computer and creates or promotes your admin account, so no website route can
  ever make an admin. It walks you through adding REV to an authenticator app and
  checks a code before saving anything.
- After that, signing in to your admin account needs email, password **and** the
  current 6-digit code in a `code` field. A wrong, missing or reused code gets the
  same `401 Invalid credentials.` as a wrong password.
- The authenticator secret is stored encrypted (AES-256-GCM) with
  `ADMIN_MFA_KEY`, which only exists in your environment settings, and is tied to
  your account ID.
- Each code works once. Codes are checked against the official RFC 6238 test
  values.
- If `ADMIN_MFA_KEY` is missing or wrong on the server, the admin account can't
  sign in at all. It fails closed and logs a startup warning.

Setup steps are in [Setting up your admin account](#setting-up-your-admin-account).

**Files:** `security/totp.js` (new), `scripts/create-admin.js` (new),
`models/User.js` (`mfa` fields, hidden), `security/input.js` (`code` field),
`services/authService.js`, `package.json` (`admin:create` script).

### REV-SEC-10: password-reset spam is capped and the token stays out of logs

**Problems.**
- The "3 per hour" limit lived only in memory. A free Render server sleeps and
  restarts often, so in testing 3 restarts allowed 9 emails to one inbox.
- The token went in `?token=…`, which ends up in hosting access logs.
- Fake tokens still triggered a full Argon2 hash before being rejected.

**Changes.**
- **Database-backed limits** that survive restarts: at most 3 reset emails per
  account per hour and 1 per minute. Over-limit requests are silently skipped, and
  the person still sees the same generic message. Both numbers are options on
  `createAuthService`.
- The link is now `https://your-site/reset-password#token=…`. The part after `#`
  never leaves the browser. When you build the reset page, read it with
  `new URLSearchParams(window.location.hash.slice(1)).get("token")`.
- The service checks the link exists before hashing. In testing a fake link was
  rejected in 1.5 ms instead of the cost of a 22 ms hash. The transaction still
  re-checks everything.

**Files:** `services/authService.js`, `test/auth-atlas.test.js`.

### REV-SEC-11: slow-client (Slowloris) limits

**Problem.** With Node's defaults, a bot sending its headers one line at a time
kept a connection open for over 70 s. Many such bots can use up the server's
connections.

**Change.** `server.js` sets these limits:
- headers must arrive within 20 s
- the whole request must arrive within 30 s
- Node checks those deadlines every 5 s

A test client was cut off with `408` after about 25 s. In production,
`keepAliveTimeout` is set to 121 s, longer than Render's 120 s proxy idle time.
That avoids the random 502 errors Render users report when Node closes a
connection first.

**File:** `server.js`.

### REV-SEC-13: the query string is checked too

**Change.** Like `rejectUnsafeJson` for bodies, the new `rejectUnsafeQuery`
refuses query keys that start with `$` or contain `.`, `[` or `]`, more than 30
parameters, more than 20 repeats of one name, or values over 2,000 characters.
`app.js` also locks Express 5's "simple" query parser, which never builds nested
objects. Routes must still check the parameters they use (for example "page is a
whole number from 1 to 1000").

**Files:** `security/input.js`, `app.js`.

### REV-SEC-14: database safety net for every model

**Change.** A new `config/mongooseSecurity.js`, imported at the top of every
model, does two things:
- **`sanitizeFilter`:** if an object containing `$` keys ever reaches a query
  filter, Mongoose neutralizes it instead of running it. A future route that
  forgets validation is still protected. Top-level `$where`, `$expr`,
  `$jsonSchema` and `$text` are refused.
- **Time limits on reads:** `find`, `findOne`, `countDocuments` and `distinct`
  stop after 5 s by default, and aggregations after 15 s, so a bot can't keep the
  database busy with a slow query.

It also adds two indexes the ERD already planned (posts by author, reviews by
game) so those future pages don't scan the whole collection.

> **Important when you write routes.** When **your own** code needs an operator,
> wrap it in `trusted()`:
>
> ```js
> import { trusted } from "../config/mongooseSecurity.js";
> Post.find({ rating: trusted({ $gte: 7 }) });
> ```
>
> Without `trusted()` that query throws a `CastError`, which is the safety net
> working. `Model.aggregate()` pipelines are **not** sanitized, so build `$match`
> stages only from values you've already validated.

**Files:** `config/mongooseSecurity.js` (new), every file in `models/`,
`services/authService.js`, `test/password-reset.security.test.js`.

### REV-SEC-15: clearer errors without leaking details

**Changes in `app.js`.**
- Every response gets an `X-Request-Id` header. A client-supplied one is ignored,
  so nobody can forge log entries.
- Unexpected errors are logged on the server with that ID, the route and the
  error type. The request body (it may hold a password) is never logged. In
  production the error message isn't logged either, because MongoDB messages can
  contain emails. The user sees a generic 500 plus the request ID.
- Request problems that used to become 500s are now 4xx: an unsupported charset or
  compression gives 415, and Mongoose validation or cast errors give 400 without
  field details.

### REV-SEC-16: nothing from the API gets cached

Every `/api` response has `Cache-Control: no-store`, so browsers, proxies and
CDNs never keep private data. Before, only auth routes did this.

### REV-SEC-17: only safe links can be saved

**Change.** Image and link fields accept `https://` addresses only. For
admin-managed images (game covers, project images) a site path like
`/images/cover.png` is also allowed. `javascript:`, `data:`, `file:`, links with
embedded passwords and `//other-site` are refused. This matters most for posts,
because members write them.

**Files:** `models/validators.js`, `models/Post.js`, `models/Game.js`,
`models/Project.js`.

### REV-SEC-18: future routes plug in behind the guards

**Changes in `app.js`.**
- `createApp({ mountRoutes })` is a new hook. Your routers are added **after**
  every security layer and **before** the 404 handler. Before, there was no way to
  add routes in the right place.
- New protected areas:
  - `/api/admin/*` and `/api/dashboard/*`: admin only (unchanged).
  - `/api/account/*` and `/api/demo/*`: any signed-in account. **New.**
- Put a router under the right prefix and it's protected automatically. Tests
  check that the uppercase variants `/API/ADMIN/...` and trailing slashes don't
  bypass the guards.
- `mountRoutes` refuses to run without `auth`, so routes can never be mounted with
  the guards missing.

`routes/` and `controllers/` are still empty. Ideas are in
`route-and-dashboard-plan-2026-10-26.md`.

### REV-SEC-19: an AI budget so bots can't spend your credits

**Problem (future).** Every AI explanation costs money. Bots love to press a public
"explain this" button thousands of times ("denial of wallet").

**Change.** A new `models/AiUsage.js` and `services/aiUsageService.js` keep daily
counters in MongoDB:
- a per-account limit (`AI_DAILY_LIMIT_PER_ACCOUNT`, default 5)
- a whole-site limit (`AI_DAILY_LIMIT_SITE`, default 100)

`reserve()` claims a slot in one atomic database step: 20 simultaneous requests
against a limit of 5 got exactly 5. `release()` gives a slot back if the AI call
fails. Old counters delete themselves after about a week. No route uses it yet.

### REV-SEC-20: helpers that stop "change the ID in the URL" attacks

**Change.** `security/access.js` provides:
- `readObjectId(req.params.id)`: anything that isn't a 24-character ID becomes 404.
- `findOwned(Model, { id, ownerId })`: the owner is part of the database query, so
  someone else's record is never even loaded.
- `assertOwner(doc, ownerId)`.

"Doesn't exist" and "belongs to someone else" both return the same 404.

### REV-SEC-21: emails can't contain invisible characters

Emails with control characters, zero-width characters, spaces or line breaks are
refused, in both the API and the database. Line breaks were already blocked, which
stops email-header injection.

### REV-SEC-23: a trailing slash in `CLIENT_ORIGIN` no longer breaks CORS

`app.js` now compares origins the same normalized way `auth.js` does.

## Still open

`security/auth.js` was not changed in this pass. These findings are still open,
and `test/security-database.test.js` has `LIMITATION` tests that show each one, so
you'll see when they're fixed:

1. **One account can be guessed from many IPs.** Limits are per IP, so a botnet
   gets 20 guesses per IP per 15 min against one account; 40 of 40 guesses from 40
   IPs were checked. Your 15-character minimum and Argon2 make this slow, and
   two-step sign-in protects the admin account, but member accounts rely on their
   password alone.
2. **The admin guard trusts the `role` field alone.** If a future route copies
   `req.body` into a user record (for example a careless "edit profile" route), a
   member could make themselves admin. Never pass `req.body` straight into
   `create`, `updateOne` or `findByIdAndUpdate`; pick fields one by one, as
   `register` does.
3. **New state-changing routes need CSRF protection added by hand.** Only the
   routes in `auth.js` check the CSRF token today. Add the existing `auth.csrf`
   middleware to every POST, PUT, PATCH and DELETE route you write, as `auth.js`
   does for `/register` and `/login`.
4. **Email ownership isn't verified.** Someone could register using another
   person's email. Do **not** rely on registering your own email first: create your
   admin account with the script. When an email provider is set up, add
   verification and "your password was changed" notices.
5. **Rate limits live in memory.** They reset on restart and don't cover large
   distributed attacks. For real bot floods, put Cloudflare (free plan) in front of
   the site.

## Setting up your admin account

1. Create the encryption key once and keep it secret:
   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```
   Add `ADMIN_MFA_KEY=<that value>` to `server/.env` and to Render's environment
   settings (the same value in both places).
2. Install an authenticator app on your phone (Google Authenticator, Microsoft
   Authenticator, Authy, 1Password, ...).
3. Inside `server/`, run
   `npm run admin:create -- --email you@example.com --username Jah`.
   Type your password (hidden), add the setup key to the app, and type the code it
   shows.
   - Already registered through the site? Use `--promote` instead of `--username`.
   - Lost your phone? Use `--reset-mfa`. It also signs the account out everywhere.
4. Add your username to `RESERVED_USERNAMES` so nobody can register a near-copy.
5. From then on, the login form needs email, password **and** the 6-digit code. The
   API field is called `code`.

## New and changed settings

None of these were written into your `.env`; add them yourself.

| Setting | Needed | What it does |
|---|---|---|
| `TRUST_PROXY_HOPS` | **Production: required** | Number of proxies in front of the API: `1` on Render, `2` with Cloudflare in front (check), `0` for none. Never higher than the real number. |
| `ADMIN_MFA_KEY` | For the admin account | 64 hex characters (32 random bytes). Encrypts the authenticator secret. |
| `RESERVED_USERNAMES` | Optional | Extra names nobody may register, e.g. `jah,jamar`. |
| `AI_DAILY_LIMIT_PER_ACCOUNT` | Optional | AI summaries per account per UTC day (default 5). |
| `AI_DAILY_LIMIT_SITE` | Optional | AI summaries for the whole site per day (default 100). |

Unchanged and still required in production: `NODE_ENV=production`,
`SESSION_SECRET`, `CLIENT_ORIGIN`, `MONGODB_URI`, `MONGODB_DB_NAME`.

## Tests

### What was run

The tests ran on a copy of your backend against a throwaway MongoDB 8.3 replica
set, set up like Atlas with a `readWrite`-only app user. Your Atlas database was
never contacted.

| Command (inside `server/`) | Tests | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| `npm test` (no database) | 695 | 689 | 0 | 6 |
| `REV_SECURITY_ATLAS=1 npm test` (with database) | 781 | 778 | 0 | 3 |

- The skipped tests are ChatGPT's three "pending product feature" placeholders,
  plus the database-only groups when no database is used.
- Counts include parent and child tests, as in the October 23 report. They count
  checks, not "attacks blocked".
- Raw output is in this folder:
  - `all-offline-2026-10-26.tap`
  - `all-with-database-2026-10-26.tap`

**New test files:**
- `test/security-hardening.test.js`: 74 offline checks, one or more per change
  above.
- `test/security-database.test.js`: 23 attack scenarios against a real database:
  - injection payloads
  - email leaks
  - timing
  - username races
  - reset spam across restarts
  - reset floods from 60 IPs
  - admin two-step sign-in and code replay
  - login and scraping floods
  - anonymous-session floods
  - AI budget races
  - ID-swapping (IDOR) attempts

  It uses only randomly named `_rev_hardening_…` collections, drops them at the
  end, and never sends email. **Run it against Atlas only when you choose to.** It
  sends about 1,500 requests to a local test server and does a few hundred small
  database operations.

**Changed tests:** only assertions that checked old behavior:
- scrypt hash format → Argon2id
- "sanitizeFilter is off" → "is on"
- raw operator filters matching → now neutralized
- reset token read from `?` → from `#`
- duplicate-username registration: `202` → `409`

Every other ChatGPT-written test passes unchanged.

### Bot-flood load test

Real `server.js` process, 100 simultaneous connections, 10 seconds per flood.
These numbers come from this test machine; Render's free tier is much smaller, so
treat them as behavior, not capacity.

| Flood | Result | A real visitor during the flood |
|---|---|---|
| `/api/health` from one IP | 55,079 × 200 (health is never limited) | — |
| API pages from one IP | 300 × 404, then 81,121 × 429 | 37/37 OK, median 20 ms |
| Login spam from one IP | 20 × 403, then 77,747 × 429 | 37/37 OK, median 20 ms |
| Scraping from 100 different IPs | 300 per IP, then 429 | 37/37 OK, median 21 ms |
| 100 KB junk JSON bodies | 380 × 403, then 429 | 39/39 OK, median 9 ms |
| 20,000-deep nested JSON | 6,000 × 400, then 429; no crash | 39/39 OK, median 41 ms |
| Valid-session login guesses (database test) | 20 checked, 380 × 429 | answered in 156 ms |

The server never crashed or ran out of memory, and the health check stayed
up the whole time.

**What this does and doesn't prove.** A single small server can't absorb a real
DDoS. These limits stop scripts and single bots cheaply. For large floods, use
Cloudflare in front of Render.

## Before you deploy

- **Cookies across Netlify and Render.** The session cookie is `SameSite=Strict`.
  Browsers will **not** send it from `yoursite.netlify.app` to
  `yourapi.onrender.com`, because they're different sites. Two options:
  - Have Netlify forward `/api/*` to Render (a Netlify proxy rewrite), so the
    browser only ever talks to one site.
  - Use your own domain for both, e.g. `rev.yourdomain.com` and
    `api.rev.yourdomain.com`.

  With a Netlify proxy, re-check `TRUST_PROXY_HOPS`, because there's then an extra
  hop.
- Set every production setting listed above. `NODE_ENV=production` makes cookies
  Secure and requires an HTTPS `CLIENT_ORIGIN`.
- Atlas: keep the app user at `readWrite` on `rev` only, as it is today. Restrict
  network access, turn on MFA for your Atlas login, and check backups.
- Create your admin account with the script **before** the site is public.

## Files changed

- **Changed:**
  - `app.js`, `server.js`, `package.json`
  - `config/env.js`
  - `security/input.js`, `security/passwords.js`
  - `services/authService.js`
  - every file in `models/`
  - `test/auth.test.js`, `test/auth-atlas.test.js`,
    `test/password-reset.security.test.js`
  - `README.md`
  - the repository `.gitignore` (so `.tap` logs inside the new weekly folders stay
    out of Git)
- **New:**
  - `config/mongooseSecurity.js`
  - `models/validators.js`, `models/AiUsage.js`
  - `security/totp.js`, `security/access.js`
  - `services/aiUsageService.js`
  - `scripts/create-admin.js`
  - `test/security-hardening.test.js`, `test/security-database.test.js`
- **Not touched:** `security/auth.js`, `security/databaseAccess.js`, `config/database.js`, `scripts/check-database.js`,
  `routes/`, `controllers/`, `client/`, any `.env` file.

None of this guarantees the site is unhackable. It closes the specific problems found
and tested here, and adds layers so future routes start out safer.
