# REV password-reset security review

> Historical pre-fix findings. Code and Atlas permissions were subsequently
> changed; see `security-fixes-2026-10-23.md` for the verified current status.

Date: 23 October 2026

## Verdict

The saved model has one confirmed configuration bug. The application is not
ready for a production authentication/security sign-off: registration, login,
password-reset, email-change, session, and admin authorization routes are not
implemented. There was no demonstrated takeover through the current HTTP API.
That is not proof those future features will be secure.

The highest-priority configuration issue is the application's MongoDB database
user: read-only role inspection returned `atlasAdmin`, with `dropDatabase`
among its privileges. A compromised application credential would have an
unnecessarily broad impact. No administrative action was attempted.

## What was actually run

| Run | Registered checks | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Adversarial suite with isolated Atlas checks | 589 | 580 | 1 | 8 |
| Adversarial suite offline | 540 | 530 | 1 | 9 |
| Entire existing plus new offline test suite | 548 | 538 | 1 | 9 |

These are overlapping runs, not additive totals. Node's counts include the
Atlas parent test and its 49 subtests. Of the 589 registered checks, 581
executed and eight were explicitly skipped. Additional checks: six read-only
requests against the already-running server on port 3002 passed; `npm audit
--omit=dev --json` reported zero known dependency vulnerabilities at test time.
Neither result is a general security guarantee.

Passing cases include negative-input rejection, ordinary API behavior,
observations of schema limitations, and deliberate unsafe-query/defense
comparisons. Do NOT describe this as "580 hacking attempts blocked."

### Coverage

- Token-hash lengths, invalid character positions, Unicode/control characters,
  malformed identifiers, invalid dates, required fields, and operator objects.
- MongoDB operator objects such as `$ne`, `$regex`, `$in`, `$nin`, and `$not`.
- Query-casting behavior versus document validation and explicit nested-filter
  sanitation.
- Unknown fields and prototype-pollution-shaped input; forged identity headers,
  cookies, and authorization headers against the current route skeleton.
- Bounded malformed/oversized JSON and CORS origin variations.
- JavaScript/HTML/SQL-looking strings stored as inert content. These are storage
  checks, NOT browser XSS testing or execution of malicious JavaScript.
- Real unique/TTL indexes, hidden-field projections, duplicate hash rejection,
  expiration/user-binding query examples, and replay/concurrency examples.
- A transaction rollback example on isolated fixture data.

## Findings, in priority order

### 1. High priority: database connection uses `atlasAdmin`

Evidence: read-only `connectionStatus` showed the role `atlasAdmin` and the
`dropDatabase` action. Usernames, passwords, hostnames, and the URI were not
displayed or saved in this report.

Recommended action before deployment:

1. In Atlas Database Access, create a separate application database user.
2. Give it `readWrite` only on REV's configured application database, currently
   `rev`, not administrative access or access to every database.
3. Put the new user's connection credentials into the private server environment
   yourself. Do not paste them into chat, source code, screenshots, or Git.
4. Restart the server and verify database health, index creation, and normal
   application operations using the limited account.
5. Retire the old application credential after verifying the replacement.
   Keep human Atlas ownership/recovery access separate and enable MFA.
6. Review Atlas network access and backups/recovery separately; they were not
   audited here. A `readWrite` credential can still alter/delete application
   data, so least privilege is not a substitute for recovery and authorization.

Do not delete your only working Atlas owner/login or revoke credentials before
the replacement has been verified. No permissions or credentials were changed
by this review.

REV's `User.role = "admin"`, a MongoDB database user's role, and an Atlas
website owner's role are three different things. A website administrator should
not receive infrastructure credentials. Atlas database users and Atlas console
users are separate identities; changing an Atlas database user's credentials is
managed through Atlas, not automatically granted by a REV login.
[Atlas database-user documentation](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)

### 2. Confirmed code bug: misspelled collection option

Location: `server/models/PasswordResetToken.js`, line 48.

Current:

```javascript
colection: "passwordResetTokens",
```

Required correction:

```javascript
collection: "passwordResetTokens",
```

Mongoose currently selects `passwordresettokens` instead of the intended
`passwordResetTokens`. MongoDB collection names distinguish these names. The
regression test deliberately fails until the source is corrected. This is a
configuration/data-location bug, not a demonstrated account-takeover exploit.

The source was left unchanged because this request was to inspect and test.
No collection was renamed, migrated, or dropped to fix this finding. If any
real reset records later exist under either name, inspect them before making
a migration decision; do not reset the database blindly.

### 3. Required future control: typed, allowlisted controller input

The model rejects MongoDB operator objects as document field values. However,
Mongoose query filters legitimately accept operators. In isolated Atlas data,
raw client-shaped operator filters matched a fixture record. This demonstrates
how an unsafe future controller could become injectable, NOT an injection
through an existing REV endpoint.

Do not pass `req.body` or `req.query` directly into `findOne()`, `updateOne()`,
or a MongoDB aggregation. Validate scalar types/lengths/formats and build filters
and updates from explicitly allowed fields. In registration, set `role`,
`status`, and `sessionVersion` on the server. Derive acting account IDs from a
validated session, not client-supplied authorship/role fields.

Explicit nested `sanitizeFilter()` comparisons rejected the tested nested
operator values, but sanitation is defense in depth, not a complete replacement
for input validation or authorization. In particular, never accept top-level
`$where` or other executable/client-controlled query structures.
[Mongoose filter sanitation](https://mongoosejs.com/docs/api/mongoose.html#Mongoose.prototype.sanitizeFilter())
[OWASP NoSQL guidance](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html)

Observed schema boundaries:

- Admin is a valid model role. A future `new User(req.body)` would therefore
  allow role mass assignment unless its controller explicitly excludes it.
- Mongoose can cast a one-element identifier array to an ObjectId.
- An empty optional `usedAt` string becomes `null`.
- `select: false` hides fields on normal queries, not on newly created document
  JSON. Never serialize reset-token documents or return newly created User
  documents directly without a public-field allowlist.
- The current User model accepts malformed email strings and fractional
  `sessionVersion` values. Add intentional validation/hardening before exposing
  account APIs; do not rely on schema casting as HTTP input validation.
- Update validation is not enabled automatically. Document cross-field hooks
  are not a blanket guarantee for arbitrary update operators.
[Mongoose update validation](https://mongoosejs.com/docs/validation.html#update-validators)

### 4. Password-reset behavior is not implemented yet

The reset model is storage, not a complete recovery service. Before launch:

- Generate high-entropy secrets with Node crypto, store only their digest, and
  never log or return secrets through an ordinary API response.
- Hash passwords with an appropriate password-hashing library, not SHA-256.
- Use fixed, trusted HTTPS reset-link origins and avoid token leaks through
  logs/referrers. Merely viewing a link must not consume it.
- Add rate limits, consistent account-existence responses/timing, and email
  ownership/delivery controls.
- Check unused status, expiration, and account binding in the server's reset
  operation, then consume atomically with the password change and session-version
  increment. Invalidate other outstanding reset tokens.
- Check session versions during authenticated requests. Add secure cookie,
  session regeneration/revocation, CSRF, and authorization behavior.
- Require a normal login after recovery and send an account-change notification.

The database-only ten-request atomic-consumption example allowed exactly one
success; replay was rejected. The isolated rollback example restored both the
fixture account and token record after an intentional failure. These examples
prove database primitives work, NOT that REV's future controller implements
the entire protocol.
[OWASP password-recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

### 5. Two misleading comments in the saved model

- Line 21: uniqueness of `tokenHash` prevents duplicate hashes. It does not
  prevent multiple outstanding reset requests for one user. The real database
  accepted two distinct hashes for the same fixture account.
- Line 57: TTL deletion is not guaranteed within 60 seconds. Background cleanup
  may take longer under load. Reject expired tokens in the reset operation
  regardless of whether MongoDB has physically removed them.
[MongoDB TTL timing](https://www.mongodb.com/docs/manual/core/index-ttl/#timing-of-the-delete-operation)

## Safety and cleanup

- Actual models were imported and tested; no production model/controller source
  was edited. Only a reusable test file and reports were added.
- Offline adversarial checks block the indirect `.env` read from the app import.
  Authorized Atlas checks used the existing environment loader privately; secret
  file contents were not opened for inspection, printed, or copied into reports.
- Atlas mode used a separate connection with auto-creation/indexing disabled,
  preventing imported real models from creating real collections/indexes.
- Only these three exact temporary collections were created and removed:
  - `_rev_security_1ba7541912b902bad0036061_tokens`
  - `_rev_security_1ba7541912b902bad0036061_users`
  - `_rev_security_1ba7541912b902bad0036061_posts`
- Follow-up exact-name checks confirmed zero of those collections remain. One
  combined-name introspection request was rejected by Atlas (code 8000); the
  subsequent individual exact-name checks succeeded.
- Temporary fixture deletion is intentional and not recoverable; it contained
  no real account/post data. Real records and credentials were not changed.
- No real emails were sent, no account was locked out, and no administrative or
  credential-changing operation was attempted. No server-side JavaScript was
  executed in MongoDB, and no database-drop command was issued.
- The existing server was left running. Temporary test HTTP servers/connections
  were closed.

## Reproduce

From `/Users/jamarbrown/Documents/rev-ruby-enigma-vault/server`:

```sh
# Local checks; deliberately fails on the currently misspelled collection option.
node --test test/password-reset.security.test.js

# Existing plus new local checks; no Atlas mutation by default.
npm test

# Explicit opt-in: creates/tests/removes isolated collections in configured DB.
REV_SECURITY_ATLAS=1 node --test test/password-reset.security.test.js
```

The absent-route expectations are a baseline for the current skeleton. Replace
them with real success/denial/abuse tests as routes are implemented; a 404 is
not authentication protection. Extend or replace the skipped placeholders as
each security feature becomes executable. Do not publish this as a penetration
test certification or claim the website is unhackable.

Machine-readable results are in `password-reset-atlas.tap`,
`password-reset-offline.tap`, and `all-offline.tap` alongside this report.
