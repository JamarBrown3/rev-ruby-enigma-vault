> **Superseded on 26 October 2026** by [`../week-of-2026-10-26/security-hardening-2026-10-26.md`](../week-of-2026-10-26/security-hardening-2026-10-26.md). This report describes the scrypt version from before the switch to Argon2.

# REV security fixes: verified current status

Date: 23 October 2026. This supersedes the earlier pre-fix review/checklist.

## Completed changes

- Fixed `collection: "passwordResetTokens"`; corrected the misleading uniqueness
  and TTL comments. Hashes are redacted from reset-document JSON.
- Added a session-version snapshot to reset records. Old records without this
  required field are not accepted by the new recovery service. No legacy
  collection/data migration or database reset was performed.
- Added User email format/length validation, safe-integer session versions,
  and JSON redaction of password hashes/session versions.
- Added bounded JSON-depth/operator/prototype-key rejection and strict typed,
  allowlisted auth inputs. Registration rejects role/status/hash/version fields
  and explicitly creates role=user. Schemas still permit trusted admin records;
  public registration cannot choose that role.
- Added salted scrypt password hashing, constant-time hash verification, the same
  KDF workload for unknown accounts, and bounded concurrent KDF memory use.
- Added actual `/api/auth` registration, login, logout, CSRF-bootstrap and current
  account routes. Sessions persist through connect-mongo, use HttpOnly/SameSite
  cookies, and rotate session IDs/CSRF tokens on login. Production requires a
  private signing secret and HTTPS configuration; development uses HTTP-local
  cookies and a temporary signing key if no secret is configured.
- Added session-version/status validation, an eight-hour absolute session bound,
  a thirty-minute idle cookie, Origin/CSRF checks, rate limits, and Helmet headers.
  Admin/dashboard prefixes are guarded by the current database role, not forged
  headers or role fields in the browser. Dashboard content is not implemented.
- Added the actual password-reset service: random 32-byte secret, SHA-256 digest
  storage, fifteen-minute deadline, account-version binding, and one transaction
  for consumption/password update/version increment/invalidation of all requests.
- Configured recovery queues lookup/delivery after the generic HTTP response,
  with bounded per-process work and per-IP/per-address limits. Real delivery is
  NOT configured and remains disabled with a 503; no token-returning debug API
  or console-token fallback was added.
- Narrowed the existing Atlas `rev_app` user's privileges from `atlasAdmin` to
  exactly `readWrite @ rev`, restricted to the `rev-database` cluster. This did
  not change the password, database name, cluster, or human Atlas-owner access.
  A fresh driver connection/ping confirmed the narrowed role with no elevated role.
- Added a startup role guard that refuses broad/wrong-database credentials, and
  waits for unique User/reset-token indexes before accepting requests.
- Restarted the existing local server with the changes. It is listening on
  127.0.0.1:3002. No .env contents were opened for inspection or modified.

## Verification

Combined opt-in test run:

```sh
REV_SECURITY_ATLAS=1 npm test -- --test-reporter=tap --test-reporter-destination=security-reports/all-security-fixed-atlas.tap
```

- 684 registered checks: 681 passed, zero failed, three explicitly skipped
  product-feature groups. Counts include parent tests and overlap with earlier
  runs; they are not a count of attacks blocked.
- Actual Atlas/controller/session integration verified registration with a
  normal user, rejection of role=admin, persistent session/TTL storage, login
  rotation, dashboard denial for a regular user, password change, old-password
  rejection, new-password login, replay rejection, invalidation of another token,
  old-session revocation, expired-token rejection, and server-side logout.
- Existing controlled ten-request token-consumption/concurrency and rollback
  comparisons also passed under the narrowed database role.
- Separate offline tests covered production cookie flags, proxy trust behavior,
  invalid/oversized/operator input, CSRF/Origin denial, rate limits, public-field
  allowlisting, KDF behavior, and least-privilege startup checks.
- Eight additional checks against the restarted real server passed: liveness,
  database readiness, cookie/CSRF bootstrap, NoSQL rejection, admin-signup-field
  rejection, forged-role denial, disabled recovery, and anonymous-session logout.
  No real user account was created by these live-server smoke checks.
- npm audit reported zero known production-dependency vulnerabilities at test
  time. This is not proof of comprehensive application security.

All six randomly named Atlas fixture collections in the combined run were
removed. These were disposable synthetic users/tokens/posts/sessions; no existing
account/post data was deleted. The live smoke check's new anonymous session was
removed through normal logout. Atlas-owner access and existing credentials were
not deleted or rotated. No real email was sent.

Permission-change screenshot: `/tmp/rev-atlas-least-privilege.png`.

## Remaining product/deployment work

1. Choose and configure a real email-delivery adapter and verified sender. The
   recovery transaction is implemented and integration-tested with a private
   in-memory mail sink, but public email delivery/ownership verification is not.
2. Set a cryptographically random production SESSION_SECRET privately; choose
   CLIENT_ORIGIN, SameSite, proxy trust, and HTTPS according to the real hosting
   topology. No production credentials were invented or written into .env.
3. A multi-instance deployment needs a shared rate-limit store and durable email
   worker. Current limits/queue are single-process and reset on restart.
4. Implement post CRUD with authenticated ownership checks when those routes are
   built. Dashboard data/UI and frontend auth forms are also not built yet.
5. Perform browser-level XSS/accessibility/frontend tests, configure reset-page
   referrer/logging protections, verify mailbox ownership and change notifications,
   and implement future email changes as their own reauthenticated workflow.
6. Review owner MFA, Atlas network access, and backups/recovery separately. Limited
   readWrite access can still alter/delete application data. No test or role
   restriction makes the site unhackable or replaces backups.

The backend README documents the Postman CSRF/cookie flow and deployment settings.
