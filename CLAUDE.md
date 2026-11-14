# REV: The Ruby Enigma Vault

REV is the portfolio and flagship project for Jah's company-of-one web development and data analytics business (websites, Shopify storefronts, and dashboards that explain business numbers in plain English). It proves what the business sells: security-first, accessible, tested full-stack work that Jah fully understands. Treat all work here like production work for a client.

## The AI team

- **Claude Code (you):** code, logic, scripts, documentation, and reviewing Jah's code.
- **ChatGPT:** browser QA (WAVE, layout, flows) and AI images. Writes dated reports in `qa-reports/YEAR/MM-month/week-of-YYYY-MM-DD/`.
- **DeepSeek:** co-founder and brainstorming.

History lives in `qa-reports/` and `milestones/`. Read the latest QA report before starting new UI work, and don't assume a report passed: check its Pass/Fail column.

## How to work with Jah

- **Jah hand-types code to learn it.** Don't silently rewrite Jah's files. Give the code, then review what Jah typed and point out exact lines with typos, wrong names, and so on. Fix "small stuff" (comment typos, spacing) only when asked.
- **Build and test before handing over code.** Jah types working code, not guesses.
- **Explain the why** in plain language, briefly. The goal is understanding, not vibe coding.
- **Test the longest content at in-between widths** (about 760–900px), not just phone and desktop.
- **No `!important` in CSS** unless there is truly no other way, and try without it first.
- **Be honest** when something is your mistake.

## Security rules (never break these)

- Never read, edit, print, or ask for any `.env` file. Use `server/.env.example` for variable names.
- Never ask for or handle Jah's password, the admin 6-digit code, `ADMIN_MFA_KEY`, or `SESSION_SECRET`.
- No secrets in Git or chat. Private material lives outside the repo (`Documents/REV/rev_forms/`, `Documents/REV/REV-admin-sign-in.md`). Private response-sheet links never go in code. Only public URLs do.
- Before any push, check the outgoing commits for secrets and sensitive files. Never rewrite history or change global Git config without asking.

## Stack

**`client/`:** React 19, Vite 8, React Router 7, Recharts 3 (dashboards), Vitest and Testing Library.
- `npm run dev`, `npm run build`, `npm test` (UI tests)

**`server/`:** Express 5, Mongoose 9, MongoDB Atlas, sessions (connect-mongo), CSRF, Argon2id, rate limits, admin login with TOTP (6-digit code).
- `npm run dev`, `npm start`, `npm test` (`node --test`, about 790 tests)

**Server patterns** (see `server/security/access.js` and `server/security/input.js`):
- `findOwned()` and `readObjectId()`: other people's items return 404, not 403.
- Throw `HttpError` for expected errors.
- Protect routes with `auth.requireAuth` / `requireAdmin`.
- Use `returnDocument: "after"` on updates.

**Styles:** BEM-style class names (`votes__button`, `comment__meta`), with design tokens in `client/src/styles/tokens.css`.

**Accessibility bar:** WAVE 0 errors, `aria-pressed` on toggles, focus management, `role="status"` announcements, 4.5:1 contrast, Reduce Motion respected.

**Known issue:** npm 10 has a bug with Vitest and Vite 8 (`edgesOut`). If it appears, use `npx npm@11 install ...`.

## Roadmap

- **Deploy:** one Render free web service (Express serves the built React app from `server/public` with an SPA fallback), MongoDB Atlas M0, `NODE_ENV=production`, env vars only in Render's dashboard, Atlas network access, and a custom domain. The plan is in the claude.ai project doc `REV-deploy-plan.md`.
- **Deadline:** Nov 30, 2026 prototype for Dr. Lisa.
- **Bonus:** an R Shiny forecasting dashboard on shinyapps.io (`shinymanager` login) using the same sample data.
- **v2 (2027):** Next.js, TypeScript, Postgres, Google/GitHub sign-in (Better Auth), a cookie consent banner, a live AI summary via n8n, and SEO. Notes are in `Documents/REV/REV v2/`.
