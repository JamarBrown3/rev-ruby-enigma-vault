# Milestone 4 — Integration, Analytics, and Verification

Project: REV — The Ruby Enigma Vault  
Status: Integration and verification complete locally; the remaining open items are listed below.  
Last updated: November 15, 2026

## Checklist

- [ ] Review the project board and GitHub milestone progress, if configured.
- [x] Verify the core React-to-Express workflows using persisted MongoDB data. *(Oct 31: login, register, posts and admin game create/delete through the React pages and the route tester.)*
- [x] Check login/logout, ownership restrictions, signed-in voting, and administrator access through both the UI and API. *(Voting built Nov 7, browser-QA'd Nov 10 and Nov 11.)*
- [ ] Verify that deleting a post removes its related comments and votes. *(The cleanup code is in `controllers/posts.js` and comments and votes can now be created, but there is still no automated test or recorded manual check for it.)*
- [x] Build the private dashboard after the core content workflows are reliable. *(Admin dashboard at `/admin/dashboard`, admin only. Its charts use sample numbers; the Newest posts table is live.)*
- [x] Connect the planned Python analytics and PDF reporting, or explicitly document any release limitation. *(Limitation: Python analytics are not in this release. Reports come from the browser's Print / Save as PDF, tested Nov 4.)*
- [ ] Compare dashboard calculations with known test records and handle empty datasets.
- [x] Test responsive layouts, keyboard access, reduced motion, and readable colors. *(axe Oct 31; phone and desktop on 15 pages Nov 4; 200% zoom, Tab navigation and WAVE Nov 4-5. VoiceOver tested by Jah Nov 14; dashboard amounts now read as words.)*
- [x] Verify loading indicators, disabled submission controls, validation messages, and recovery from request failures. *(Forms disable while sending; errors show in the page; a 401 shows "Your session ended".)*
- [x] Update the [README](../../README.md) with only genuinely completed features. *(Nov 14)*
- [x] Add screenshots showing those features in use. *(In each [QA report](../../qa-reports/README.md).)*
- [ ] Complete the reflection after this phase.

## Verification Notes

Record test commands, manual scenarios, outcomes, and unresolved issues here as integration work is completed. A backend test passing does not by itself prove that its frontend workflow works. Prototype charts and sample numbers are not evidence of live analytics.

Results so far:

| Date | Check | Result |
| --- | --- | --- |
| Oct 31 | `npm test` in `server/` against MongoDB Atlas | Passing after the IP allow-list fix and three timing/flood test adjustments |
| Oct 31 | Dev route tester (`/dev/routes`, only in `npm run dev`) | 46 of 46 checks pass, including logout |
| Oct 31 | Playwright: visitor, member and admin flows; admin creates and deletes a game | Passed |
| Oct 31 | axe accessibility scan, dark and light themes | No violations |
| Nov 4 | Print to PDF of the sample dashboard | Fixed: phone tab bar hidden, bars keep their colors, cards stay whole (8 pages down to 5) |
| Nov 4 | 15 pages, desktop (1400px) and phone (390px), visitor and admin | No JS errors, no sideways scrolling. The server was mocked, so real logins and saves still need a manual run |
| Nov 4 | Weekday bar chart tooltip | Works with mouse, tap and keyboard; numbers checked by hand |
| Nov 4-5 | Alt text, 200% zoom, keyboard, WAVE | Slide art described; decorative images marked `alt=""` on purpose; WAVE reviewed by Jah |
| Nov 10-13 | Browser QA by ChatGPT: voting, comments, Recharts, Contact and Privacy | See [qa-reports](../../qa-reports/README.md). WAVE: 0 errors on every page tested |
| Nov 14 | VoiceOver pass by Jah | Found `$3K` and `$1,956` misread; fixed so screen readers hear the amount in words |
| Nov 15 | `npm test` in `server/` (offline) and `client/` | Server: 773 tests, 766 pass, 7 opt-in Atlas tests skipped, 0 fail. Client: 37 pass |

Still open (November 15):
- An automated test that deleting a post removes its comments and votes.
- Dashboard charts use sample data, not real records.
- Password reset works and is tested on the server, but no email service sends the link yet.
- Printing the 30-day Daily sales card splits it across two pages ([Recharts QA](../../qa-reports/2026/11-november/week-of-2026-11-09/REV-recharts-QA-2026-11-12.md), test 5.4).

Closed since November 5: comments and votes (built Nov 7), the VoiceOver test (Nov 14), and the Recharts switch (Nov 12).

## Reflection

### 1. What went well?

To be completed.

### 2. What integration or data problems did I encounter?

To be completed.

### 3. Which planned tasks did I finish, and how will I prioritize the rest?

To be completed.

### 4. Which features are at risk, and what will I simplify or defer?

To be completed.

### 5. What support do I need before deployment?

To be completed.
