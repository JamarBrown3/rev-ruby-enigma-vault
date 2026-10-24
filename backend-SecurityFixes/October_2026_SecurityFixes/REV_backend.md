# REV backend: authentication foundation

This is the Express/MongoDB foundation, not the completed application. Models,
registration/login/logout, MongoDB-backed sessions, CSRF checks, rate limits,
and the password-reset transaction are implemented. Post CRUD, dashboard data,
the frontend auth forms, and real reset-email delivery are still future work.

## Setup

1. Run `npm install` inside `server`.
2. Enter the Atlas URI privately in `server/.env` as `MONGODB_URI`.
3. Set `MONGODB_DB_NAME` to the actual app database (default `rev`). This is not
   necessarily the Atlas cluster name. The app database user must have exactly
   `readWrite` on that database; startup refuses broad administrator credentials.
4. Keep Atlas's connection options. Replace its password placeholder locally;
   URI-encode any special characters in the password. Never paste credentials in chat.
5. Verify your current machine IP is permitted by Atlas. Do not open access to
   every IP just to bypass a connection error.

`config/env.js` loads the local `.env` by an absolute file-relative path, so both
npm commands and direct imports behave consistently. Deployments can supply
environment variables instead. No extra `--require dotenv/config` is needed.

## Commands (run inside server)

- `npm test`: local model/input/HTTP/auth tests; no Atlas connection by default.
- `REV_SECURITY_ATLAS=1 npm test`: opt-in integration checks in randomly named,
  temporary Atlas collections. Fixtures are removed; no real accounts are used.
- `npm run db:check`: authenticate, run one read-only ping, close the connection.
- `npm run db:smoke`: authenticate, run 12 read-only pings in four rounds of three,
  report latency, and close the connection. This is NOT a capacity/stress benchmark.
- `npm run dev`: run with Node's built-in watch mode (no nodemon).
- `npm start`: run without watch mode.

The server starts listening only after MongoDB connects and responds to a ping.
Default port is 3002 so On the Fly can continue using 3001.

CORS allows credentialed browser responses only for `CLIENT_ORIGIN`, defaulting
to `http://localhost:5173`. Set the real frontend origin in deployment settings.
No `.env` edit is needed to use this local default. Requests without an Origin
header (such as ordinary Postman requests) still work. CORS is not authentication
or CSRF protection; those protections are part of the later session work.

## Postman / browser checks

- `GET http://localhost:3002/` -> JSON API greeting.
- `GET http://localhost:3002/api/health` -> 200 liveness response.
- `GET http://localhost:3002/api/health/database` -> 200 after a live database ping;
  503 if the database is unavailable.
- Unknown paths -> JSON 404; malformed JSON -> JSON 400.

Ping proves connectivity/authentication, not that every application feature works.
No load test on a shared Atlas cluster should be performed without an explicit
request budget and environment check. The test reports distinguish model
observations from actual authentication and database integration tests.

Commit `.env.example`, `package.json`, and `package-lock.json`. Do not commit
`.env`, credentials, or `node_modules`. The root `.gitignore` already covers them.

## Authentication API / Postman

All auth URLs start with `/api/auth`; there are no duplicate `/api/login` aliases.

1. `GET /api/auth/csrf`: keep Postman's cookie jar enabled. Copy `csrfToken` from
   the JSON response into an `X-CSRF-Token` header on state-changing requests.
2. `POST /api/auth/register`: JSON `{ "username": "...", "email": "...",
   "password": "..." }`. Passwords must contain 15–128 characters. The response
   is a generic 202 for registration/duplicate registration. Role/status/hash
   fields are rejected; the server always creates a normal user.
3. `POST /api/auth/login`: JSON email/password with the cookie and CSRF header.
   Successful login rotates the session and returns a NEW CSRF token: replace
   the old header value. Passwords use salted scrypt, not reversible encryption.
4. `GET /api/auth/me`: validates the current account status/session version and
   returns only id, username, and role.
5. `POST /api/auth/logout`: include the current CSRF header. The server destroys
   the session, not merely the browser cookie.

Browser fetches must use `credentials: "include"`. Never put a password, session
ID, or reset token into localStorage. Presentation preferences may use it later.

`/api/admin` and `/api/dashboard` prefixes require a current admin account; the
actual dashboard endpoints are not built. Public registration cannot create an
admin. An existing owner may assign an administrator through a trusted,
out-of-band database administration workflow—not through a public signup field.

## Password recovery: deliberately not enabled for public delivery

The service generates 32 random bytes, stores only their SHA-256 digest and a
15-minute deadline, and binds each request to the account's session version.
Reset consumes the token, changes the password, increments the version, and
invalidates other requests in one MongoDB transaction. Old sessions are rejected
on their next authenticated request. TTL is cleanup, not the expiration check.

The real server has NO mail provider configured. Forgot/reset endpoints therefore
return 503 after the normal input/CSRF checks; they never return a raw token.
To enable recovery, supply a trusted `deliverResetEmail({ to, resetUrl })` adapter
to `createAuthService()` in server startup. The adapter must deliver to that
address, not to a client-selected destination. Do not replace delivery with
console logging, a debug API, or a hard-coded shared token. Changing an account's
email remains a separate future feature and is not implemented by this service.

Configured recovery responds before account lookup/email delivery using a bounded
single-process queue, with per-IP and per-address limits. Use a durable worker
and shared rate-limit store before running multiple production instances. Add
real mailbox verification, reset notifications, and browser-level tests before
launch. The integration tests use a private in-memory mail sink, not real email.

## Deployment settings (enter privately; no .env edits were made for you)

- `NODE_ENV=production`: enables Secure cookies and requires HTTPS origins.
- `SESSION_SECRET`: at least 32 cryptographically random bytes, represented as a
  private secret string. Do not use a sentence or the example text from a test.
  Development without this setting uses a random in-memory signing key; a restart
  requires signing in again. Production refuses an absent/short secret.
- `CLIENT_ORIGIN`: the exact frontend HTTPS origin in production.
- `SESSION_SAME_SITE`: `strict` by default; `lax` or `none` must be chosen to match
  the real deployment. `none` requires Secure/HTTPS; CSRF checks remain required.
- `TRUST_PROXY_HOPS`: set only for the known hosting proxy topology (for example
  one trusted reverse proxy). Default is false: arbitrary forwarded headers are
  not trusted. Secure cookies cannot be issued over an untrusted plain HTTP hop.

Local development listens only on 127.0.0.1. Production listens on 0.0.0.0 for
the hosting proxy. Keep secrets out of Git, restrict Atlas network access, enable
owner MFA, and verify backups/recovery separately. These code changes are not a
complete production-security certification.
