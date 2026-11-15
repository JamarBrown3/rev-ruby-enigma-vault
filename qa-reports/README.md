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

All reports were written by ChatGPT as browser QA, with Jah reviewing. Every page tested had 0 WAVE errors and 0 contrast errors.

| Date | Report | Result |
| --- | --- | --- |
| Nov 10, 2026 | [Like/dislike voting](2026/11-november/week-of-2026-11-09/REV-voting-QA-2026-11-10.md) | 2 fails |
| Nov 11, 2026 | [Comments and the home carousel](2026/11-november/week-of-2026-11-09/REV-comments-QA-2026-11-11.md) | 1 wording difference |
| Nov 12, 2026 | [Recharts dashboards, layout, and printing](2026/11-november/week-of-2026-11-09/REV-recharts-QA-2026-11-12.md) | 2 print fails |
| Nov 13, 2026 | [Contact and Privacy](2026/11-november/week-of-2026-11-09/REV-contact-privacy-QA-2026-11-13.md) | 1 fail |

## Follow-up on failed tests

Reports are never edited after the fact; this table tracks what happened next. "Fixed" means the code changed, not that ChatGPT re-tested it.

| Report and test | Finding | Status |
| --- | --- | --- |
| Voting 2.2 | Selected Like is green with a checkmark, not the ruby border in the checklist | Not changed. Jah to decide: keep green plus the checkmark (it already shows "on" without relying on color alone), or switch to ruby to match the checklist |
| Voting 3.4 | Focus was lost after voting | Fixed: buttons use `aria-disabled` while saving; covered by a UI test |
| Comments 1.1 | Says "join the conversation", checklist said "discussion" | Not changed. Jah to decide which wording is right; either works |
| Recharts 5.2 | Business dropdown printed | Fixed in print styles (Nov 12); not re-tested |
| Recharts 5.4 | 30-day Daily sales card splits across two printed pages | Open: 30 rows are taller than one page |
| Contact 4.3b | About "Code" links didn't announce a new tab | Fixed Nov 14 (`af23abe`) with a UI test |
| VoiceOver (Jah, Nov 14) | `$3K` and `$1,956` read as small dollar amounts | Fixed Nov 14: screen readers hear amounts in words (`52d2646`, `fa130d0`, `9558281`) |
