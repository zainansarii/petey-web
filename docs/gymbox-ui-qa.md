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

## Published browser acceptance — 2 October 2026, 23:02 UTC

Verified the actual consumer at `https://joinpetey.com/gymbox-demo/` and dashboard at `https://joinpetey.com/gymbox-demo-admin/` following successful Pages run `37074602206`. Publication commit: `a33b9ddd7aed3deb17654b540f15da5f2ab10fe6`; pinned Gymbox source: `77ebfb6cdda2697b49f1e1f9df0a706476ba1b55`.

The consumer used normal production App Check and real hosted callables through the page. No fixture query, debug-token injection or mocked response was used. Inputs described a fictional beginner wanting strength and confidence for a wedding in six months, patient/friendly coaching, single-club Bank membership near work, and an unknown per-session budget. The assistant clarified the lifting goal and desired coaching support, then produced Emma, Grace and Daniel, all at Bank. All three cards and Emma’s expanded profile displayed “Rates on enquiry”. Emma’s fictional biography, qualifications, Bank address and demo identification rendered correctly; Escape closed the profile and refinement remained available.

Refinement explicitly requested “Only Bank” and exclusion of Farringdon and Holborn while preserving the goal, coaching preference and unknown budget. The second matching response succeeded with Emma, Daniel and Nathan, all Bank; no excluded-club trainer appeared and prices remained unknown. Exactly two successful matching rounds were exercised, with no additional matching requests after refinement.

Confirmed full reset through the confirmation dialog: returned to the landing screen, then reopened chat without sending anything. Only the opening assistant message remained, the previous wedding text was absent and focus was on Your message.

The published admin resolved all five displayed Bank portrait URLs successfully (`complete=true`, `naturalWidth=900`), confirming that the combined consumer/admin asset route works. Emma’s detail matched the sample source at 570 recommendations, 98 searches with intent and 17.2% conversion. Exercised all ten club filters at all three reporting periods through the live UI. The eight unpopulated clubs reported zero searches/intent/conversion throughout; populated-club figures were:

| Club | Period | Completed searches | Searches with intent | Conversion |
| --- | --- | --- | --- | --- |
| Bank | 7 days | 222 | 60 | 27.0% |
| Bank | 28 days | 880 | 259 | 29.4% |
| Bank | 90 days | 2,500 | 667 | 26.7% |
| Farringdon | 7 days | 229 | 83 | 36.2% |
| Farringdon | 28 days | 920 | 296 | 32.2% |
| Farringdon | 90 days | 2,691 | 799 | 29.7% |

Live consumer and admin both measured equal document scroll/client widths at 375px and 1440px. The 375px admin detail also had equal dialog scroll/client widths. Live price pills measured equal 109px client/scroll widths. Desktop and mobile screenshots were inspected; neither captured browser console returned warning or error entries. Temporary viewport overrides were restored.

Minor copy observation: the location fallback currently says “Bank is about 0.0 km from Bank.” for an explicit Bank anchor. The result is geographically consistent but the wording is awkward; it did not affect access filtering, refinement or acceptance. No source change was made during published verification.
