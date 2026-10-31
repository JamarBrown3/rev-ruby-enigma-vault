# REV route tester (dev only)

A page for clicking through every backend route, so you don't need Postman.
It now lives at **http://localhost:5173/dev/routes** while `npm run dev` is running.
`npm run build` leaves it out of the real site. Its styles are scoped under `.devtest`,
so they can't change the real pages.

## Full check (about 2 minutes)
1. **Admin checks** tab: *Run visitor checks* (signed out).
2. **Login** tab: type a throwaway member (e.g. tester1 / tester1@example.test /
   a 15+ character password), then *Register test member* and *Log in*.
3. **Admin checks**: *Run member checks*, then back to **Login** and *Log out*.
4. Log in as yourself with the current 6-digit code, then **Admin checks** >
   *Run admin checks*, then *Log out*.
5. Every line says PASS or FAIL. *Copy log* puts the log on the clipboard (no
   passwords or codes in it).

The tester keeps its own sign-in state, so after using it, reload the real site to
see the right header. The checks delete everything they create, except the
throwaway member account (there's no delete-account route yet).
