# Petey web design consistency

**Keep Petey's brand basics consistent across the app. Preserve the approved design and density of each experience. Never use eyebrow text.**

The home page, signup chat and matching experience establish the brand. The original trainer dashboard, inbox and profile editor are also approved references: their smaller text, lighter headings, controls, cards and compact layouts are intentional. Consistency must not turn into a broad redesign or force landing-page sizes onto working screens.

This rule covers all web entry points, including trainer access, messaging, reviewer tools, dialogs, loading, empty and error states.

## Simplicity first

This is an MVP. Keep only the text and controls needed to understand the current screen and take the next action. Remove repeated explanations, decorative labels and incidental metadata. Put occasional settings behind a clear disclosure.

The trainee inbox uses full-width, softly tinted conversation rows: initials, trainer name, the latest message (or training goal before messaging), a timestamp and an arrow. Status colour supports the accessible label and indicator shape. Keep the layout within the trainer workspace's compact type scale. See [TraineeInbox.tsx](../src/features/marketplace/TraineeInbox.tsx).

## Shared basics

- **Font:** use Oxygen and the existing fallback stack. Keep each approved screen's sizes, weights, line heights and responsive behaviour. Do not enlarge text or make all headings bold simply to match another page.
- **Logo:** use the actual Petey wordmark through `BrandMark`, with its proportions intact. Keep it in the familiar top-left header position and use the established desktop/mobile sizing. Do not recreate the logo as styled text or place it inside an unrelated content column.
- **Colour:** use the [shared colour palette](./colour-palette.md) across every page: cream, charcoal, white, neon lime, violet and warm coral. Use the exact accent tokens for charts, progress bars, controls and highlights, with shared soft tints for backgrounds and neutral text. Never substitute darker accent variants or introduce muted olive/khaki shades. Preserve the approved layouts and density while correcting colours.
- **Profile cards:** reuse existing public trainer-card patterns when showing the same profile information. Maintain recognisable photo treatment and information hierarchy. Compact dashboard profile summaries and profile editors can retain their different layouts; do not replace them with large discovery cards.
- **Controls and spacing:** reuse the closest approved context. Preserve the trainer workspace's original buttons, inputs, radii and compact spacing. Equivalent controls within the same experience should look and behave consistently.

## No eyebrow text

Never place a decorative introductory label above a page, section, card or dialog heading. Examples include “PETEY FOR TRAINERS”, “YOUR COACHING BUSINESS” and “PROFILE PREVIEW”, whether uppercase or sentence case. Start with the heading and put necessary explanation underneath it.

Normal navigation, field labels, timestamps, status indicators and useful step indicators still have a purpose. Do not use them as decorative pre-headings. Changing an eyebrow's casing or class name does not make it acceptable.

## References

| Area | Reference |
| --- | --- |
| Home page | [LandingScreen.tsx](../src/features/discovery/components/LandingScreen.tsx) |
| Signup chat and matching handoff | [OnboardingFlow.tsx](../src/features/onboarding/components/OnboardingFlow.tsx) |
| Matched trainer feed and profiles | [FeedScreen.tsx](../src/features/feed/components/FeedScreen.tsx) |
| Approved trainer layout and density | [TrainerDashboard.tsx](../src/trainer-preview/TrainerDashboard.tsx), [trainer-dashboard.css](../src/trainer-preview/trainer-dashboard.css) |
| Live inbox and profile editor | [MarketplaceApp.tsx](../src/features/marketplace/MarketplaceApp.tsx), [marketplace.css](../src/features/marketplace/marketplace.css) |
| Shared brand tokens | [tokens.css](../src/shared/design/tokens.css) |
| Core experience's text roles | [typography.css](../src/shared/design/typography.css) |
| Core layouts and controls | [app.css](../src/app/app.css) |
| Actual wordmark | [BrandMark.tsx](../src/shared/ui/BrandMark.tsx) |

The latest user direction takes precedence over older wireframes and general design guidance. External references can inform a task's layout without introducing a different brand.

## Applying the rule

Identify the specific inconsistency and correct it locally. For example, the trainer invitation screen needed its eyebrow removed and logo brought into the familiar header position. That does not justify resizing dashboard headings, changing inbox rows, restyling forms or replacing profile cards.

Before completing a UI change, check:

- No eyebrow text, including in dialogs and empty states.
- Oxygen and the actual wordmark are used; logo placement is familiar.
- The affected component fits the closest approved pattern.
- Existing font sizes, spacing and styling are preserved unless the user asked to change them.
- Desktop and mobile layout remain usable, with no unintended horizontal overflow. Check 1440px and 390px widths, plus narrower widths when relevant.
- Keyboard focus, contrast, dialog behaviour and readable content remain intact.

Follow the repository's [design review process](../.design-rules/SKILL.md) and load the relevant [guidelines](../.design-rules/references/hig-lookup.md) before design feedback. Apply those principles within the approved Petey designs and the scope the user requested.
