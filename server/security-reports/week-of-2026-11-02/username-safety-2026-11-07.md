# REV security update: username safety — 7 November 2026

**Adds to** `week-of-2026-10-26/security-hardening-2026-10-26.md` and
`auth-followup-2026-10-26.md` (REV-SEC-01 to REV-SEC-26). Those stay the record
for earlier work; this report covers **REV-SEC-27** plus the other security-related
changes made between 2 and 7 November.

**Scope:** `server/security/usernames.js` (new), `server/security/input.js`,
`server/models/User.js`, `server/controllers/adminUsers.js` (new),
`server/routes/admin.js` (new), `server/server.js`, `server/package.json`,
`server/test/usernames.test.js` (new), and the register form in
`client/src/pages/Login.jsx`. No `.env` file was read or changed.

## How to find every change

```sh
grep -rn "REV-SEC-27" --include=*.js . | grep -v node_modules
```

Every new test name starts with `REV-SEC-27`.

## Summary

| | Before | After |
|---|---|---|
| Offensive usernames (`sh1t`, `a55hole`, `fvck`) | Accepted | `409 That username is not available.` |
| Split-up words (`f_u_c_k`, `p.u.s.s.y`) | Accepted | Refused (separators removed before checking) |
| Hate terms (`nazi`, `hitler`) | Accepted | Refused |
| Staff names inside a longer name (`rev_support`, `official_jah`, `realadmin`) | Accepted (only exact matches like `admin` were blocked) | Refused |
| Phone numbers (`5551234567`) | Accepted | `400 Usernames can't include phone numbers.` |
| Website addresses (`mysite.com`, `jah.dev`) | Accepted | `400 Usernames can't be website addresses.` |
| Longest new username | 35 characters | 20 characters (existing accounts keep theirs) |
| Fixing a bad name that slips through | Edit the database by hand | Admin rename route, with a saved history |
| Innocent names that contain bad words (`assassin`, `therapist`, `Scunthorpe`, `trevor`, `Jahmal`) | Accepted | Still accepted |

## REV-SEC-27: username safety

### Why

Usernames appear next to every review, discussion and (soon) comment on a public
portfolio site. A slur, a fake "REV Support" account, or someone's phone number
next to a post would be seen by clients.

### What changed

**1. `security/usernames.js` (new).** One place for the "is this name acceptable?"
rules, on top of the existing format rule (letters, numbers, `_ - .`, no look-alike
Unicode, from REV-SEC-08):

- **Offensive:** the `obscenity` package (v0.4.6, English list and recommended
  settings) catches disguised spellings. The name is checked as typed **and**
  with `_ . -` removed, so splitting a word doesn't get through. `nazi`, `hitler`,
  `kkk` and `heil` are added because the library's list doesn't include them.
- **Reserved / impersonation:** the REV-SEC-08 list (`admin`, `mod`, `rev`,
  `support`, `official`, …) plus `RESERVED_USERNAMES` from `.env`. A name is
  refused if (a) the whole name is reserved, (b) any part between separators is
  reserved (`rev_support`), or (c) a reserved word of 5+ letters appears anywhere
  (`realadmin`). Short words (`rev`, `mod`, `jah`) only count as whole parts, so
  `trevor`, `model_maker` and `Jahmal` stay allowed. `isReservedUsername` moved
  here and is re-exported from `input.js`, so existing imports and tests still work.
- **Phone numbers:** 7 or more digits in a row, ignoring separators.
- **Website addresses:** a dot followed by a common web ending (`.com`, `.net`,
  `.org`, `.io`, `.dev`, `.shop`, …) or a name starting with `www.`. `kevin.r` and
  `j.brown` are still fine.

**2. `readUsername()` in `security/input.js`.** Registration and the new admin
rename both call this one function, so their rules can't drift apart. New names
must be 3 to 20 characters. Offensive and reserved names get the same vague
`409 That username is not available.` as a name that's already taken, so nobody
can test the filter word by word. Phone numbers and website addresses get a clear
`400`, because honest people might type those by accident.

**3. Admin force-rename.** `PATCH /api/admin/users/:id/username` with
`{ "username": "new_name", "reason": "optional, up to 200 characters" }`.
- Lives under `/api/admin`, which `app.js` already locks to the admin session that
  passed the 6-digit code (REV-SEC-25) and the CSRF check (REV-SEC-26). The router
  repeats `requireAdmin` in case it's ever mounted elsewhere.
- Uses the same `readUsername()` rules. Unknown fields are refused (`400`), bad IDs
  and missing accounts return `404`, a name already in use returns `409`.
- The change and the history entry are written in **one** database update, and only
  if the old name is still the current one, so two admins can't overwrite each other.
- Uses `returnDocument: "after"`; `new: true` is deprecated in Mongoose 9.

**4. `previousUsernames` on the User model.** Each rename saves
`{ username, changedAt, changedBy, reason }`. Like email (REV-SEC-07), it is
hidden from ordinary queries (`select: false`) and removed from `toJSON`, so it
never reaches a browser by accident.

**5. Register form (`client/src/pages/Login.jsx`).** The browser check now says
3 to 20 characters, and the hint explains the rules. The server is still the
only check that counts.

### Known limits

- No filter is perfect. Clever wordplay (for example `the_rapist`) can get through;
  the admin rename is the fix for those.
- `obscenity` flags `cockpit`. Rare in usernames; accepted.
- The rename route was tested with a stand-in User model, because the throwaway
  test database couldn't be downloaded in the test environment. Test it once by
  hand with the server running, or with `REV_SECURITY_ATLAS=1` once a rename test
  against Atlas is added.

### New package

`obscenity` (MIT license, pure JavaScript, no install scripts). Run `npm install`
inside `server/` once; the server won't start without it.

## Other security-related changes, 2 to 7 November

These were frontend changes, recorded here so the security history stays in one place.

| Date | Change | Why it matters |
|---|---|---|
| 3 Nov | `/dashboard` opened to visitors | It shows only made-up sample data from `client/src/data/sampleBusiness.js`; no API call, no user data. `/admin/dashboard` is still admin-only. |
| 5 Nov | Email address removed from the Contact page; contact goes through a booking form (Calendly) | No address for bots to scrape and spam. |
| 5 Nov | Contact links open with `rel="noreferrer"` | The opened site can't control the REV tab. |
| 5 Nov | Accessibility fixes A01–A07 from the 5 Nov QA report (error summary, menu focus, button contrast, page-change focus, fieldset legends, tooltip Escape, alt text) | Not a security change, listed for completeness. |

## Tests

Run inside `server/` on 7 November 2026, with `npm test` (no database):

- `test/usernames.test.js`: **62 of 62 pass**. Covers offensive names and disguises,
  staff and owner names, phone numbers, website addresses, normal names that must
  stay allowed, the 3–20 length, the vague 409 message, the rename (success, history
  entry, refused names, same name, taken name, bad ID, extra fields, long reason),
  a non-admin being refused, and `app.js` running the CSRF and admin checks before
  the router.
- Full suite: **753 pass, 7 skipped.** The 8 `CHECKLIST GIT` tests could not run in
  the test copy because it isn't a Git repository; they check your real repository
  and should pass on your computer. Run `npm test` after `npm install` to confirm.

## Still open

- Comments and like/dislike routes (next), which will display usernames.
- An admin screen in the frontend for the rename route (for now, use the route tester
  or Postman while signed in as admin).
- Optional: let members change their own username, with a cooldown. Not needed while
  only the admin can rename.
