# David Lloyd demo functions

An isolated Firebase codebase for anonymous, live AI trainer matching. It uses the existing development project's runtime service identity, the server-only OpenAI API secret and App Check, without Firebase Auth or persistent conversations/profiles. Only hashed-IP counters are written, under a `david-lloyd-demo` key namespace in the existing server-only `_webOnboardingRateLimitsV3` collection.

The two callables in `europe-west2` are `runDavidLloydOnboardingTurnV1` and `matchDavidLloydTrainersV1`. Both accept `{ messages: [{ role, content }] }`, starting with the assistant opening and alternating roles. The turn endpoint ends on a user message. Results follow `david-lloyd-shared/contract.ts`.

Install and validate from the repository root with Node 22. Both backend packages are needed to compile the shared adapter:

```sh
npm ci
npm ci --prefix functions
npm ci --prefix functions-david-lloyd
npm --prefix functions-david-lloyd run build
npm --prefix functions-david-lloyd test
```

Deploy this codebase alone, from the demo branch:

```sh
npx -y firebase-tools@latest deploy --config firebase.david-lloyd.json --project petey-dev-getcass --only functions:david-lloyd-demo
```

The runtime identity is configured by `DAVID_LLOYD_SERVICE_ACCOUNT`. Both callables bind the `OPENAI_API_KEY` Firebase secret. Model routing is shared with normal Petey in `functions/src/openai.ts`: Luna/low for chat; Sol/medium for brief extraction and ranking. The old Gemini model environment variables are no longer read. See [OpenAI backend setup](../docs/openai-backend-setup.md) for credentials, billing and deployment. Firestore permissions remain necessary for rate limiting.

Organisation policy rejects an `allUsers` IAM binding. The callable source therefore uses `invoker: "private"`, matching the existing Third Space deployment pattern. After deploying, enable anonymous transport on **only these two new Cloud Run services** by disabling their IAM invoker check:

```sh
gcloud run services update rundavidlloydonboardingturnv1 --project=petey-dev-getcass --region=europe-west2 --no-invoker-iam-check
gcloud run services update matchdavidlloydtrainersv1 --project=petey-dev-getcass --region=europe-west2 --no-invoker-iam-check
```

Verify both services have `run.googleapis.com/invoker-iam-disabled: 'true'`, a ready revision and 100% traffic on the intended revision. Then verify a request without App Check is rejected and an actual protected onboarding/matching journey succeeds. This step changes no project-wide IAM binding. App Check stays enforced in both callable configuration and request handling. Do not update original Petey/Third Space services or their function ownership labels. Recheck the annotation after later deployments.

The dedicated codebase label prevents a later deployment of `web-onboarding-v3` from treating these functions as omitted source. Shared TypeScript and catalogue modules are compiled into this package's own `lib/` directory before upload, so deployment has no runtime dependency on files outside its source package.

Transient model HTTP 429/500/502/503/504 responses and request timeouts receive at most two retries with 2s/5s backoff plus up to 500ms jitter. Brief extraction and ranking always use Sol at medium, including retries; chat always uses Luna at low. The prompt, response schema, candidate filtering and evidence validation stay the same. SDK retries are disabled. Attempts time out after 20s for chat or 25s for brief/ranking, keeping the worst-case two-stage match within the 180s callable limit. Invalid model output and other failures are not retried. Retry telemetry contains only operation type, model names, retry number, HTTP status or a timeout flag, and delay.

Membership and approximate geographic filtering run before the AI ranking. The AI selects only supplied catalogue IDs, with catalogue-quoted evidence for each explanation. Unknown locations or access yield a refinement message. Individual rates, gender and diary availability are not in the catalogue and do not affect ranking. A provider failure is surfaced for retry; there is no simulated matching fallback.
