# REV security reports

One folder per week; each week starts on Monday. The newest week holds the
current status.

| Week | Contents |
|---|---|
| [`week-of-2026-10-26/`](week-of-2026-10-26/) | **Current status.** `security-hardening-2026-10-26.md` (what was found, what changed by `REV-SEC-##` tag, test results, still-open items, admin setup) and `route-and-dashboard-plan-2026-10-26.md` (ideas for routes, controllers and dashboards), plus today's raw test logs. |
| [`week-of-2026-10-19/`](week-of-2026-10-19/) | History: the 23 October reviews, written before the switch to Argon2. Superseded by the newest week. |

## Conventions

- Reports are Markdown, named `<topic>-<YYYY-MM-DD>.md`.
- Raw test output is saved as `.tap` next to the report that used it. `.tap` files
  stay on your computer and are not committed: the root `.gitignore` covers
  `server/security-reports/**/*.tap`, because test output can repeat attack payloads.
- Start a new `week-of-<Monday's date>` folder for the next week's work.

## Re-running the tests

Run these inside `server/`:

- `npm test`: no database needed.
- `REV_SECURITY_ATLAS=1 npm test`: also runs the database tests, against your
  Atlas cluster, using temporary collections that are deleted afterwards.
