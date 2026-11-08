# Milestone 3 — Implementation Planning and Core Workflows

Project: REV — The Ruby Enigma Vault  
Status: Working checklist; check items only after verifying them.  
Last updated: November 5, 2026

## Checklist

- [ ] Create a GitHub project board with Backlog, In Progress, Testing, and Done columns.
- [ ] Create at least five actionable issues from the feature list, each with acceptance criteria.
- [ ] Record the actual issue links below after creating them.
- [ ] Keep issue statuses current as work progresses.
- [ ] If using GitHub Milestones, create the five project phases listed below and assign issues.
- [ ] Review milestone progress using completed issues; close a milestone only when its acceptance criteria are met.
- [ ] Update the [README](../README.md) to distinguish implemented features from planned features.
- [ ] Add screenshots or short GIFs demonstrating completed workflows.
- [ ] Complete the reflection after this phase.

## Work Completed So Far (as of November 5, 2026)

GitHub issues and a project board have not been set up yet, so this list stands in for them.
Each line says how it was verified.

| Date | Work | How it was verified |
| --- | --- | --- |
| Oct 19-26 | Express API set-up: security middleware, session login, Argon2id passwords, CSRF tokens, rate limits, admin 6-digit TOTP code | Automated tests in `server/test/` (offline and against Atlas); reports in `server/security-reports/` |
| Oct 26 | Games API: list and view for everyone; create, update and delete for the admin only | Tests plus the dev route tester |
| Oct 29-31 | Posts API: reviews and discussions with GET, POST, PATCH and DELETE; only the author can edit or delete (others get 404) | Tests plus the route tester (46 checks passing) |
| Oct 31 | Atlas database tests fixed (IP allow-list; three timing and flood tests adjusted) | Full Atlas run passing; notes in `server/security-reports/week-of-2026-10-26/` |
| Oct 31 | React frontend from the Figma wireframes: Home, Games, Game detail, Post detail, Post editor, About, Services, Contact, Login/Register, Profile, member dashboard, admin sign-in, admin dashboard, game editor, 404 | Playwright runs as visitor, member and admin; axe scan with no violations |
| Oct 31 | Phone tab bar, admin slide-out menu, light/dark theme saved on the device, character reels with Pause, featured slider with Pause and arrow keys | Playwright keyboard, Escape and focus checks |
| Nov 3 | Sample dashboard opened to every visitor (`/dashboard`) as a client demo | Manual check |
| Nov 3-4 | Original REV art: AI-generated mascots and slide art replaced the copyrighted game characters | Manual review |
| Nov 4 | Dashboard printing fixed (phone tab bar hidden, bar colors kept, cards not split); weekday chart tooltip added | Printed to PDF; mouse, tap and keyboard tooltip tests |
| Nov 4 | End-to-end check: 15 pages at desktop and phone width, as visitor and admin | No JavaScript errors and no sideways scrolling (server answers were mocked) |
| Nov 4-5 | Accessibility pass: alt text for the slide art, 200% zoom, keyboard navigation, WAVE | Jah's manual checks plus WAVE (Jah, with ChatGPT as QA) |

## Suggested Issue Backlog

These are proposed issue titles, not claims that GitHub issues already exist.

1. Verify authentication and session behavior end to end.
2. Implement and test post CRUD with author-only updates and deletion.
3. Implement comments and signed-in voting with duplicate-vote protection.
4. Connect React post cards, detail views, and reusable create/edit forms.
5. Add catalog search/filtering and reliable loading, empty, and error states.

Actual issue links: To be added after creation.

## Project Phases

1. Project Vision and Scope.
2. Wireframes and Data Design.
3. Implementation Planning and Core Workflows.
4. Integration, Analytics, and Verification.
5. Deployment and Release Review.

GitHub milestone links: To be added if project tracking is configured there.

## Reflection

Complete after this phase; do not treat these prompts as finished work.

### 1. What went well?

To be completed.

### 2. What technical or planning challenges did I face?

To be completed.

### 3. Which planned tasks did I finish, and how will I prioritize the rest?

To be completed.

### 4. Which features are at risk, and what scope or sequencing changes will help?

To be completed.

### 5. What explanations, tools, or support do I need next?

To be completed.
