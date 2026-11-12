# REV comments, voting and slider QA
November 11, 2026 · Local development

Tested [Kiddish Japanese Ghouls?](http://localhost:5173/posts/6af376a8e310fdbe1ece46f8) and the [REV home page](http://localhost:5173/). The frontend was listening on port 5173 and the backend on 3002 before the browser tests. Comment and vote results came from the running app, including registrations and repeat sign-ins for both disposable member accounts. Browser checks used the in-app browser and the installed WAVE extension in Chrome.

| Test # | What I did | Expected | What happened | Pass/Fail |
|---|---|---|---|---|
| 1.1 | Opened the post signed out, then checked it again with three test comments present | Guests can read the list and follow a sign-in link to /login | All three comments were visible. The link was “Sign in” followed by “to join the conversation.” Its href was /login and I followed it to the login page. | Pass for behavior |
| 1.1 copy | Read the guest invitation | “Sign in to join the discussion” | “Sign in to join the conversation.” Only “Sign in” is linked. | Fail for exact wording |
| 1.2 | Inspected the populated guest comments region | No composer, Edit or Delete | Zero comment-region buttons and zero comment text boxes. | Pass |
| 2.1 | Clicked Post comment on an empty composer | Validation message and no post | “Write something before posting.” appeared and the count stayed at zero. | Pass |
| 2.2 | Pasted 2,001 characters and submitted | Red counter and submission refused | Counter read “2001 / 2000 characters” in rgb(255, 123, 123). Clicking Post comment showed “Comment can be up to 2000 characters long.” Count stayed zero. | Pass |
| 2.3 | Posted the space-padded QA comment | Trimmed text, cleared box, count +1, visible focus on new comment | “QA comment one” appeared, the composer cleared, the heading went from 0 to 1, and the focused comment had a 3px outline. | Pass |
| 2.4 | Pressed Enter between two lines and submitted | Line break retained | The saved comment body contained the newline and used CSS white-space pre-line. | Pass |
| 2.5 | Reloaded the review | Both comments persist with author and date | Both appeared as qa_tester_one with Nov 11, 2026. | Pass |
| 3.1 | Opened Edit on the first comment | Existing text prefilled and editor focused | The inline textarea showed “QA comment one” and received focus. | Pass |
| 3.2 | Pressed Escape in the editor | Close editor and return focus to Edit | The Edit button regained focus and its visible outline. | Pass |
| 3.3 | Reopened with Enter, changed the text, tabbed to Save changes, then pressed Space | Save edited text and focus the comment | “QA comment one updated” appeared, the comment received focus, and the status read “Comment updated.” | Pass |
| 3.4 | Opened Delete, chose Keep it, reopened Delete and confirmed | Cancellation preserves the comment. Confirmation removes it and focuses composer. | Keep it left the row present and returned focus to Delete. Confirmation removed the row and focused the comment textarea. | Pass |
| 4.1–4.2 | Signed out of account one, registered and used account two, then viewed account one’s comments | Account two sees no Edit or Delete on account one’s comments | Zero buttons on the other member’s comment. The second account had controls on its own comment. | Pass |
| 4.3 | Posted as account two and signed back in as account one | Account one sees no Edit or Delete on account two’s comment | The second member’s comment persisted and had zero buttons for account one. | Pass |
| 5.1 | Used Tab and Enter to submit, Enter to open Edit, Escape to cancel, Tab and Space to save, and Enter/Tab to confirm Delete | Comment actions are keyboard operable | All actions worked. Test text was inserted into the focused fields with the browser’s input tools and paste shortcut. | Pass |
| 5.2 | Clicked Add a comment and inspected its label association | Focus moves into the composer | The label pointed to the textarea ID and clicking it moved focus there. | Pass |
| 5.3 | Inspected the composer after empty submission | aria-invalid true and description references the counter and error | Both references resolved to the displayed counter and validation text. | Pass |
| 5.4 | Read the live status after posting, saving and deleting | “Comment posted.”, “Comment updated.” and “Comment deleted.” exposed through role=status | All three exact strings were present in the live region after their actions. | Pass for live region |
| 5.4 speech | Actual VoiceOver playback | Hear the live messages read aloud | Browser accessibility output and DOM were inspected. No VoiceOver speech was captured. | Not tested |
| 5.5 | Ran WAVE in Chrome signed in as qa_tester_two with three comments and two Likes | No errors or contrast errors in comments and voting | WAVE reported 0 errors, 0 contrast errors and 2 page alerts, “Possible heading” and “Redundant link.” | Pass |
| 6.1 | Tabbed to Like, pressed Enter, waited for the selected state, and pressed Space without refocusing | Focus stays on Like and Space removes the vote | Like stayed focused with its 3px outline throughout. Count moved 0 → 1 → 0 and selection cleared. | Pass |
| 6.2 | Read the review below the voting buttons | Outdated placeholder gone | The real Comments section was visible and the old phrase was absent. | Pass |
| 6.3 | Liked as account one, then as account two, then revisited as account one | One vote counted per member | Account two saw 1 Like with its own button unpressed, then 2 with it pressed. On return, account one saw 2 and its own button pressed. Removing each member’s vote brought the count to 1, then 0. | Pass |
| 7.1–7.3 | Selected and clicked each of the three slide links at 1440px, 900px, 760px and 390px | Separate controls row and divider. Every slide link is uncovered and navigates. | A 1px solid divider preceded the controls row in all 12 runs. All five sampled points per CTA hit the link. All 12 clicks reached the expected destination. | Pass |
| 7.4 | Used Tab through each active slide and controls at all four widths | Visible focus, no overlap | Tab reached the CTA, Previous, all three dots, Next and Play. Each had a visible 3px outline and an unobstructed center. The count is display text. | Pass |
| 8 | Measured the composer, vote buttons, comment action buttons and a long comment at 390px, 760px and 900px in both themes | Controls and text fit without overlap or horizontal scrolling | At every width, page scroll width matched the viewport. No measured control overlaps or horizontal overflows. The long comment included a 160-character unbroken segment and fit in each layout. | Pass |

## Reproduction steps

**Guest invitation wording differs from the requested copy.** Open the review while signed out and scroll to Comments. The invitation says “Sign in to join the conversation,” with “Sign in” as the link. The checklist specifies “Sign in to join the discussion.” The link opens /login as expected. [Guest screenshot](REV-comments-guest-populated.jpg)

## Slider measurements

Each row covers three slides. The clickable links led to /#archive, /games and /services.

| Width | Lowest CTA bottom to controls top | Clicks succeeded | Keyboard traversals succeeded |
|---|---:|---:|---:|
| 1440px | 88px | 3/3 | 3/3 |
| 900px | 13px | 3/3 | 3/3 |
| 760px | 55px | 3/3 | 3/3 |
| 390px | 117px | 3/3 | 3/3 |

## Cleanup

Deleted all four comments created during testing and removed both accounts’ votes. A fresh signed-out load showed Comments (0), 0 likes and 0 dislikes, matching the starting state. The two member accounts remain in place and the test sessions are signed out. The app theme and viewport returned to their starting state. No application code, settings or environment files were changed. [Cleanup screenshot](REV-comments-cleanup-reloaded.jpg)

## Screenshots

- [Over-limit comment](REV-comments-over-limit.jpg) and [focus on posted comment](REV-comments-posted-focus.jpg)
- [Two members’ comments and votes](REV-comments-two-members.jpg)
- [Signed-in WAVE summary](REV-comments-wave-results.jpg)
- [390px dark](REV-comments-comments-390-dark.jpg) and [390px light](REV-comments-comments-390-light.jpg)
- Slider at [1440px](REV-comments-slider-1440-slide-3.jpg), [900px](REV-comments-slider-900-slide-3.jpg), [760px](REV-comments-slider-760-slide-3.jpg) and [390px](REV-comments-slider-390-slide-3.jpg)
- 760px [slide one](REV-comments-slider-760-slide-1.jpg), [slide two](REV-comments-slider-760-slide-2.jpg) and [keyboard focus on slide three’s Play control](REV-comments-slider-keyboard-760.jpg)

## Limits

- **Not tested** — actual VoiceOver speech. The live region text and browser accessibility tree were checked.
- **Not tested** — direct API authorization or concurrent vote writes. The two-account checks covered the controls exposed in normal browser sessions and the persisted vote totals.
- **Not tested** — WAVE in light mode or on a physical mobile device. The signed-in scan covered the dark-theme post with populated comments. Layout checks used browser viewport widths.
