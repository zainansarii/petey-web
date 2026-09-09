# Web trainer matching

## Firestore ownership

The web and mobile apps share the Standard `(default)` database in
`europe-west2`. Development uses `petey-dev-getcass`.

| Path | Contents and access |
| --- | --- |
| `trainerProfiles/{trainerUid}` | Existing private trainer application, approval version and evidence. Never sent to the matching model or web client. |
| `publicTrainers/{trainerUid}` | Existing approved publication plus `webProfile` for the complete web display profile. Server access only. |
| `webTrainerApplications/{applicationId}` | Private Google Form source, immutable revisions, editable draft, external verification and review history. Reviewer functions only. |
| `webTrainerCatalog/{trainerId}` | Approved web snapshot with a stable ID independent of Firebase Auth, catalogue availability and verification expiry. Server access only. |
| `webOnboardingDraftsV3/{draftId}` | Temporary Markdown brief, capability hash, expiry, matching result and lease. Basic details are added on confirmation. Existing 24-hour draft lifetime applies. |
| `webClientProfiles/{uid}` | Durable Markdown brief, private `identity` (full name, date of birth, verified email), consent version, signup timestamp and ranked matching result. Accessed through authenticated callables for this UID only. |
| `_webOnboardingConsumptionsV3/{draftId}` | Existing seven-day idempotency receipt with UID, capability hash, brief and matches. |

The shared rules remain owned by `mobile-app/firestore.rules`; their default
deny protects web collections and `publicTrainers`. There is no direct browser
Firestore access or client-authored ranking. Do not deploy replacement web rules.

The eight complete demo profiles are imported by the guarded migration described
in [the catalog runbook](../functions/scripts/TRAINER-CATALOG.md). `trainers.ts`
now contains only public landing-card previews. Complete local demo data is used
only by development fixtures and tests. No demo fallback supplies real results.

## Onboarding and signup

1. The existing finalization function generates and stores the non-identifying
   Markdown brief. Matching receives that brief, never the basic signup details.
   Conversation completion requires answered training-setting and location questions,
   alongside trainer fit, trainer gender, trainer-session frequency, availability
   and budget. Location is a rough area for in-person training or a separate
   confirmation of online-only sessions. Setting suggestions are Home, Online,
   Commercial gym and Private studio. Frequency always means sessions with the
   trainer, not independent workouts. The brief preserves firm dealbreakers and
   flexible preferences separately.
2. During “Finding your personal trainer”, `matchWebOnboardingDraftV1` verifies
   App Check and the draft capability, then reads all eligible published trainers.
3. Gemini evaluates the brief against every candidate in batches of eight, with
   at most three calls in flight. The model returns one validated decision per
   candidate. Missing, duplicate or invented trainer IDs fail the entire run.
4. Compatibility requires a score of at least 70/100 and no unmet or unconfirmed
   required budget, venue, location, availability, explicit trainer-gender or
   other essential constraint. Coaching personality and talkativeness affect
   ranking rather than eligibility unless the person explicitly makes them essential.
   Scores rank compatible trainers; they are not probabilities.
   The prompt accounts for session frequency when assessing a monthly budget and
   does not invent gender, travel distances or package inclusions. If none are
   compatible, return up to three clearly labelled closest options, ranking by
   fewest unmet dealbreakers, then fewest unconfirmed dealbreakers, then fit score.
   Even these alternatives can have dealbreaker conflicts; those conflicts remain
   visible and never become a claim of compatibility.
5. The result is saved with the exact brief hash, catalog hash, model, algorithm
   version, evaluated count and completion time. Each ranked match stores trainer
   UID, approved version, score, explanation, dealbreaker statuses and softer
   preference differences. Algorithm version 2 invalidates old results so a
   previously empty shortlist can be evaluated again. A five-minute lease avoids
   duplicate concurrent model runs; errors release it for retry.
6. The callable returns the actual available count and no more than three card
   previews. Full biographies and practical details are returned after login.
   Preview responses also distinguish compatible matches from closest options.
   An empty eligible catalog still permits account creation without invented profiles.
7. Confirmation requires the unchanged, matched brief. After verified-email
   authentication, consumption atomically attaches the brief, basic details and
   all matches to `webClientProfiles/{uid}`, creates its retry receipt, then
   deletes the temporary draft. A repeated consume returns the same saved result.
   Older clients that have not requested previews are matched during confirmation
   so a page opened before the frontend update can still finish signup.
8. `getWebClientProfileV3` restores the authenticated user's complete shortlist.
   Existing users with an older Markdown-only record get matches on next login;
   their previously discarded identity fields cannot be reconstructed.

Every mobile-backed catalog read checks the active trainer account, approved
publication and version, suspension status and evidence expiry. Canonical approved name, photo,
pricing, session options and qualifications override editorial web metadata, so
reapproval cannot leave stale practical facts in the web profile. Changed catalog
facts invalidate cached matches. Blocked, withdrawn or no-longer-eligible trainers
are excluded from authenticated results.

When `WEB_TRAINER_CATALOG_ENABLED` is enabled, the same loader also includes
form-backed snapshots. These use explicit manual-verification eligibility,
matching approved version/photo, availability, confirmed future start dates and
verification expiry; no trainer Auth account or mobile evidence record is needed.
Pending form edits do not replace the approved snapshot. Each response rechecks
eligibility, and changes to the eligible catalogue invalidate saved matching.
An already rendered page reflects changes on its next fetch or refresh.
Contact details, original answers, response-edit links and private insurance
records are excluded from public profiles and matching prompts. Session duration,
package notes, service areas, experience and other approved practical details
are included without inventing structured prices, locations or hours.
See [trainer application operations](trainer-application-operations.md).

## Runtime and rollout

- `WEB_MATCHING_GEMINI_MODEL_V1` defaults to `gemini-3.7-flash`. The four matching,
  confirmation, consumption and profile callables use the existing web runtime
  service account; matching and profile operations allow 300 seconds.
- Existing `roles/datastore.user` and `roles/aiplatform.user` are required.
  Signed images additionally need `roles/storage.objectViewer` on the trainer
  bucket and `roles/iam.serviceAccountTokenCreator` on the runtime identity itself.
  Mobile-backed photos must be under the approved trainer's `onboarding/{uid}/profile/` path;
  signed URLs expire after two hours and are refreshed when profiles load.
  Form-backed photos must match the application's approved immutable
  `web-trainer-applications/{id}/revisions/` object. Reviewer URLs expire after
  five minutes; catalogue URLs use the existing signed-photo expiry.
- The synchronous implementation supports up to 500 published trainers. It fails
  explicitly above that bound instead of claiming a partial search is complete.
  Larger catalogs should use queued matching shards and a completion job.
- This task's migration and deployment target development. Production needs its
  own approved catalog publication, runtime configuration and rollout.
- The new callable follows the existing dev Cloud Run configuration: the service
  uses `--no-invoker-iam-check`, with App Check and capability/Auth verification
  enforced inside the callable. This project restricts IAM `allUsers` bindings;
  no organization policy or Firestore rules were changed.

Deploy only the changed web functions:

```sh
npx -y firebase-tools@latest deploy --project petey-dev-getcass --only functions:web-onboarding-v3:matchWebOnboardingDraftV1,functions:web-onboarding-v3:confirmWebOnboardingDraftV3,functions:web-onboarding-v3:consumeWebOnboardingDraftV3,functions:web-onboarding-v3:getWebClientProfileV3
```

The small mobile `reviewTrainerApplication` update preserves web editorial
metadata when it republishes canonical trainer data. Use the existing guarded
mobile deployment helper to deploy that function alone.

Validation: `npm run verify` covers the frontend, model parser, matching leases,
catalog invalidation, eligibility gates and migration. A live synthetic-user
smoke test should cover App Check, capability isolation, unchanged-brief
confirmation, verified email, durable identity/brief/matches, consumption replay,
returning login, signed photos and denied direct Firestore reads.

Development verification on 2026-09-05 evaluated all eight trainers, returned eight
matches and three previews for a synthetic remote-strength brief against the final
canonical catalog, and reused the
cached search. Signup persisted identity, Markdown and all matches, removed the
draft, survived consumption replay and restored the shortlist after fresh login.
Signed images returned HTTP 200 and direct anonymous profile reads returned 403.
Synthetic Auth users and documents were removed after the check. UI fixtures
covered zero, one and eight matches at desktop and mobile sizes.

Implementation follows [Firestore's server access model](https://firebase.google.com/docs/firestore/security/overview)
and [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output).
