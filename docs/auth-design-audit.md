# Login design consistency audit

Reviewed 2026-09-24 against the owner's standard-login screenshot, the current React/Vite entry points and [Petey's design rules](design-consistency.md). This is a focused review of inconsistent account-entry layouts, not a redesign of the signed-in workspaces.

The trainer login had its own `AccessGate` markup and `mp-access` CSS inside the dashboard wrapper. It therefore inherited compact dashboard typography, labels and lime buttons instead of the standard login layout. It was a separate implementation, not an intended trainer-specific design.

| Page or state | Finding | Outcome |
| --- | --- | --- |
| `/trainer/` signed out | Small left-aligned heading/form, compact lime action and no matching back control | Now shares the standard login component and styles. |
| `/messages/` signed out | Same `AccessGate` implementation, with an additional trainee weight override | Same shared correction applied. |
| Trainer invitation sign-in (`/trainer/?invite=…`) | Same inconsistent login UI | Corrected while preserving the invitation, route and hash in the email return destination. |
| Trainer/inbox email confirmation and sent-email states | Same old access layout | Now use the shared login layout and typography. Confirmation still completes the existing link. |
| Trainer/inbox loading, invitation-required, revoked and access-error states | Same old access layout and dashboard controls | Now use the shared account-access layout with the appropriate recovery controls. |
| `/admin/` sign-in, session renewal and reviewer-access states | Separate `review-login` utility layout: narrower, left-aligned content and a small lime Google button; no standard back control | Now use `AuthScreen`, including the standard heading, back control and charcoal/lime action. Reviewer content stays mounted but hidden/inert while a session is renewed, preserving unsaved drafts. |

No other route uses the removed `mp-access` styling. The main login and all marketplace entry screens now use one component rather than parallel copies. Core check-email/recovery screens use the established large type and dark actions; they do not share the old trainer-login treatment. The trainer dashboard, profile editor, trainee inbox and reviewer editor deliberately retain their compact working layouts. Privacy, Terms and Support retain the Cass legal-page style specifically requested by the owner.

## Review principles

- [Layout — visual hierarchy and adaptability](../.design-rules/references/hig/layout.md): equivalent account-entry pages should preserve relationships between headings, descriptions, fields and actions across screen sizes.
- [Typography — conveying hierarchy](../.design-rules/references/hig/typography.md): apply the approved heading and label roles consistently; do not introduce a second scale for the same task.
- [Color — best practices](../.design-rules/references/hig/color.md): use the same charcoal/lime primary action for equivalent login actions.
- [Accessibility — vision and mobility](../.design-rules/references/hig/accessibility.md): maintain readable labels, visible keyboard focus, generous controls and reachable content.
- [Entering data — best practices](../.design-rules/references/hig/entering-data.md): keep the email label, email keyboard/autocomplete, inline validation and delivery feedback.

## Verification

- Browser comparison of the main, trainer, inbox and admin login at 1440, 768, 390 and 320px confirmed matching heading sizes/weights, logo widths and action colours, with no horizontal overflow. Email forms match input/button widths; admin uses the same action width for Google sign-in.
- Form controls remain 58px (input) and 54px (primary action) high. Keyboard focus on the action has a visible 3px outline. A short landscape viewport retains vertical scrolling.
- Browser console read returned no errors/warnings during these checks. No live emails were sent and no accounts were created for this change.
- Regression tests cover route/invitation preservation, cross-device email confirmation, invalid-link recovery, membership gating, revocation and delivery retry. Admin tests confirm unauthorised users cannot load reviewer content and hourly renewal preserves an unsaved draft. The expiry tests use reduced-motion rendering so the deliberately advanced clock does not stall entrance animation. These are mocked frontend regressions, not a replacement for the outstanding deployed acceptance tests.
- Full parallel runs encountered timing failures in existing animation/dashboard/onboarding tests. The final `VITEST_MAX_WORKERS=1 npm run verify` passed: 120 frontend tests, 192 backend tests, 20 script tests and 16 form tests, with the existing 3 frontend/20 backend skips. Lint, typecheck, both builds and `git diff --check` also passed, with no unhandled errors.
- The local reviewer-editor fixture retained its normal compact layout, with one visible main landmark, no auth screen and no horizontal overflow.

The owner approved deployment of the combined login alignment on 2026-09-24. The release workflow runs the full verification suite again; deployment and live checks are recorded separately in the workspace release audit after publication.
