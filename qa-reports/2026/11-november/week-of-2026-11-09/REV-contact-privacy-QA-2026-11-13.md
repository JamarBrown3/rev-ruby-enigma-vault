# REV Contact and Privacy QA

November 13, 2026 · Local development

Contact’s live booking and inquiry pages opened correctly in Brave. All five project destinations loaded signed out of GitHub. The Privacy page loaded from the footer and by direct navigation. All four WAVE scans reported zero errors and zero contrast errors. The two findings were LinkedIn’s signed-out sign-up redirect and the missing new-tab announcement on the five About project links.

| Test # | What I did | Expected | What happened | Pass/Fail |
|---|---|---|---|---|
| 1.1 | Opened Contact and inspected Start a conversation | Filled Book a call and outlined Describe your project sit side by side on desktop | Both labels and treatments matched. The filled button is ruby. | Pass |
| 1.2 | Clicked Book a call in Brave | New Google Calendar tab for a free 30-minute project call. REV stays on Contact. | “REV Project call – 30 min” loaded and described a free 30-minute call. The original Contact tab remained open. | Pass |
| 1.3 | Clicked Describe your project | A new tab opens the website inquiry form | Google Forms displayed “REV Website & Project Inquiry.” The original Contact tab remained open. No required sign-in screen blocked viewing the form. | Pass |
| 1.4a | Clicked LinkedIn under Other places to find me | New tab opens the specified LinkedIn profile | The link’s destination was linkedin.com/in/jamar-brown-8a7099324 and it opened a new tab. LinkedIn showed its Sign Up page to the signed-out visitor. | Pass for link, profile view blocked |
| 1.4b | Clicked GitHub under Other places to find me | New tab opens github.com/JamarBrown3 | Brave loaded “JamarBrown3 · GitHub” in the new tab. | Pass |
| 1.5 | Searched visible Contact, Brave View Source, and live DevTools Elements for both strings | No spreadsheet URL or Prototype feedback form | Both searches returned no results on the page and in View Source, and 0 of 0 in Elements. The JSX app builds its link markup at runtime, so Elements provided the check of rendered links. | Pass |
| 1.6 | Queried DevTools Elements for anchors with target="_blank" and rel containing noreferrer. Cross-checked the live link attributes. | Every new-tab link has both attributes | Contact had four matching links, About had five, and Privacy had one. Those counts cover all new-tab links on the tested pages. | Pass |
| 1.7 | Proofread the Contact intro and card text | “30-minute” spelled correctly and no typos | “Book a 30-minute call” appeared with the hyphen. No typo found in the card. | Pass |
| 2.1 | Read Things I've built on About | Five Code links and zero Live site links | The five project cards each had a Code link. No Live site link appeared. | Pass |
| 2.2a | Opened the REV Code link in Brave | JamarBrown3/rev-ruby-enigma-vault in a new tab | Repository loaded with the GitHub Sign in link present. The About tab stayed open. | Pass |
| 2.2b | Opened the JB Computer Parts Code link | JamarBrown3/JB-Computer-Parts in a new tab | Repository loaded signed out. | Pass |
| 2.2c | Opened the Video game store Code link | CodePath_Web103_Projects/tree/main/video_gameStore in a new tab | Folder loaded with the Files heading and a GitHub Sign in link. | Pass |
| 2.2d | Opened the Xenoblade locations Code link | CodePath_Web103_Projects/tree/main/xenoblade1_Locations in a new tab | GitHub’s page title showed xenoblade1_Locations at main. | Pass |
| 2.2e | Opened the On the Fly Code link | CodePath_Web103_Projects/tree/main/onthefly in a new tab | Folder loaded with the Files heading and a GitHub Sign in link. | Pass |
| 3.1 | Followed the About footer Privacy link in Brave and checked the shared footer across eight public routes | Link goes to /privacy and title is Privacy &#124; REV | Privacy link was present on Home, Games, About, Services, Contact, Dashboard, Log in, and Privacy. Following it reached the Privacy page with the expected title. | Pass on sampled public routes |
| 3.2 | Read the Privacy heading hierarchy | One h1, four named h2s, and four named h3s under What REV stores | All headings and levels matched the checklist. | Pass |
| 3.3 | Proofread Privacy, including the text around inline links | Correct spacing and no typos | “on the Contact page are run by Google” and “follows Google's privacy policy” had the intended spaces. No typo found. | Pass |
| 3.4 | Opened Google’s privacy policy and both Contact page links | External policy opens in a new tab. Both Contact links use the same tab. | Google’s policy loaded at policies.google.com/privacy with a client_theme query parameter. The original Privacy tab stayed open. Both Contact links led to /contact in the same tab. | Pass |
| 3.5 | Entered /privacy directly in the Brave address bar | Privacy loads on a direct visit | The title was Privacy &#124; REV and the Privacy h1 appeared. | Pass |
| 4.1a | Ran WAVE on Contact in dark mode | 0 errors and 0 contrast errors | 0 errors, 0 contrast errors. Alerts were 1 Possible heading and 1 Redundant link. | Pass |
| 4.1b | Ran WAVE on Contact in light mode | 0 errors and 0 contrast errors | 0 errors, 0 contrast errors. Alerts were 1 Possible heading and 1 Redundant link. | Pass |
| 4.1c | Ran WAVE on Privacy in dark mode | 0 errors and 0 contrast errors | 0 errors, 0 contrast errors. Alerts were 1 Possible heading and 1 Redundant link. | Pass |
| 4.1d | Ran WAVE on Privacy in light mode | 0 errors and 0 contrast errors | 0 errors, 0 contrast errors. Alerts were 1 Possible heading and 1 Redundant link. | Pass |
| 4.2 | Tabbed through Contact and Privacy in Brave, inspected focus styling, and pressed Enter on Privacy’s first Contact link | Reading order, visible outlines, no skips or traps, and keyboard activation | Focus moved through the content links and footer in reading order, returned through browser chrome to the header, and did not trap. Supplemental desktop checks also covered the header buttons and both reel controls. Sampled controls showed 3px solid focus outlines. Enter opened Contact. | Pass for desktop traversal |
| 4.3a | Inspected Book a call in Brave’s DevTools Accessibility pane and read all Contact and Privacy names in Brave’s accessibility tree | New-tab names include the parenthetical with a space | All four Contact names and the Google policy name included the phrase. The pane showed “Book a call (opens in a new tab)” as the computed name. | Pass |
| 4.3b | Read the About Code link names | All new-tab links announce the new tab | Each of the five links was named “Code” without the announcement. | Fail |
| 4.4 | Inspected Privacy sections and their heading references in DevTools | Four named region landmarks | Four labelled sections matched. DevTools showed role region and name What REV stores for the first section. The accessibility tree exposed all four region names. | Pass |
| 4.5 | Calculated contrast from sampled computed foreground and background colors in each theme | Minimum 4.5:1 for body, muted text, and links | Lowest sampled ratio was 5.26:1 on Book a call in both themes. Privacy body was 15.26:1 dark and 15.39:1 light, intro and Last updated were 9.73:1 dark and 7.91:1 light, and Privacy links were 7.21:1 dark and 6.24:1 light. | Pass for sampled default colors |
| 4.6 | Set Brave page zoom to 200% on both pages | Readable text without clipping or horizontal scrolling | The browser confirmed 200%. The sampled Contact view and top and end of Privacy reflowed with no visible cut-off text or horizontal scrollbar. Zoom returned to 100%. | Pass for sampled views |
| 5.1 | Checked 1440, 900, 760, 390, and 320px on both pages in both themes using Brave responsive previews and supplemental DOM measurements | No sideways overflow or clipping | Document scroll width equaled viewport width in all 20 measurements. No sampled main heading, paragraph, list item, or link extended outside the viewport. | Pass |
| 5.2 | Compared Contact action coordinates and heights | Side by side at 900 and 760. Stack at 390 and 320 with each at least 44px tall. | Equal vertical positions at 900 and 760. The two buttons shared a left edge and stacked at 390 and 320. Each measured 44px tall in all eight checks. | Pass |
| 5.3 | Inspected Privacy at 760 and 900 in both themes | Aligned bullets and readable line widths | All five lists shared a 24px indentation and the same left edge within each viewport. Paragraphs and list copy wrapped in the content column. | Pass |

## Bugs and reproduction steps

### About’s Code links lack a new-tab announcement

1. Open About and scroll to Things I've built.
2. Inspect any of the five Code links in the browser accessibility tree.
3. Its name is “Code,” although it opens GitHub in a new tab.
4. Compare it with Book a call on Contact, whose computed name includes “(opens in a new tab).”

### LinkedIn sends signed-out visitors to sign-up

1. Open Contact in Brave while signed out of LinkedIn.
2. Select LinkedIn under Other places to find me.
3. The new tab’s link points to the intended profile, and LinkedIn presents “Sign Up | LinkedIn.”
4. The signed-out profile content could not be verified. This was observed on LinkedIn after the outbound click.

## Evidence

- [Contact desktop](REV-contact-desktop.jpg) · [Google booking page](REV-contact-booking.jpg) · [Website inquiry form](REV-contact-inquiry.jpg)
- [Contact at 900px in light mode](REV-contact-width-900-light.jpg) · [Contact at 320px in dark mode](REV-contact-width-320-dark.jpg)
- [Contact computed accessible name](REV-contact-computed-name.jpg) · [Contact keyboard focus](REV-contact-focus.jpg)
- WAVE results, Contact [dark](REV-contact-wave-dark.jpg) and [light](REV-contact-wave-light.jpg), Privacy [dark](REV-privacy-wave-dark.jpg) and [light](REV-privacy-wave-light.jpg)
- [Privacy landmark in DevTools](REV-privacy-landmark.jpg) · [Privacy at 900px](REV-privacy-width-900-dark.jpg) · [Privacy at 760px](REV-privacy-width-760-light.jpg)
- [Contact at 200% zoom](REV-contact-zoom-200.jpg) · [Privacy at 200% zoom](REV-privacy-zoom-200.jpg) · [End of Privacy at 200% zoom](REV-privacy-zoom-200-end.jpg)

## Limits

- **Not tested** — real VoiceOver speech. Names and landmarks were checked in the browser’s accessibility output.
- **Not tested** — inquiry form submission, appointment booking, or any account sign-in. Both Google pages were opened only. LinkedIn’s public profile content was blocked by its sign-up screen.
- **Not tested** — physical phones. Responsive widths used Brave DevTools with supplemental in-app browser measurements for precise bounds, contrast, and tab-focus styling.
- **Not tested** — every route, account state, link interaction color, or combination of zoom and viewport width. Footer coverage sampled eight public routes. The 200% zoom screenshots show the dark theme at Brave’s desktop window size.
- **Not tested** — backend privacy behavior or account deletion. The Privacy checks covered the page content, headings, landmarks, links, and layout.
