# Ideas for routes, controllers and the dashboards — 26 October 2026

Suggestions only. Nothing here is built yet: `routes/` and `controllers/` are
still empty. The goal is that when you build them this week, the security pieces
from `security-hardening-2026-10-26.md` are already waiting for you.

## 1. Plug routes in with `mountRoutes`

Keep each router in `routes/` and its logic in `controllers/`. Then pass them to
`createApp` in `server.js`:

```js
// server.js (later)
import gameRoutes from "./routes/games.js";
import postRoutes from "./routes/posts.js";
import adminRoutes from "./routes/admin.js";
import demoRoutes from "./routes/demo.js";

createApp({
  auth,
  trustProxy,
  mountRoutes: (app, { auth }) => {
    app.use("/api/games", gameRoutes(auth));   // public reads
    app.use("/api/posts", postRoutes(auth));   // public reads, member writes
    app.use("/api/admin", adminRoutes(auth));  // already admin-only
    app.use("/api/demo", demoRoutes(auth));    // already signed-in only
  },
});
```

Each router file exports a function that receives `auth`, so it can use
`auth.csrf` and `auth.requireAuth`.

## 2. Route map

| Area | Route ideas | Who | Already protected by `app.js`? |
|---|---|---|---|
| Games | `GET /api/games`, `GET /api/games/:id` | Everyone | Global rate limit |
| Posts | `GET /api/posts`, `GET /api/posts/:id` | Everyone | Global rate limit |
| Posts | `POST /api/posts`, `PATCH`/`DELETE /api/posts/:id` | Author only | Add `auth.requireAuth` + `auth.csrf` + an ownership check |
| Comments / votes | `POST /api/posts/:id/comments`, `PUT /api/posts/:id/vote` | Members | Add `auth.requireAuth` + `auth.csrf` |
| My account | `GET /api/account/posts`, `PATCH /api/account/profile` | That member | Sign-in required ✅; add `auth.csrf` on PATCH |
| Visitor demo | `POST /api/demo/datasets`, `POST /api/demo/reports`, `GET /api/demo/reports/:id` | Signed-in visitors | Sign-in required ✅; add `auth.csrf` on POST |
| Admin dashboard | `GET /api/admin/stats`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/status` | Only you | Admin + two-step sign-in ✅; add `auth.csrf` on PATCH |

## 3. A safe controller, step by step

Here is "edit my post", the most common place apps leak or break other people's
data:

```js
// controllers/postController.js
import Post from "../models/Post.js";
import { HttpError } from "../security/input.js";
import { readObjectId, findOwned, notFound } from "../security/access.js";

export async function updatePost(req, res) {
  // 1. The ID from the URL must be a real ID (anything else -> 404).
  const id = readObjectId(req.params.id);

  // 2. Load the post ONLY if it belongs to the signed-in member.
  const post = await findOwned(Post, { id, ownerId: req.authUser._id, ownerField: "authorId" });
  if (!post) throw notFound();

  // 3. Copy ONLY the fields a member may change. Never pass req.body to the
  //    database: { ...req.body } would let someone send "authorId" or "role".
  const { title, body } = req.body ?? {};
  if (title !== undefined) {
    if (typeof title !== "string") throw new HttpError(400, "Title must be text.");
    post.title = title;
  }
  if (body !== undefined) {
    if (typeof body !== "string") throw new HttpError(400, "Body must be text.");
    post.body = body;
  }

  // 4. save() runs the schema rules (lengths, https-only image links...).
  await post.save();

  // 5. Send a chosen shape, not the raw document.
  res.json({ post: { id: post._id, title: post.title, body: post.body } });
}

// routes/posts.js
// router.patch("/:id", auth.requireAuth, auth.csrf, updatePost);
```

Rules to keep in every controller:

- **Who is acting** comes from `req.authUser` (the session), never from the body or
  query. Ignore any `userId`, `authorId` or `role` the browser sends.
- **Lists are always paged.** Cap `limit` at about 50 and check `page` is a whole
  number. Unlimited lists are a cheap way for bots to slow you down.
- **Search with care.** Never build a regex from raw user text. Escape it,
  limit it to about 50 characters, and use a `^prefix` match on an indexed field.
- **Operators in your own code** need `trusted()` (see REV-SEC-14), e.g.
  `{ createdAt: trusted({ $gte: since }) }`.
- **Deleting a post** also deletes its comments and votes, inside one transaction,
  as the ERD says.
- **Admin "list users"** sends id, username, role, status and createdAt. Include
  email only on the admin screen that needs it, using `.select("+email")`.

## 4. The visitor dashboard demo (backend side)

The flow that keeps it cheap and safe:

1. A signed-in visitor picks a **sample dataset** you provide, or uploads a small
   CSV.
2. The server calculates the numbers (totals, trends, averages, changes) itself,
   or asks your Python service.
3. The server sends **only those summary numbers** to the AI, never the raw rows
   (cheaper and more private), and gets back about 3 plain-English sentences plus
   "next steps".
4. The page shows the charts and text; the visitor downloads a PDF.

Guardrails for each step:

| Step | Guardrail |
|---|---|
| Upload | Its own size limit on that one route (e.g. 1 MB, at most 5,000 rows and 30 columns). The global JSON limit stays at 100 KB. |
| Storage | Save datasets and reports with `ownerId` plus an `expiresAt` TTL (e.g. 24 hours), so visitor data deletes itself. Use `findOwned` to read them back. |
| AI call | `aiUsageService.reserve(req.authUser._id)` **before** calling the provider and `release()` if the call fails. Set `max_tokens` (about 300). Keep the AI key only in server environment settings. |
| AI text | Treat the AI's answer as untrusted text: display it as plain text, never as HTML. A CSV cell could say "ignore your instructions", so tell the model the data is data. |
| Caching | Same dataset → same summary. Store it and reuse it instead of paying again. |
| PDF | Simplest and safest: let the browser make it (a print-styled page plus `window.print()`), with no server cost. If you use Puppeteer on the server, turn off JavaScript in the page, block all network requests except your own data, and escape every value. Otherwise a malicious value can make the server fetch internal addresses. Puppeteer also needs a lot of memory for Render's free tier. |
| Python service | Not reachable from the internet: a Render private service. Node calls it with a shared secret header and a short timeout. Never let the browser call it directly. |

## 5. The admin dashboard

- Routes go under `/api/admin/...`, which already requires your admin account,
  signed in with the 6-digit code.
- Compute metrics with `Model.aggregate([...])` from validated values. Aggregations
  already get a 15-second limit.
- Report exports (CSV/PDF) contain aggregates; avoid putting member emails in them.

## 6. A test for every route

Copy the patterns from `test/security-database.test.js`. Each new route should
have at least:

- a signed-out request (401)
- the wrong account (404 or 403)
- a missing CSRF token on writes (403)
- operator and array payloads (400)
- one happy path
