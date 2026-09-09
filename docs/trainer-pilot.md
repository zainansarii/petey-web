# Trainer marketplace pilot

The live web pilot gives approved, invited trainers an enquiry dashboard, private lead tracking, editable public profiles and conversations with trainees. Every unlock records `amountPence: 0` and `priceVersion: free-pilot-v1`. There is no checkout or payment integration.

## Entry points

- `/petey-web/trainer/#overview`: all-date action queues, reporting trends and follow-ups.
- `/petey-web/trainer/#enquiries`: searchable enquiries, status filters and conversations.
- `/petey-web/trainer/#profile`: saved drafts, public publication and credential submissions.
- `/petey-web/trainer/#spending`: free unlock ledger and CSV export.
- `/petey-web/messages/`: trainee inbox, also linked from the matched-trainer feed.
- `/petey-web/admin/`: existing reviewer workspace with invitation and credential controls.
- `/petey-web/trainer-preview/`: the original, separate sample wireframe. Its example pricing and simulated actions do not apply to this pilot.

Firebase email-link sign-in retains the intended page/conversation and supports confirming the invited email on another device. A verified email alone never grants trainer ownership. The reviewer issues a random, seven-day invitation for an approved web application; redemption establishes an explicit UID-to-catalogue-ID membership. Resending replaces the valid token. Revocation disables backend operations and the participant's realtime reads.

## Enquiries and conversations

A trainee can contact a trainer only when the saved match is current, the catalogue entry remains eligible and the trainer has accepted their invitation. The confirmation form presents an editable practical summary and introduction, with explicit sharing confirmation. Summary generation receives the internal matching brief, never the raw onboarding transcript or separate health record, and is instructed to omit medical details and precise addresses. The trainee reviews the generated text before sharing.

The pair of trainee UID and stable catalogue ID determines one enquiry ID. Repeated submission returns that enquiry. Preview records contain abbreviated trainee identity, the confirmed summary and counters. Full identity and introduction live in a separate server-only record. Unlock access is permanent for this pilot and independent of the trainer's outcome label; closing and reopening does not charge again.

Messages use participant-restricted listeners with server-controlled, idempotent sends, sequence pagination and read acknowledgement. Drafts remain in local browser storage on the same device. A blocked conversation remains readable to its participants but cannot receive further messages or a new unlock. Withdrawal is available before unlock. Reports are private staff records. Trainer notes and outcomes never enter trainee-readable documents.

“Needs a reply” means unlocked and awaiting the trainer's first message. Contacted, Consultation, Started training and Closed are manual outcomes. Closed and Started training leave the reminder queue; closing is reversible. New enquiries, first-reply work and follow-ups span all dates. The 7/28-day selector affects trends, goal breakdowns and received-date cohort outcomes. Conversion is trainer-reported Started training divided by unlocked enquiries from the same received-date cohort; no denominator displays “—”. Daily reporting boundaries are UTC. Unlock activity and the spending ledger use unlock dates.

## Public profiles and credentials

Public drafts and publication use separate version checks. A stale edit produces a comparison/rebase screen and preserves local text. Publication updates the approved catalogue projection immediately and increments its profile version, invalidating matching caches. Settings and weekly availability have structured controls; original free-form notes remain editable alongside them. Pausing new clients immediately removes matching/enquiry eligibility while preserving conversations.

Photo replacement validates image bytes and limits size/pixels, strips metadata through processing and writes an immutable WebP. Qualification/insurance replacements stay pending in a separate review collection. The existing approved verification remains authoritative during review; expiry still blocks new matching. Credential review and later form imports preserve trainer-authored public content. Explicit reviewer suspensions are not lifted by ordinary credential approval.

## Backend boundary

`src/features/marketplace/model.ts` defines the shared strict Zod request contracts. `webMarketplaceV1` dispatches authenticated, verified-email, App Check-protected operations. Each write transaction rechecks authority. Disabled/revoked Auth sessions, user access state and trainer membership are enforced by the server.

| Records | Purpose / client access |
| --- | --- |
| `webMarketplaceUsers/{uid}` and `inbox` | Owner access/preferences record and safe owner-only realtime previews |
| `webTrainerMemberships`, `webTrainerInvitations`, `webTrainerPilot` | Server-only ownership and invitation lifecycle |
| `webEnquiries`, `webEnquiryContent` | Server-only enquiry state and separately locked introduction/full name |
| `webEnquiries/{id}/messages` | Unlocked participants can read; Functions perform all writes |
| `webLeadTracking/{uid}/leads` | Active trainer owner can read private tracking |
| `webTrainerUnlocks` | Server-only zero-cost ledger |
| `webTrainerWorkspaces`, `webTrainerVerifiedCredentials`, `webTrainerCredentialChanges` | Draft/public version state and separately reviewed evidence |
| `webNotificationQueue` | Persistent delivery leases, retries, suppression and provider receipts |
| `webMarketplaceReports`, `webMarketplaceRateLimits` | Private reports and bounded per-user operation rates |
| `webMarketplaceDeletionJobs`, `webDeletedTrainerApplications` | Retryable cleanup and minimal tombstones preventing form reimport resurrection |

All other web records deny direct client access. Existing mobile account/chat shapes and write rules are preserved. Shared rules and indexes belong to `../mobile-app`; deploy only their Firestore targets for this change. The outbox needs the `status + dueAt` composite index. Large/private fields are excluded from indexing and marketplace rate limits have TTL enabled.

The Auth deletion trigger first revokes access, then removes conversations/messages, both previews, notes, ledgers, notifications, web trainee profile/health data, trainer workspace/evidence/application/catalogue records and membership. Parent enquiry and deletion-job records survive until dependent cleanup succeeds, allowing retries. A minimal application tombstone prevents a later Google Form sync from recreating a deleted trainer. Deleting the original Google Form response itself remains an external administrative task.

## Email delivery

`deliverWebMarketplaceNotificationsV1` runs every minute and returns immediately while email is disabled. The enabled worker retrieves `WEB_MARKETPLACE_RESEND_API_KEY` from Secret Manager. Invitations, new enquiries and unread-message alerts contain secure links, without message bodies or training details.

Message alerts become eligible after two minutes. A read acknowledgement, changed unread episode, block, withdrawal, revoked access or opted-out preference suppresses delivery. A conversation receives at most one alert per unread episode. Database leases and stable Resend idempotency keys protect overlapping workers and uncertain responses; the first delivery payload is retained unchanged for retries. After 23 hours without confirmation, a record becomes `needs_review` rather than risking a duplicate after the provider's 24-hour idempotency window. Inspect the provider before manually resolving such records.

## Local verification and browser QA

Implementation verification on 9 September 2026 passed lint/types/builds, 90 web tests, 209 Functions tests, 36 script tests and all 24 existing mobile Firestore/Storage rules tests. The emulator tests include invitation ownership/expiry/reuse, locked content, duplicate sends/unlocks, credential/publication conflicts, import preservation, notification episodes/preferences and retryable account deletion.

Browser QA used the service-backed disposable emulator harness: free unlock, two-way messages, unread acknowledgement, draft refresh, private notes, saved follow-up dates, profile publication with preserved availability notes, reporting-period queue reconciliation, dialog Escape/focus return and keyboard skip navigation. Width checks at 320, 390, 768, 1440 and 1920 pixels found no horizontal overflow in the checked views. The downloaded CSV contained nine free unlocks totalling £0. This does not replace the controlled authenticated development/email smoke test below.

## Development deployment status

On 9 September 2026, the three marketplace Functions and the updated application import/review/expiry Functions were deployed to `petey-dev-getcass` in `europe-west2`. Shared Firestore rules and indexes were deployed; the notification composite index is READY and the rate-limit TTL is ACTIVE. Existing remote field overrides omitted from the local index file were preserved.

`WEB_TRAINER_PILOT_ENABLED=false` and `WEB_TRAINER_EMAIL_ENABLED=false` are confirmed in the deployed environment. The email scheduler exists, but its worker exits while disabled. The callable's public endpoint returns HTTP 401 for requests without credentials/App Check. Backend deployment is separate from frontend publication: pushes to web `main` trigger the existing GitHub Pages workflow. Publishing the frontend does not enable either pilot flag.

The project restricts `allUsers` invoker bindings. As with the existing onboarding services, the new callable required this post-deploy service configuration after Firebase's invoker-binding step failed:

```sh
gcloud run services update webmarketplacev1 --region europe-west2 --project petey-dev-getcass --no-invoker-iam-check
```

This allows web requests to reach the callable's Firebase Auth/App Check checks. The scheduled worker is not made public. The runtime retains its existing Firestore/Vertex roles; the pilot adds Auth user lookup and conditional create/delete access for credential evidence, plus conditional deletion of trainer application assets. Resend secret access is deliberately deferred until the secret is configured.

## Running the checks

Use Node 22 and Java 21 or newer for current Firebase emulators. Install dependencies in the web app, `functions/` and the sibling mobile app. With the configured emulator ports free:

```sh
npm run test:marketplace
```

This runs lint, types, web and Functions tests/builds with Auth, Firestore and Storage emulators, then runs the existing mobile Firestore/Storage rules suites sequentially. Those suites must not run concurrently with the existing Functions rules tests because they share a disposable emulator project.

For browser QA, start the emulators with `firebase.marketplace-tests.json`, then run:

```sh
npm run dev -- --host 127.0.0.1
npm run dev:marketplace-qa
```

Open `/trainer/?pilotQa=trainer` and `/messages/?pilotQa=trainee` under the Vite base path. The bridge is restricted to loopback and the Vite origin. It seeds only `demo-petey-pilot-browser` and calls the actual service layer against emulators. Its synthetic roles bypass authentication/App Check specifically for visual QA; they are not evidence of a live authenticated deployment. The QA import branch is removed from production builds. Rebuilding/restarting the bridge resets this disposable dataset.

See [the post-implementation checklist](./trainer-pilot-todo.md) for email configuration, controlled development smoke tests, release and rollback.
