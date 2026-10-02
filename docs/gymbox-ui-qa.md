# Gymbox UI verification

Checked 2 October 2026 using Chrome, Node 22.13.1 and the development servers at ports 5180 (consumer) and 5181 (admin). Consumer interaction checks used the explicitly development-only `?gymboxFixture=1` fixture. Hosted AI acceptance is recorded separately in `gymbox-demo.md`.

## Automated checks

- Consumer/admin Vitest: 4 files, 39 tests passed. Includes nullable prices, profile focus restoration, deterministic budget choices, unknown/duplicate trainer rejection, turn/matching retry without answer duplication, empty results, reset with stale response rejection, valid refinement history and accessible assistant text.
- Admin event checks cover all 10 club filters over 7/28/90 days, eight clubs without synthetic coverage, unique completed-search denominators, repeated-search deduplication, and reconciliation of club/trainer/trend totals.
- Targeted ESLint, repository TypeScript build, consumer production build and admin production build passed. Consumer bundle retains the existing non-blocking Vite large-chunk warning.
- Independent backend-agent review found no blocking admin metric or filter discrepancy.

## Responsive and interaction checks

At each width below, the document's measured `scrollWidth` equalled `clientWidth` in the consumer landing, chat and match results, and the admin overview. The admin table remains intentionally horizontally scrollable at phone widths; useful columns remain available rather than being removed.

| CSS viewport width | Consumer document width | Admin document width |
| --- | --- | --- |
| 320 | 320 | 320 |
| 375 | 375 | 375 |
| 430 | 430 | 430 |
| 768 | 768 | 768 |
| 1024 | 1024 | 1024 |
| 1440 | 1440 | 1440 |

- Inspected screenshots at desktop and phone widths: real Gymbox logo, generated industrial hero, preserved landing composition, yellow primary controls, clean match cards and expanded Emma profile.
- “Rates on enquiry” pills measured 109px with equal client/scroll widths at all six widths; no truncation or horizontal overflow.
- At 320px, the profile panel had equal 320px client/scroll widths. Opening focused Close trainer profile; Escape closed it and restored focus to View Emma’s profile.
- Completed the local fixture journey, opened a profile, returned to refinement with prior answers intact, and confirmed reset returns to the landing screen.
- Admin Ealing filter showed 0 searches, 0 searches with intent, 0.0% conversion and no fictional trainers. Bank/Emma showed 570 recommendations, 98 searches with intent and 17.2% conversion, matching the event source. Escape restored focus to Explore Emma Carter.
- After the final mobile target adjustment, selectors, view toggles, row-explore buttons and pagination controls were measured at 44px high; icon controls also measured 44px wide. Document width remained 320px.
- Native Chrome zoom was increased to 200%: the 1440px viewport became 720 CSS pixels with `devicePixelRatio=2`. Consumer landing/chat and admin overview had equal 720px scroll/client widths; text, controls and chat input remained available. Keyboard Enter activated the consumer CTA; chat focus moved to Your message. Zoom and viewport overrides were restored afterward.
- No error or warning entries were returned from either tab's captured console log.

## Accessibility evidence and limits

Loaded the repository design review methodology plus accessibility, colour, layout, typography and charting-data guidelines before review. Verified main contrast pairs from the actual CSS using WCAG relative luminance:

| Foreground/background | Ratio |
| --- | --- |
| #111111 on #FFCD33 primary action | 12.62:1 |
| #FFCD33 on #111111 landing heading/focus | 12.62:1 |
| #EEEEEE on #111111 landing body | 16.28:1 |
| #626262 on #FFFFFF muted text | 6.10:1 |
| #171717 on #FFFFFF text/focus/chart line | 17.93:1 |
| #222222 on #FFCD33 admin metric text | 10.63:1 |

Reduced-motion handling was verified in source and test branches: Motion components use `useReducedMotion`, chat scrolling accepts the preference, and both CSS files suppress animations/transitions for the reduced-motion media query. The current browser reported reduced motion false; an OS-level reduced-motion toggle and a screen-reader session were not performed. This is not a claim of exhaustive assistive-technology certification.

Admin portraits intentionally use the same-origin consumer route `/gymbox-demo/trainers/…`. They are available in the combined publication. The isolated admin server on port 5181 does not serve the consumer assets, so portrait requests there are expected to fail; the film capture rebases those URLs to identical local assets and verifies the rendered portraits. Check the combined live deployment separately.

Screenshots were inspected inline during browser QA; the maintainable preview-film capture artifacts provide durable images of the final dashboard. No real enquiries were submitted, and no contact or medical information was entered.
