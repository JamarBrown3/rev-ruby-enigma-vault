# Atlas test fixes (31 October 2026)

Running `REV_SECURITY_ATLAS=1 npm test` against Atlas failed 3 tests in
`test/security-database.test.js`. None were security bugs; each test measured
something the internet distorts. Code under `server/` was not changed, only the tests.
Each fix is marked `Atlas fix (2026-10-31)` in the test file.

| Test | What happened on Atlas | Fix |
|---|---|---|
| REV-SEC-10 fake reset links | One Atlas lookup (42 ms) took longer than one Argon2 hash (31 ms). | Measure a plain database round trip and subtract it. The fake link must cost no more than a lookup, never a hash. |
| BOT FLOOD 400 logins | macOS refused 400 brand-new local connections opened at once (`ECONNRESET` from the test's own client). | Send the 400 attempts in 8 waves of 50. Still expects exactly 20 processed and 380 refused. |
| BOT FLOOD 60 sessions | 60 answered but 0 counted: the count ran before the session saves finished over the internet (slowed further by leftover work from the failed flood test). | Wait up to 10 s for saves to land, then check again that no more than 60 exist. |

Result on a local database after the change: 792 tests, 789 passed, 0 failed, 3 skipped.
