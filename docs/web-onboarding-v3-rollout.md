# Web onboarding V3: reset and rollout runbook

This runbook applies only to `petey-web`, the `web-onboarding-v3` Functions
codebase, and the `(default)` database in `petey-dev-getcass` or
`petey-prod-getcass`. Firebase Auth users, mobile/client collections, chats,
trainers, notifications, and Cloud Storage are explicitly outside the V3 reset.

Production reset execution is irreversible. Use a maintenance window and obtain
product and privacy approval before running it.

## Web-only reset safety contract

Use `--scope web-onboarding`. It is dry-run by default and has an exact
Firestore collection allowlist covering V1/V2/V3 web drafts and operational
records, completed web profiles, legacy concierge notes, web health records,
and legacy web consent collections. It:

- requires the same allowlisted project ID in `--project` and
  `--confirm-project`;
- fixes the target to the `(default)` Firestore Native database and refuses
  emulator variables;
- verifies Firebase CLI and Admin access;
- blocks on moderation evidence or legal-hold records;
- inventories and prints document counts by root collection without printing
  document content;
- returns empty Auth and Storage deletion plans, and never inventories or
  deletes mobile/client, trainer, chat, notification, or Storage data.

Do not use the broader historical `full` scope for the V3 cutover.

```bash
npm run reset:user-data -- \
  --project petey-dev-getcass \
  --confirm-project petey-dev-getcass \
  --scope web-onboarding \
  --dry-run
```

After the reviewed count is approved and maintenance is active, repeat the same
command with `--execute`. Then run the dry run again; every allowlisted count
must be zero.

## TTL and access controls

Configure `expiresAt` TTL for these V3 collection groups:

- `webOnboardingDraftsV3`
- `messages`
- `idempotentTurnsV3`
- `idempotentFinalizationsV3`
- `_webOnboardingRateLimitsV3`
- `_webOnboardingConsumptionsV3`

Messages and idempotency records carry the draft expiry because deleting an
expired parent does not cascade to subcollections. Confirm no unrelated use of
the shared `messages` collection group relies on a conflicting `expiresAt`
policy. The mobile repository owns the shared Firestore rules and indexes; do
not deploy web-local replacements. Browser and mobile clients must remain unable
to read or write V3 drafts, web profiles, or web health records directly.

## Development rollout

1. Provision the dedicated V3 Functions runtime identity with only
   `roles/datastore.user` and `roles/aiplatform.user`. Configure
   `WEB_ONBOARDING_SERVICE_ACCOUNT_V3`; optionally configure
   `WEB_ONBOARDING_GEMINI_MODEL_V3` (default `gemini-3.7-flash`).
2. Run `npm run verify` and deploy the V3 backend:

   ```bash
   npx -y firebase-tools@latest deploy \
     --only functions:web-onboarding-v3 \
     --project petey-dev-getcass
   ```

3. Smoke-test App Check, capability isolation, optimistic versions, rate
   limits, idempotent turn/finalization retries, required availability and
   budget answers, and continuation beyond seven answers when needed.
4. Enter development maintenance, run the web-only dry run, review exact counts,
   obtain privacy approval, and execute the web-only reset.
5. Deploy the V3 frontend. Verify one native Gemini conversation, one call per
   ordinary turn, contextual quick replies from that same call, no private
   response metadata exposed in chat, no secondary judge, automatic internal
   profile preparation only after availability and budget, no Markdown profile
   rendered in the UI, the secure final-details modal over the completed chat,
   magic-link authentication, consumption, and transcript deletion.
6. Complete browser and accessibility QA at 1440×900, 1024px, 390×844, and
   320×568. Cover keyboard navigation, screen-reader status, reduced motion,
   overflow, conversational retry, and finalization retry.

## Production cutover

1. Deploy V3 Functions during the approved pre-cutover window and smoke-test
   with data that will be included in the reset.
2. Enter production maintenance. Run the `web-onboarding` dry run and record the
   collection counts. Product and privacy reviewers must approve those exact
   counts and confirm the preservation boundary.
3. Execute the same web-only scope. Verify a follow-up dry run reports zero and
   confirm Auth users, mobile/client collections, trainers, chats,
   notifications, and Storage remain untouched.
4. Deploy the V3 frontend and run the development acceptance checks against
   production controls.
5. Monitor only structured metrics: conversational-call failures, internal-profile
   preparation retries/failures, answers to secure details, document length,
   confirmation rate, and latency. Never log transcript, profile text, health,
   or identity.
6. After the monitoring window shows no V1/V2 traffic, delete the V1/V2 web
   callables and their obsolete TTL/configuration. Do not delete or modify the
   mobile `completeClientOnboarding` callable.

If verification fails after reset, keep web signup in maintenance and fix
forward with V3. Never reconnect a V1/V2 frontend to V3 drafts or imply erased
web profiles and health records can be recovered from this repository.
