# Trainee responsive pass

Local branch: `mobile-ui-refactor`. Reviewed on 10 September 2026.

## Layout system

- Phone layouts apply through 767px; tablet layouts apply from 768–1023px. Existing desktop composition starts at 1024px.
- `src/app/responsive.css` owns the public trainee layouts. Shared spacing, safe-area insets, radii and touch heights live in `src/shared/design/tokens.css`.
- Component-specific feed and inbox rules remain in their own stylesheets. Inbox changes are scoped to `.mp-app--trainee`; trainer workspace styles are preserved.
- Match previews use 4:5 portraits: an overlapping carousel on phones, two columns on tablets, the existing three-column desktop presentation. Phone previews support swiping, previous/next buttons and arrow keys; only the front card is focusable. Badges, names, specialties, areas, prices and selection remain available.
- Mobile quick replies use 13px text and wrap into additional rows as needed, retaining 44px tap targets. Homepage rear cards sit within the carousel boundary so their rounded corners remain visible.
- Form fields share a muted neutral focus color across trainee, trainer, messaging and reviewer entry points. The dark input outline and shaded halo are removed; keyboard focus remains visible.
- The landing description and both CTAs remain visible. Compact layouts scroll naturally; vertical swipes, wheel events and Page Down no longer start onboarding there. Desktop retains its existing interaction.
- In the stacked landing layout, the heading, description and CTA group share the horizontal centre with the profile cards. Checked at 320, 390, 768 and 926px; desktop keeps its existing alignment. The trainer CTA has no underline at any width.
- The account modal uses a compact 480px maximum width, 50px inputs and tighter spacing. Its top-right close button or Escape returns to the match list, retaining entered details and restoring focus.

## Browser coverage

Measured at 320, 375, 390, 430, 768, 1024 and 1440 CSS pixels. Phone heights included 568, 667, 844 and 932px; desktop used 900px. Additional chat checks used 390×360 and 844×390.

| Area | Checks |
| --- | --- |
| Landing | Description and both CTAs present; header, copy and carousel do not overlap; portrait imagery; natural scrolling; no compact-page horizontal overflow. |
| Conversational onboarding | Messages, progress, delete action, wrapping phone quick replies and composer remain available. Compact controls measure 44px. At 320, 390 and 430px the replies fit within the viewport; the composer stays visible at 390×360. |
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
- `git diff --check`.
- Browser QA used development fixtures and a temporary component preview, removed after inspection. No login email, enquiry or trainer message was sent.
- These are browser viewport checks, including a reduced-height check; a physical iOS/Android keyboard and device safe-area behavior were not tested on hardware.
- Existing environment-dependent skipped tests remain skipped. This pass does not certify backend delivery or production marketplace readiness.
