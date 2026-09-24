# Third Space demo operations

The `third-space-demo` branch contains a standalone trainee journey: conversation, AI recommendations, profile details and refinement. It has no account creation, trainer dashboard or booking flow. The normal Petey entrypoints remain separate.

The public entrypoint is `https://joinpetey.com/third-space-demo/`. The exact published frontend revision is recorded by the manifest on `main`; backend deployment is separate. Verify a live conversation after each release, since deployment alone does not establish that the hosted journey works.

## Architecture and data handling

- `vite.third-space.config.ts` builds the dedicated entrypoint with base `/third-space-demo/` into `dist-third-space/`. Its local portraits, hero and wordmark come from `public/third-space-demo/`. The demo HTML includes `noindex`.
- `src/third-space-demo/api.ts` calls `runThirdSpaceOnboardingTurnV1` and `matchThirdSpaceTrainersV1` in Firebase project `petey-dev-getcass`, region `europe-west2`. Firebase Auth is not used. App Check with reCAPTCHA Enterprise is required.
- The isolated `third-space-demo` Firebase codebase lives in `functions-third-space/`. Vertex AI calls use the server-side service account; model credentials never enter the browser bundle. Runtime parameters select the service account, chat model and matching model.
- Shared contracts, the 40-trainer catalogue, club/location data and deterministic candidate selection live in `third-space-shared/`. Membership eligibility, explicit exclusions and geographic constraints narrow candidates before the AI ranks them. Returned IDs and explanation evidence are validated. Missing information or a provider failure yields refinement/retry rather than fabricated matches.
- The conversation and results stay in React memory; there is no local/session-storage profile. Refreshing or starting again clears them. Requests transmit the conversation to the backend and AI provider. Application code does not write conversations, briefs or matching results to Firestore, and application logs omit their contents.
- Rate limiting writes hashed-IP counters under a `third-space-demo` namespace in the existing server-only `_webOnboardingRateLimitsV3` collection: 120 turns or 24 match requests per hour, with an `expiresAt` field. This is operational metadata, so do not describe the service as retaining no data at all. Expiry-field presence alone is not proof of physical deletion.

See [catalogue provenance and research](./third-space-sources.md) for every profile/photo source, membership rules and the 24 September snapshot. The published £85/hour starting point informs the budget question; **individual trainer prices and diary availability remain unverified**. Budget bands are user preferences, not a tariff or guaranteed compatibility. Nearby-club calculations use approximate straight-line geography, not journey times.

## Run and validate

Use the repository root on `third-space-demo`, with a supported current Node version (the deployed functions runtime is Node 22):

```sh
npm ci
npm ci --prefix functions-third-space
npm run dev:third-space
```

Open the URL printed by Vite with `/third-space-demo/`. Normal development requests use the deployed AI endpoints. The frontend requires `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` and `VITE_FIREBASE_APPCHECK_SITE_KEY` in the existing Vite environment. Local App Check testing can use an already registered `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`; never commit a debug token.

For deterministic local UI checks only, add `?thirdSpaceFixture=1`. This switch is gated by Vite's development mode and does not enable fixture matching in a production build. A fixture pass is not a live AI acceptance test.

```sh
npm run verify:third-space
git diff --check
```

The verification command runs lint/type checks, demo component tests, the production build, backend compilation/tests and catalogue/build validation. Validation checks 40 unique trainers, all 16 current clubs with at least two trainers each, provenance fields, local source images, isolated build paths and `noindex`. Backend tests cover transcript validation, membership/location constraints and invalid model output. Browser acceptance must additionally cover a real App Check-protected conversation, recommendation evidence, refinement, errors/retry, keyboard dialogs and 320–430px/mobile plus tablet/desktop layouts.

The conversation preserves Petey's goal clarification, practical goal follow-up and personalised coaching follow-up. Third Space membership, access, training area and hourly budget remain required coverage; uncertain answers and explicit skips are accepted. There is no target turn count. To check prompt behaviour using synthetic transcripts against the actual chat model, after building the backend and authenticating with Google Cloud, run:

```sh
node scripts/eval-third-space-onboarding.mjs --gcloud-auth
```

Omit `--gcloud-auth` to use Application Default Credentials. This opt-in check makes model requests and prints their replies for human review. It checks vague goals, practical and coaching follow-ups, skips, missing Third Space details, completion and refinement. It does not deploy changes or test the hosted callable. Review the wording as well as the topic/coverage assertions; a passing topic label alone does not establish a good follow-up.

Use `npm run preview:third-space` after building to inspect the production bundle locally. The backend's more detailed contract and deployment notes are in [its README](../functions-third-space/README.md).

To exercise real brief extraction and evidence-checked ranking with synthetic profiles, run `node scripts/eval-third-space-matching.mjs --gcloud-auth`. Add `--force-fallback` to simulate a temporary preferred-model outage in each stage and verify real output from the alternate model. Both modes check extracted location/membership and actual catalogue matches, including a single-club access restriction. They do not replace hosted App Check acceptance.

## Deploy the isolated backend

From the demo branch, after verification:

```sh
npx -y firebase-tools@latest deploy --config firebase.third-space.json --project petey-dev-getcass --only functions:third-space-demo
```

Use `firebase.third-space.json`, not the original app's Firebase configuration. The dedicated codebase label and compilation output keep this deployment independent of the existing `web-onboarding-v3` functions. Retain App Check enforcement. If Cloud Run invocation is blocked by project/organisation IAM policy, follow the existing project's reviewed invocation setup described in the backend README; do not weaken the callable's App Check requirement.

After deployment, verify both callables from an allowed browser origin. A public request without App Check should fail; successful model output must be tested separately. Check application request duration/failure logs without adding transcript logging.

## Publish alongside Petey through Pages

Demo source remains on `third-space-demo`. The Pages integration is maintained separately on `main`. Use a separate main worktree so publishing does not require switching the working demo checkout or merging its application changes into the normal Petey app.

The main worktree's `.github/workflows/deploy-pages.yml` first verifies/builds normal Petey, then reads a full 40-character commit SHA from `.github/third-space-demo.json`. It checks that exact demo revision out into `.third-space-source`, installs its frontend/backend dependencies and runs `npm run verify:third-space`. It copies only `dist-third-space/` into the normal Pages artifact at `dist/third-space-demo/`, then publishes the combined artifact. The demo revision is pinned to an immutable commit, not a moving branch head.

Release sequence:

1. Verify, commit and push the intended demo revision on `third-space-demo`. Record its exact `git rev-parse HEAD` value.
2. In the separate `main` worktree, add/update `.github/third-space-demo.json` as `{ "commit": "<verified full demo SHA>" }` and retain the combined Pages workflow. Review that only the intended publication integration changes are included.
3. Commit/push the main integration change to trigger Pages, or dispatch the main workflow. The demo SHA must already be reachable remotely. Pages uses the existing Firebase repository variables for its demo build.
4. Wait for the Pages deployment, then inspect the hosted `/third-space-demo/` route, its local assets, and a complete real AI journey. Confirm the normal Petey route still works. Record the main/demo SHAs and deployment result separately from live acceptance.

For a frontend rollback, repin the manifest to a previously verified demo commit and redeploy Pages. Backend rollback is separate: redeploy the corresponding known-good `third-space-demo` functions source. Keep the shared callable contract compatible between the pinned frontend and deployed backend.
