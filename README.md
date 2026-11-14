# REV | The Ruby Enigma Vault

Built by **Jamar (Jah) Brown**.

REV is a gaming community and a portfolio for my work in web development and data analysis. Browse the game library, read reviews and discussions, or try a sample business dashboard with sales trends and plain-English summaries.

## What you can do

| Page | What it offers |
| --- | --- |
| **Home** (`/`) | Browse, search, and filter community posts. The featured carousel and original REV character reels have pause controls. |
| **Games** (`/games`) | Browse the library and open a game's page for its details and reviews. |
| **Posts** (`/posts/:id`) | Read discussions, reviews, and comments. Members can publish posts, leave comments, and cast one like or dislike per post. Authors can edit or delete their own posts and comments. |
| **Sample dashboard** (`/dashboard`) | Switch between sample businesses and 7- or 30-day reports. Explore trends in Recharts, switch to tables, or use the browser's print dialog to save a PDF. |
| **About, Services, Contact, and Privacy** | See my projects and what I build, book a call or send a project inquiry through Google, and read how REV handles data. |
| **Admin dashboard** (`/admin/dashboard`) | Sign in as the owner to view the community dashboard and manage games. The newest-posts list comes from the API. Chart totals and summaries use sample data. |

The public dashboard also uses sample data and saved summaries. Community posts, comments, votes, accounts, and the game library use MongoDB.

## Stack and repository

| Folder | Tools and responsibilities |
| --- | --- |
| [client/](client/) | React, React Router, Vite, CSS, and Recharts |
| [server/](server/) | Node.js, Express, Mongoose, and MongoDB Atlas. Accounts use Argon2id password hashing, MongoDB-backed sessions, CSRF protection, and rate limits. The admin account uses an authenticator code. |
| [planning/](planning/) | Wireframes, user stories, and data design |
| [qa-reports/](qa-reports/) | Browser test results and screenshots |

## Run locally

Use Node.js 22.12 or newer, npm, and a MongoDB Atlas database. The Atlas database user needs the `readWrite` role scoped to the app database, and your development machine needs Atlas network access.

```bash
git clone https://github.com/JamarBrown3/rev-ruby-enigma-vault.git
cd rev-ruby-enigma-vault
```

Create `server/.env` locally and set these values privately.

| Variable | Local value |
| --- | --- |
| `MONGODB_URI` | Your Atlas connection string |
| `MONGODB_DB_NAME` | The app database name, for example `rev` |
| `PORT` | Defaults to `3002` |
| `CLIENT_ORIGIN` | Defaults to `http://localhost:5173` |
| `SESSION_SECRET` | Optional for local development. Use a private, randomly generated value to keep sessions valid across server restarts. Required in production. |
| `ADMIN_MFA_KEY` | Only needed for the admin sign-in. Generate it privately and never commit or share it. |

Run the API and frontend in separate terminals from the repository root.

```bash
# Terminal 1
cd server
npm ci
npm run dev
```

```bash
# Terminal 2
cd client
npm ci
npm run dev
```

Open [REV on localhost](http://localhost:5173/). Vite forwards `/api` requests to Express on port 3002. Check [database readiness](http://localhost:3002/api/health/database) if the frontend opens but data fails to load. Keep `server/.env` out of Git.

## Testing and accessibility

Run `npm test` inside `client/` for frontend tests and inside `server/` for backend tests. Run `npm run build` inside `client/` to check the production build.

REV includes light and dark themes, visible keyboard focus, reduced-motion support, and table views as alternatives to charts. Charts can be explored with the arrow keys. I tested with macOS VoiceOver and made follow-up fixes: dashboard tables, stat tiles, summaries, and chart tooltips now give screen readers amounts in words ("one thousand nine hundred fifty-six dollars") while showing the usual digits on screen. Browser QA reports record what was checked and what needs a retest.

- [Voting](qa-reports/2026/11-november/week-of-2026-11-09/REV-voting-QA-2026-11-10.md)
- [Comments and the home carousel](qa-reports/2026/11-november/week-of-2026-11-09/REV-comments-QA-2026-11-11.md)
- [Recharts, dashboard layout, and printing](qa-reports/2026/11-november/week-of-2026-11-09/REV-recharts-QA-2026-11-12.md)
- [Contact and Privacy](qa-reports/2026/11-november/week-of-2026-11-09/REV-contact-privacy-QA-2026-11-13.md)

On November 14, 2026, a manual test with two demo member accounts published one discussion each and commented on an existing review. A signed-out reload confirmed all four entries were saved with the correct authors.

## Deployment status

REV runs locally. Hosting is the next milestone: one Render web service where Express serves the built React app, MongoDB Atlas, and a custom domain. Secrets live only in Render's environment settings, never in the repository.

During deployment, verify that the public frontend can reach the API, session cookies work over HTTPS, and direct links such as `/games` and `/privacy` load when refreshed.
