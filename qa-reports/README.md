# REV QA reports

Reports are plain Markdown so Claude and other reviewers can read them directly. Screenshots sit beside each report, preserving its relative links.

## Folder convention

```text
qa-reports/
  YEAR/
    MM-month/
      week-of-YYYY-MM-DD/
        REV-feature-QA-YYYY-MM-DD.md
        screenshots...
```

Weeks start on Monday. The dated report records the tested version/state, results, reproduction steps, cleanup, and untested items. A test finding is not evidence that a fix was implemented; later retests should record what changed and their own results. Preserve earlier reports rather than overwriting them. Never include credentials, cookies, tokens, or .env contents.

## Reports

- [November 10, 2026 — Like/dislike UI QA](2026/11-november/week-of-2026-11-09/REV-voting-QA-2026-11-10.md): voting behavior, keyboard interaction, ARIA, phone layouts, signed-out WAVE, and the blocked signed-in WAVE check. No source changes were made.
