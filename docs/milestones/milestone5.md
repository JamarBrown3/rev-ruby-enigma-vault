# Milestone 5 — Deployment and Release Review

Project: REV — The Ruby Enigma Vault  
Status: Release checklist, not a statement that deployment is complete.  
Last updated: November 15, 2026. The prototype is complete and runs locally; deployment is planned for November 16–22. Items marked *(local)* were verified on Jah's computer, not on a live site.

## Release Checklist

- [ ] Deploy the React frontend and Express backend, with MongoDB Atlas configured for the application.
- [x] Deploy and connect the Python service if analytics are included in this release. *(Not included: Python analytics are deferred, so there is nothing to deploy.)*
- [ ] Verify production configuration, allowed origins, HTTPS, session cookies, and restricted database access.
- [x] Keep credentials and environment files out of version control and demo recordings. *(`.env` and `node_modules` confirmed ignored by Git, Nov 3.)*
- [ ] Add the working public URL and setup instructions to the [README](../../README.md).
- [ ] Verify direct navigation and refresh on frontend routes.
- [ ] Test the public experience, member workflows, and private administrator experience on the deployed app.
- [ ] Update issue statuses and document unresolved limitations.
- [ ] Mark only implemented and verified features as complete below.
- [ ] Record a complete demo and add its link to the README.
- [ ] Complete the reflection.

Planned hosting (updated Nov 13): **one Render free web service** where Express serves the built React app from `server/public`, with a fallback so routes like `/privacy` load on refresh. Data stays on MongoDB Atlas M0. One service means one site, so the `sameSite: strict` session cookie works without forwarding. This replaces the Nov 4 plan of Netlify plus Render. Confirm current service limits at deployment rather than assuming permanent free hosting.

Domain: `rubyenigmavault.com`, registered on Cloudflare on Nov 14, 2026 (renews Nov 14, 2027). DNS records will point to Render on deploy day.

Production settings go only in Render's dashboard, never in Git: `NODE_ENV=production`, `MONGODB_URI`, `MONGODB_DB_NAME`, `SESSION_SECRET` (required), `ADMIN_MFA_KEY`, `CLIENT_ORIGIN=https://rubyenigmavault.com`, and `TRUST_PROXY_HOPS` (the server refuses to start in production without it). Use `1` on Render, or `2` if Cloudflare's proxy (orange cloud) is turned on. Never set it higher than the real number of proxies, or visitors could fake their IP address and get around rate limits.

Render's free server sleeps after about 15 minutes, so open the site a few minutes before any demo to wake it up.

## Feature Verification

Unchecked items are release targets to verify, not completed work.

### Core Application

- [x] React frontend, Express API, and MongoDB/Mongoose persistence work together. *(local)*
- [x] Public Home, About, and Services pages work. *(local)*
- [x] Post cards open dedicated detail views through React Router. *(local)*
- [x] Posts support GET, POST, PATCH, and DELETE operations. *(local)*
- [x] Authors alone can update or delete their posts. *(local; others get 404)*
- [x] Comments persist and their author permissions are enforced. *(local; server tests and Nov 11 QA with two accounts)*
- [ ] Deleting a post also removes associated comments and votes. *(Code written in `controllers/posts.js`; still needs a test.)*
- [x] Signed-in accounts can like or dislike posts, with at most one vote per account per post. *(local; unique post + user index, server tests, Nov 10 QA)*
- [ ] Game/category references and other model relationships are validated by application logic.
- [ ] Administrators can manage the intended catalog and portfolio records. *(Games: yes, local. Portfolio projects are still written in `client/src/data/site.js`, not managed in the app.)*
- [x] Search, filtering, and sorting work for the content included in the release. *(local: posts and games)*
- [ ] Development seed/test procedures are documented and isolated from live user data.

### Authentication and Security

- [x] Registration, login, logout, and session persistence work. *(local)*
- [x] Passwords are hashed and never returned in API responses. *(Argon2id; covered by tests)*
- [x] Administrator pages and APIs reject unauthorized accounts. *(local; admin login also needs the 6-digit code)*
- [x] Request validation, role assignment, and ownership checks are enforced server-side. *(local; covered by tests)*
- [ ] Password recovery uses expiring, single-use tokens and a configured delivery service; if delivery is unavailable, clearly document that recovery is not release-ready. *(Tokens and the reset route are built and tested. No email service yet, so recovery is **not release-ready**; the login page says so.)*
- [x] State-changing requests have appropriate CSRF protection and rate limits. *(local; covered by tests)*

### Dashboard and Reporting

- [x] The dashboard is accessible only to authorized administrators. *(`/admin/dashboard` is admin only. Scope change Nov 3: a separate sample dashboard at `/dashboard` is public on purpose, as a client demo with made-up data.)*
- [ ] Charts and summary metrics use real records rather than prototype sample values. *(Sample values for now, except the admin Newest posts table.)*
- [ ] Python analytics return verified results and handle missing or insufficient data. *(Deferred, not in this release. An R Shiny forecasting dashboard is a possible bonus after deployment.)*
- [ ] Downloadable PDF reports contain the intended data and readable charts. *(Print / Save as PDF works and was tested Nov 4, but with sample data.)*
- [ ] Loading, error, empty-data, and report-generation states are handled.

### Interface and Accessibility

- [x] Shared navigation, footer, and reusable components work across pages. *(local)*
- [x] Featured-content carousel controls work without relying on automatic motion. *(arrows, dots, arrow keys, Pause)*
- [x] Character reels can be paused, and reduced-motion preferences are respected.
- [x] Layouts remain usable on desktop, tablet, and phone screens. *(desktop and phone tested Nov 4; tablet checked by eye)*
- [x] Forms have labels, clear validation, and keyboard-accessible controls. *(axe, keyboard and WAVE)*
- [x] Colors, focus indicators, image alternatives, and chart summaries are readable and useful. *(alt text Nov 4; every chart has a Show table view; WAVE 0 errors Nov 10–13; VoiceOver Nov 14)*
- [x] Loading indicators and disabled submission controls prevent duplicate requests.
- [x] In-app feedback and confirmation UI replace unnecessary native alerts. *(Delete asks for confirmation in the page)*
- [x] Light/dark preferences persist locally without storing authentication secrets.

## Deferred Enhancements

These are not requirements for this release: newsletter subscriptions/unsubscribe, a TypeScript migration, Shopify integration, and additional analytics beyond the agreed dashboard. Revisit these after the core app is stable.

Added Nov 4: **REV v2 (2027)** moves to Next.js + TypeScript + Postgres, with sign-in with Google and GitHub for members (Better Auth), a cookie consent banner, a live AI summary via n8n, and SEO. Notes are kept outside this repository in `Documents/REV/REV v2/`.

## Final Demo

Not recorded yet. Add a video or GIF link only after the recording exists. macOS QuickTime Player can be used for the screen recording. Demonstrate actual application behavior without showing credentials.

## Reflection

### 1. What went well during release preparation?

To be completed.

### 2. What challenges did I face?

To be completed.

### 3. Which achievements am I most proud of?

To be completed.

### 4. How have my development skills grown since starting REV?

To be completed.

### 5. What are my next learning and development goals?

To be completed.
