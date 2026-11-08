# Milestone 4 — Integration, Analytics, and Verification

Project: REV — The Ruby Enigma Vault  
Status: Working checklist; completion must be supported by testing.  
Last updated: November 5, 2026

## Checklist

- [ ] Review the project board and GitHub milestone progress, if configured.
- [x] Verify the core React-to-Express workflows using persisted MongoDB data. *(Oct 31: login, register, posts and admin game create/delete through the React pages and the route tester.)*
- [ ] Check login/logout, ownership restrictions, signed-in voting, and administrator access through both the UI and API. *(Login/logout, ownership and admin access are verified. Voting isn't built yet.)*
- [ ] Verify that deleting a post removes its related comments and votes. *(The cleanup code is written: deleting a post also deletes its comments and votes, in `controllers/posts.js`. It can't be tested yet because nothing creates comments or votes; there are no routes for them.)*
- [x] Build the private dashboard after the core content workflows are reliable. *(Admin dashboard at `/admin/dashboard`, admin only. Its charts use sample numbers; the Newest posts table is live.)*
- [x] Connect the planned Python analytics and PDF reporting, or explicitly document any release limitation. *(Limitation: Python analytics are not in this release. Reports come from the browser's Print / Save as PDF, tested Nov 4.)*
- [ ] Compare dashboard calculations with known test records and handle empty datasets.
- [x] Test responsive layouts, keyboard access, reduced motion, and readable colors. *(axe Oct 31; phone and desktop on 15 pages Nov 4; 200% zoom, Tab navigation and WAVE Nov 4-5. A VoiceOver screen reader test is still to do.)*
- [x] Verify loading indicators, disabled submission controls, validation messages, and recovery from request failures. *(Forms disable while sending; errors show in the page; a 401 shows "Your session ended".)*
- [ ] Update the [README](../README.md) with only genuinely completed features.
- [ ] Add screenshots or GIFs showing those features in use.
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

Still open:
- Comments and like/dislike votes: models (with the one-vote-per-account index) and delete-cleanup are done; routes, controller and frontend are not.
- Dashboard charts use sample data, not real records.
- Password reset works and is tested on the server, but no email service sends the link yet.
- VoiceOver screen reader test.
- Recharts switch for the dashboard charts (planned).

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
