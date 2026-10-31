# REV frontend (React + Vite)

Built 31 October 2026 from the Figma wireframe (`wireframes/`, `planning/wireframes.md`)
and the README's Steam-style dark look. Pages that have a backend route use the real
API; the two dashboards use saved sample data.

## Run it

1. Terminal 1, in `server/`: `npm run dev` (API on port 3002).
2. Terminal 2, in `client/`: `npm install` (needed again: new packages were added), then `npm run dev`.
3. Open **http://localhost:5173**. Use `localhost`, not `127.0.0.1`: the server only
   accepts requests from the address in `CLIENT_ORIGIN` (default `http://localhost:5173`).

If the server runs on a port other than 3002, change the `target` in `vite.config.js`.

Seeing `401 (Unauthorized)` in the browser console while signed out is normal: it's the
"is anyone signed in?" check (`GET /api/auth/me`) getting the answer "no".

## Pages and who can see them

| Address | Who | What it does |
|---|---|---|
| `/` | Everyone | Slider, then community posts with search, filter, sort, load more |
| `/games`, `/games/:id` | Everyone | Game library and one game with its reviews |
| `/posts/:id` | Everyone | One post; its author also gets Edit and Delete |
| `/posts/new`, `/posts/:id/edit` | Signed in | Write or edit your own post (review or discussion) |
| `/about`, `/services` | Everyone | About you (photos, bio, skills grid, projects) and what you build for clients |
| `/contact` | Everyone | Where "Let's Build Something" goes; shows the links filled in `src/data/site.js` |
| `/login` | Everyone | Log in or register (email + password, no code box) |
| `/dashboard` | Signed in | Sample business dashboard with the 3-sentence AI summary and print to PDF |
| `/profile` | Signed in | Shortcuts, theme setting and Log out (the phone tab bar's Profile button) |
| `/admin/login` | Bookmark it | Owner sign-in with the 6-digit code; sends you to the admin dashboard |
| `/admin/dashboard` | Admin only | Community dashboard (sample charts + live newest posts) and admin tools |
| `/admin/games/new`, `/admin/games/:id/edit` | Admin only | Add or edit a game, with a live card preview |
| `/dev/routes` | Only during `npm run dev` | The route tester (left out of `npm run build`) |

Non-admins who open an admin address see the normal 404 page. The server checks every
request again, so hiding pages is for tidiness, not security.

## Things you'll want to change

| What | Where |
|---|---|
| The 5 character images in the reels | Put files in `public/characters/`, then edit `src/data/characters.js` |
| Reel speed | `REEL_SECONDS` in `src/data/characters.js` |
| Home slider text, buttons, banner photos | `src/data/slides.js` |
| Email, LinkedIn, GitHub links, projects, skills grid | `src/data/site.js` (empty links are simply hidden) |
| About photos | `public/images/about/` (from your portfolio zip, resized to WebP) |
| About page layout and colors | `src/pages/About.jsx` and `src/pages/About.css` (phone-first) |
| Phone tab bar buttons | the `tabs` list in `src/components/MobileNav.jsx` |
| Admin menu links | `src/components/AdminSideMenu.jsx` |
| Colors and fonts | `src/styles/tokens.css` |

## How it's organized

```
src/
  main.jsx            starts React, router, fonts, styles, saved theme
  App.jsx             every route and its guard
  api.js              fetch helper: cookie + CSRF token handled for you
  services/           authApi, gamesApi, postsApi (same idea as GamesAPI.js in video_gameStore)
  auth/               AuthContext (who's signed in) and the route guards
  components/         Layout, Header, Footer, CharacterReels, VaultSlider, cards, DeleteButton,
                      MobileNav (phone tab bar), AdminSideMenu (slide-out admin menu)
  components/charts/  LineChart, BarChart, StatTile, ChartCard (with table view), RangePicker
  pages/              one file per page
  data/               editable content + the sample dashboard data and summaries
  styles/             tokens, base, layout, components, pages, dashboard (+ print)
  devtest/            the route tester
```

Reused from your projects:
- **Game cards**: the video_gameStore card (whole cover over a blurred copy of itself)
  mixed with the Xenoblade event card (label, title, description, footer under a divider).
- **Delete with confirmation**: `DeleteGameButton.jsx` from video_gameStore, made generic.
- **Filters built from the data**: the Xenoblade events filter and the CIS485 product filter.
- **Slider**: works like the Nivo slider from the CIS485 store (fade, caption, arrows,
  dots, auto-advance that pauses on hover), rebuilt in React with no jQuery and none of
  the Red Leaves template's files, plus swipe, arrow keys and a Pause button.

Licenses: fonts are Gloock and Schibsted Grotesk (SIL Open Font License, fine for
commercial use), installed with npm. The placeholder character art in
`public/characters/` was drawn for REV. Nothing comes from the CIS485 CSS template.

## Menus

- **Phone tab bar** (`MobileNav.jsx`, under 768px only): Home, Games, About, and Profile
  (Log in for visitors), fixed to the bottom, ruby pill on the current page. The header's
  Menu button still lists every page, and pages get extra bottom space so the bar never
  covers the footer.
- **Admin side menu** (`AdminSideMenu.jsx`): the hamburger at the left of the header on
  `/admin/...` pages slides it in from the left. Escape, the X or the dimmed backdrop
  closes it; Tab stays inside while it's open; the page behind doesn't scroll.

## Accessibility and motion

- The reels and the slider have Pause buttons, and start paused for anyone whose device
  is set to reduce motion. The reel choice is remembered (localStorage).
- Every chart has a "Show table" switch, keyboard support (arrow keys on the line chart),
  and the printed report includes the tables.
- An automated axe check found no violations on the main pages, in dark and light themes.

## Sample vs live

- **Live from the API**: posts, games, sign-in, register, log out, admin game editing,
  and the "Newest posts" table on the admin dashboard.
- **Sample** (`src/data/sampleBusiness.js`, `src/data/sampleCommunity.js`): both dashboards'
  numbers, charts and AI summaries. The summaries were written to match the sample numbers;
  if you change the generators, rewrite them.

## Waiting on backend routes

- Comments and like/dislike (the post page shows a placeholder).
- Admin stats (`GET /api/admin/stats`) to replace the admin dashboard's sample numbers.
- Admin delete of any member's post, and banning users.
- Live AI summaries through `/api/demo` with the AI budget service.

## Deploying later (Netlify + Render)

The session cookie is `sameSite: strict`, so the browser must see the site and the API
as one site. On Netlify, add a `public/_redirects` file that proxies `/api/*` to the
Render URL and sends every other path to `index.html` (so `/games` works on refresh).
Set `CLIENT_ORIGIN` on Render to the Netlify address.
