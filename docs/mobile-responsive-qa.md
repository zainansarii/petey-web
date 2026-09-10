# Trainee responsive pass

Original pass: `mobile-ui-refactor`, subsequently merged. Mobile chat follow-up reviewed locally on `main`, 10 September 2026.

## Layout system

- Phone layouts apply through 767px; tablet layouts apply from 768–1023px. Existing desktop composition starts at 1024px.
- `src/app/responsive.css` owns the public trainee layouts. Shared spacing, safe-area insets, radii and touch heights live in `src/shared/design/tokens.css`.
- Component-specific feed and inbox rules remain in their own stylesheets. Inbox changes are scoped to `.mp-app--trainee`; trainer workspace styles are preserved.
- Match previews use 4:5 portraits: an overlapping carousel on phones, two columns on tablets, the existing three-column desktop presentation. Phone previews support swiping, previous/next buttons and arrow keys; only the front card is focusable. Badges, names, specialties, areas, prices and selection remain available.
- Quick replies occupy one row and show only complete buttons that fit, preserving their original order. The row recalculates when its width, reply labels or font metrics change; omitted buttons are hidden and inert. Mobile replies retain 13px text and 44px tap targets. Homepage rear cards sit within the carousel boundary so their rounded corners remain visible.
- The chat composer is a separate grid row outside the transcript scroller. Neither the composer nor its ancestors use movement transforms. The chat shell follows the visible viewport height and offset as the keyboard opens, closes or pans the page; pinch zoom retains its native behaviour.
- Quick replies do not open or refocus the mobile keyboard. Sending retains an already-focused input, disables repeated quick-reply submissions while waiting, and removes touch-only hover stickiness. On phones, suggestions tuck away while a draft is being typed and reappear when it is cleared or sent.
- The transcript follows new replies and keyboard/composer resizing, pauses when someone reads older messages, and resumes when they scroll back to the bottom. The input grows to four lines before scrolling internally.
- Form fields share a muted neutral focus color across trainee, trainer, messaging and reviewer entry points. The dark input outline and shaded halo are removed; keyboard focus remains visible.
- The landing description and both CTAs remain visible. Compact layouts scroll naturally; vertical swipes, wheel events and Page Down no longer start onboarding there. Desktop retains its existing interaction.
- In the stacked landing layout, the heading, description and CTA group share the horizontal centre with the profile cards. Checked at 320, 390, 768 and 926px; desktop keeps its existing alignment. The trainer CTA has no underline at any width.
- The account modal uses a compact 480px maximum width, 50px inputs and tighter spacing. Its top-right close button or Escape returns to the match list, retaining entered details and restoring focus.

## Browser coverage

Measured at 320, 375, 390, 430, 768, 1024 and 1440 CSS pixels. Phone heights included 568, 667, 844 and 932px; desktop used 900px. Additional chat checks used 390×360 and 844×390.

| Area | Checks |
| --- | --- |
| Landing | Description and both CTAs present; header, copy and carousel do not overlap; portrait imagery; natural scrolling; no compact-page horizontal overflow. |
| Conversational onboarding | Messages, progress, delete action, single-row quick replies and composer remain available. Compact controls measure 44px. At 320, 390 and 430px only complete replies are shown; the composer stays visible at 390×360. |
| Matching and previews | Loading presentation and results; heading below navigation; portrait card ratio; equal gutters; overlapping phone cards with visible rounded corners. Navigation and signup return checked at 320px; all three cards remain side by side at 1440px. |
| Signup | 320px dialog scrolls through all fields and actions; no horizontal overflow; return action retains form values; Escape and focus handling covered by the component test. |
| Login and email confirmation | Full-width form controls; long email wrapping; visible back/resend controls; success and recovery presentation. Focused email field checked at 390px and 1440px: neutral 1px border, no outline or halo; keyboard focus still advances to the submit button. |
| Matched feed and profile | Portrait photo, previous/next controls, profile details, weekly availability, qualifications, pricing and CTA; compact signed-in navigation retains the inbox link. |
| Introduction preview | 320px sheet, close action, textarea, character count and submission button fit; desktop retains its centered dialog. |
| Enquiry form | Synthetic preparation data in the existing component; all six summary fields, introduction, consent and safety copy remain available. One column on phones, two on tablets and desktop; the dialog scrolls without horizontal overflow. |
| Trainee inbox and conversation | Navigation, conversation row, timestamps, shared enquiry details, messages, composer, email preferences and safety controls fit. Used the existing local pilot QA data. |
| Empty and error states | Readable headings, explanatory copy and recovery actions fit without horizontal scrolling. |

The 1440×900 landing headline/copy/carousel measurements and match-preview heading/card measurements match the pre-change baseline. Desktop-only layout declarations are retained. The account dialog has a top-right close action.

## Verification and limits

- `npm run verify`: frontend lint, TypeScript, tests and build; Functions build/tests; Apps Script tests.
- Added a regression check for scrolling the compact landing page while retaining desktop scroll-to-onboarding, and extended signup coverage for cancellation and retained input.
- Covered one, two and three mobile previews, next/previous navigation, swipe wraparound, arrow keys, and preventing a swipe from accidentally opening signup.
- After the focus-style follow-up, rebuilt all web entry points and checked profile inputs/textareas in the local trainer workspace at 390px and 1440px: neutral 1px focus cue with no shadow.
- Chat follow-up: `npm run verify` passed (106 frontend tests, 190 Functions tests, plus Apps Script tests; existing skips unchanged). New regressions cover visual-viewport resize/pan/dismissal, pinch zoom, listener cleanup, no automatic mobile focus, repeated taps, retained input focus and manual scroll-follow behaviour.
- Single-row follow-up: `npm run verify` passed. Browser measurements at 320, 390, 430, 844 and 1440px confirmed a single row with no clipped visible buttons or page overflow. Opening replies showed one button at 390px, two at 430px and three at 1440px. Reply replacement and hiding/restoring the row while typing also passed in the local chat fixture.
- Used `?onboardingFixture=1&chatFixture=1` for a five-turn local conversation with streamed replies, including the coaching question from the reported screenshot. Checked 320×568, 390×360, 390×844, 430×400, 844×390, 768×1024 and 1440×900. The input stayed inside its composer, the composer stayed within the screen, and no horizontal overflow occurred. Sending retained focus; scrolling to the top stayed there during the next streamed reply. Matching, account-field scrolling at 390×360 and Escape dismissal also passed.
- `git diff --check`.
- Browser QA used development fixtures and a temporary component preview, removed after inspection. No login email, enquiry or trainer message was sent.
- These are browser viewport checks, including reduced heights and mocked visual-viewport events. The iOS simulator is installed, but its UI could not be controlled because desktop-control permissions were unavailable. The actual iPhone software-keyboard caret rendering and physical device safe-area behaviour still need on-device verification.
- Existing environment-dependent skipped tests remain skipped. This pass does not certify backend delivery or production marketplace readiness.

The viewport implementation follows the [VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport): software keyboards can reduce the visible area without resizing the layout viewport. This informed the layout fix; it does not establish which Safari rendering bug caused the reported caret offset.
