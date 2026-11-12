# REV like/dislike UI QA — November 10, 2026

Tested post: http://localhost:5173/posts/6af376a8e310fdbe1ece46f8 — “Kiddish Japanese Ghouls?”

Scope: browser UI tests only. No source files, credentials, .env files, or server settings were read or changed. User signed in privately as admin. Theme was temporarily toggled as requested and restored to dark; temporary 390 × 844 viewport was reset. Initial and final vote state: Like 0, Dislike 0, neither selected. Original posts were preserved. Sessions remain signed in; user may log out.

## Results

| Test # | What I did | Expected | What happened | Pass/Fail |
|---|---|---|---|---|
| 1.1 | Opened post signed out in Chrome | Counts and Sign in to vote link; no vote buttons | Displayed 1 like · 0 dislikes · Sign in to vote; the 1 was the concurrent test Like in the signed-in browser. No vote buttons appeared. | Pass |
| 1.2 | Clicked Sign in to vote | Navigate to /login | Opened http://localhost:5173/login | Pass |
| 2.1 | Opened post with admin session | Two Like/Dislike buttons with counts | Like 0 and Dislike 0 appeared | Pass |
| 2.2 | Clicked Like from neutral | Count +1; selected ruby border and bold text | Like became 1, aria-pressed true, green selected styling and checkmark. Computed font weight remained 600 in both states; border rgb(11,107,63), not ruby. | Fail — visual specification; behavior passed |
| 2.3 | Clicked Dislike after Like | Like −1, Dislike +1, only Dislike selected | Like 0 false, Dislike 1 true; “You disliked this post.” | Pass |
| 2.4 | Clicked selected Dislike again | Remove vote | Both 0 and false; “Vote removed.” | Pass |
| 2.5 | Liked and refreshed page | Selection and count persist | After loading, Like 1 remained pressed and Dislike 0 unpressed | Pass |
| 2.6 | Cleared vote, then rapidly double-clicked Like | Only one vote added | Like 1; Dislike 0; no count of 2 | Pass |
| 3.1 | Used Tab from main through Back to posts and game link to Like | Visible focus outline | Like received a 3px pink outline, offset 2px | Pass |
| 3.2 | Pressed Enter on focused Like | Toggle vote | Count toggled and selected state updated | Pass |
| 3.3 | Focused Like and pressed Space | Toggle vote | Space activated the focused button and added Like | Pass |
| 3.4 | Repeated Tab → Like → Enter; inspected focus, then pressed Space without refocusing | Focus remains usable on button so Enter then Space can toggle sequentially | During saving buttons became disabled; after completion document.activeElement was BODY. Subsequent Space did not remove Like. | Fail |
| 4.1 | Inspected both buttons before and after switching | Selected true, other false | aria-pressed toggled correctly; no state with both selected observed | Pass |
| 4.2 | Inspected emoji spans | aria-hidden=true | Both emoji spans had aria-hidden=true | Pass |
| 4.3 | Inspected vote container | role=group, aria-label=Rate this post | Both attributes present | Pass |
| 4.4 | Inspected hidden status after each action | Correct role=status text | “You liked this post.”, “You disliked this post.”, “Vote removed.”; visually-hidden paragraph, clipped to 1 × 1px | Pass |
| 4.5 | Ran Chrome WAVE signed out | No errors/contrast errors in voting area | Whole-page result: 0 errors, 0 contrast errors, 2 alerts (possible heading and redundant link). Guest voting area had no errors. | Pass — guest state only |
| 4.6 | Attempted WAVE after private Chrome admin login | Scan actual vote buttons | Chrome showed post URL/title while rendered content/accessibility tree remained on admin dashboard; reload/navigation/WAVE attempts did not resolve it, and a native control attempt reported no window available. No valid signed-in WAVE result obtained. This is an environment/automation blocker, not a confirmed REV routing bug. | Not tested |
| 5.1 | Set viewport to 390 × 844 in dark mode | Buttons fit; no horizontal overflow; easy tap targets | Page scrollWidth 390, viewport 390. Buttons approximately 145.9 × 47.2px and 145.5 × 47.2px; no overlap. | Pass |
| 5.2 | Switched to light theme at 390px | Same usable layout | Same button sizes and page width; readable, distinct controls; screenshot captured. Restored dark mode afterward. | Pass |

## Bugs and reproduction steps

### Keyboard focus drops after voting
1. Sign in and open the tested post.
2. Tab to Like; observe visible outline.
3. Press Enter and let the vote finish saving.
4. The active element becomes the page body rather than the Like button.
5. Press Space without manually refocusing: the vote stays selected.

Impact: Enter and Space each work on a focused button, but sequential keyboard use loses its place. Investigate disabled-state handling or focus restoration. No code changes were made.

### Selected styling differs from requested specification
1. Open post signed in with no vote.
2. Click Like.
3. Selected Like uses green styling and a checkmark, not a ruby border. Dislike uses red selection. Font weight is 600 before and after.

This is a mismatch against the supplied checklist, not automatically an accessibility failure. Keep it if the green/red design is intentional.

### Outdated placeholder contradicts live feature
1. Open the post.
2. Look below the working vote buttons.
3. The Comments and likes section still says: “Comments and the like/dislike buttons are on the way. They'll show up here once those routes are built.”

Comments functionality was outside scope, but the statement about like/dislike buttons is already incorrect.

## Screenshots

- [Selected Like](REV-vote-liked.jpg)
- [Keyboard focus](REV-vote-keyboard-focus.jpg)
- [Focus lost after activation](REV-vote-focus-lost.jpg)
- [390px dark](REV-vote-phone-dark.jpg)
- [390px light](REV-vote-phone-light.jpg)
- [Signed-out post](REV-vote-signed-out.png)
- [Signed-out WAVE](REV-vote-WAVE-guest.png)
- [Final neutral state](REV-vote-cleanup.jpg)

## Limits

Signed-in WAVE could not be completed. No actual VoiceOver speech test, physical touchscreen test, simultaneous multi-client stress test, or normal-member session test was performed. This was the requested UI sequence using an admin session. A browser double-click is not a database race-condition audit. WAVE's zero error count does not certify full accessibility. No passwords or MFA codes were requested or entered by the tester.

## Review and retest handoff

Read this report and the adjacent screenshots before making changes. Findings describe the November 10 test state. Verify the keyboard focus issue, confirm whether green/red selection is intentional, and remove outdated feature placeholder text if appropriate. The signed-in WAVE check remains open. Record fixes and new test evidence in a separately dated retest report; do not interpret this report as proof of a completed fix.
