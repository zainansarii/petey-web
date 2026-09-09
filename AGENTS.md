# Petey web guidance

## App-wide design consistency

Read [the design consistency guide](./docs/design-consistency.md) before creating or changing any web UI.

- The existing home page, signup chat and matching experience define Petey's visual language. Extend those patterns across every page, including trainer, messaging, reviewer, authentication, invitation, loading, empty and error screens.
- Never add eyebrow text: no small introductory label above a heading, whether uppercase or sentence case. Start with the heading and put necessary explanation underneath it.
- Keep the basics consistent: Oxygen, the actual Petey wordmark and familiar logo placement, the Petey palette, and recognisable profile-card patterns.
- Preserve the approved trainer dashboard, inbox and profile styling, including their smaller font sizes, lighter heading weights, controls and compact spacing. Do not apply landing-page typography or restyle the whole workspace in the name of consistency.
- Use `src/shared/design/tokens.css`, `src/shared/design/typography.css`, existing shared UI and the closest approved screen as references. Font family is shared; sizes and weights can differ appropriately by context.
- Reuse existing public trainer cards for equivalent public-profile presentations. A compact dashboard profile summary can retain its own layout; do not replace it with a large discovery card.
- Keep consistency fixes narrow. Change the specific mismatch without redesigning adjacent UI or removing approved layout differences.
- Keep external design references subordinate to Petey's established scheme and the user's latest instructions.

## Design review rules

When reviewing UI/UX designs, follow the process defined in:

- [`.design-rules/SKILL.md`](./.design-rules/SKILL.md) — main review methodology.
- [`.design-rules/references/hig-lookup.md`](./.design-rules/references/hig-lookup.md) — topic-to-file mapping.
- [`.design-rules/references/hig/`](./.design-rules/references/hig/) — detailed guidelines.

Load the relevant guideline files before providing design feedback. Apply their usability and accessibility principles within Petey's existing visual language.
