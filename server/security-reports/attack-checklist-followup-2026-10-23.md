# Operation Ruby Enigma checklist: verified follow-up

> Historical pre-fix findings. Code and Atlas permissions were subsequently
> changed; see `security-fixes-2026-10-23.md` for the verified current status.

Date: 23 October 2026

## Results

Added 22 checks for the supplied checklist. All 22 passed as explicitly labelled
behavior/limitation checks, not as proof the corresponding defenses exist.

Current offline adversarial suite: 562 registered, 552 passed, one failed,
nine skipped. The failure remains the misspelled `colection` option in
`server/models/PasswordResetToken.js:48`. Eight missing-feature groups and the
opt-in Atlas group were skipped. Raw output: `password-reset-checklist-followup.tap`.

No new Atlas mutation checks were needed: the earlier isolated Atlas run already
tested the unique/TTL indexes, guarded token-consumption race, replay rejection,
and transaction rollback. Its evidence remains `password-reset-atlas.tap` and
the original review. Do not combine the overlapping run totals as independent
successful attack defenses.

## Five vectors, with corrected conclusions

### 1. NoSQL login injection

Fresh tests POSTed these exact input shapes to both `/api/login` and
`/api/auth/login` on an isolated instance of the actual application:

```json
{ "email": { "$ne": null }, "password": { "$ne": null } }
```

```json
{ "email": { "$gt": "" }, "password": "password" }
```

A `$regex`/`$exists` variant was also checked. All returned the existing JSON
404 and issued no session cookie, because there is no login route. This is NOT
authentication passing an injection test.

The supplied report overstates the automatic bypass: selecting an unintended
account is dangerous, but correct password verification is an additional check;
the first matching record is not guaranteed to be an administrator. The actual
login controller must reject object/array email/password inputs, enforce bounded
string formats, select explicitly, and verify the password before issuing a
session. A safe invalid-type response may be a clean 400, rather than the exact
text "Invalid credentials"; status text alone is not a security assessment.

`express-mongo-sanitize` is not mandatory and is not a complete fix. Do not
install a package solely because a checklist says to. Explicit input validation,
server-built filters, field allowlists, and appropriate query sanitation are the
core requirements. Never evaluate or pass through client-controlled queries.
[OWASP NoSQL guidance](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html)

### 2. Password-reset hijack and ghost tokens

Fresh forgot/reset requests returned 404. Repeating an identical token request
also returned 404: there is no password-change operation yet, so it cannot prove
an end-to-end replay defense.

An added model test demonstrated that SHA-256 hashing the weak secret `1234`
still satisfies the 64-hex-character schema validator. A correctly formatted
hash is not evidence that its source secret had enough entropy. The controller
must generate secrets using a cryptographically secure generator.

The previous isolated database test allowed exactly one of ten concurrent
guarded consumptions and rejected replay. It is an example of the required
atomic database behavior, not an implemented password-reset feature.

Requesting a reset with someone's email is normally allowed; it must not grant
access or disclose a reset token. Spoofing an email's From header is not proof of
mailbox ownership. The attacker must obtain/guess the secret or exploit a flaw
to complete the reset.

A TTL index is useful cleanup, not the enforcement of a fifteen-minute deadline.
The reset operation must reject expired records explicitly. Merely deleting a
token after a password change is also not enough if concurrent requests can both
pass the check: coordinate consumption, password update, and session revocation
atomically. A consumed marker can enforce single use; immediate physical deletion
is not the only design.
[MongoDB TTL timing](https://www.mongodb.com/docs/manual/core/index-ttl/#timing-of-the-delete-operation)
[OWASP password-recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

### 3. Session/cookie theft

No session middleware or login cookie is implemented, so session cookie flags,
fixation, rotation, logout, expiry, CSRF, and browser-side theft remain untested.

The supplied flags are a useful starting point, not a complete defense:

- HttpOnly blocks JavaScript from reading the cookie; XSS can still act through
  the victim's authenticated browser.
- Secure limits cookie transport to HTTPS; it does not stop an XSS payload.
- SameSite must fit the frontend/API deployment. Strict can prevent intended
  cross-site cookie flows; None requires Secure and additional CSRF controls.
- Clicking an unrelated site's phishing link does not by itself allow that
  site's script to read REV's cookies.
- Validate session expiry/version server-side and regenerate session IDs on
  authentication; do not rely only on cookie attributes.

REV's existing plan is server-side sessions, not a requirement to introduce JWTs.
[OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

### 4. Role escalation

POSTing role=admin to both registration URL variants returned 404 because neither
route exists. No account was created.

A separate offline test constructed a User with client-shaped data containing
role=admin; validation succeeded and retained the admin role. This is expected
schema behavior, and demonstrates why `new User(req.body)` must never become the
registration implementation. The future controller must explicitly select
username/email, hash the supplied password, and set role=user itself. The same
principle applies to status, sessionVersion, authorship, and ownership fields.

### 5. Credential exposure and database scope

Fresh checks inspected only filenames and ignore decisions:

- No real `.env` filenames were found in the index or reachable local history.
- Server/client/analytics `.env` paths and tested environment variants are ignored.
- The placeholder `server/.env.example` remains eligible for tracking.

This is NOT a full secret-content scan, remote GitHub history audit, or proof a
credential was never exposed elsewhere. Git ignore rules do not erase tracked
files or historical leaks. Rotate any credential known to have been exposed.
[Git ignore documentation](https://git-scm.com/docs/gitignore)

The earlier live role check found atlasAdmin, so least privilege is still an
unresolved configuration action, not a defense already completed. Scope the
application user's readWrite role to the application's database, not the cluster
name (`rev-database` is the cluster name from setup). A limited readWrite account
can still destroy application data through allowed operations; recovery/backups
and application authorization remain necessary. Atlas owner access is separate
from a database user's access.

## Changes and limits

Only the reusable test file and this report were updated/added. No application
code, credentials, account data, or Atlas permissions were changed. No reset
emails were sent. Secret contents were not read in this follow-up, and no Atlas
write operations were run. The known failing regression was preserved honestly.

From `/Users/jamarbrown/Documents/rev-ruby-enigma-vault/server`, reproduce with:

```sh
node --test test/password-reset.security.test.js
```

When real login/register/reset/session routes exist, replace absent-route
assertions with full positive and negative authentication tests. Never treat
a 404, one generic error response, or a large test count as a security guarantee.
