# Third Space demo functions

An isolated Firebase codebase for anonymous, live AI trainer matching. It uses the existing development project's runtime service identity, the server-only OpenAI API secret and App Check, without Firebase Auth or persistent conversations/profiles. Only hashed-IP counters are written, under a `third-space-demo` key namespace in the existing server-only `_webOnboardingRateLimitsV3` collection.

The two callables in `europe-west2` are `runThirdSpaceOnboardingTurnV1` and `matchThirdSpaceTrainersV1`. Both accept `{ messages: [{ role, content }] }`, starting with the assistant opening and alternating roles. The turn endpoint ends on a user message. Results follow `third-space-shared/contract.ts`.

Install and validate from the repository root with Node 22. Both backend packages are needed to compile the shared adapter:

```sh
npm ci
npm ci --prefix functions
npm ci --prefix functions-third-space
npm --prefix functions-third-space run build
npm --prefix functions-third-space test
```

Deploy this codebase alone, from the demo branch:

```sh
npx -y firebase-tools@latest deploy --config firebase.third-space.json --project petey-dev-getcass --only functions:third-space-demo
```

The runtime identity is configured by `THIRD_SPACE_SERVICE_ACCOUNT`. Both callables bind the `OPENAI_API_KEY` Firebase secret. Model routing is shared with normal Petey in `functions/src/openai.ts`: Luna/low for chat; Sol/medium for brief extraction and ranking. The old Gemini model environment variables are no longer read. See [OpenAI backend setup](../docs/openai-backend-setup.md) for credentials, billing and deployment. Firestore permissions remain necessary for rate limiting.

The project's existing Cloud Run invocation pattern may require disabling the IAM invoker check on the two newly deployed services because organisation policy prevents an `allUsers` binding. Keep App Check enforced in the callable. Do not update the original Petey services or their function ownership labels.

The dedicated codebase label prevents a later deployment of `web-onboarding-v3` from treating these functions as omitted source. Shared TypeScript and catalogue modules are compiled into this package's own `lib/` directory before upload, so deployment has no runtime dependency on files outside its source package.

Transient model HTTP 429/500/502/503/504 responses and request timeouts receive at most two retries with 2s/5s backoff plus up to 500ms jitter. Brief extraction and ranking always use Sol at medium, including retries; chat always uses Luna at low. The prompt, response schema, candidate filtering and evidence validation stay the same. SDK retries are disabled. Attempts time out after 20s for chat or 25s for brief/ranking, keeping the worst-case two-stage match within the 180s callable limit. Invalid model output and other failures are not retried. Retry telemetry contains only operation type, model names, retry number, HTTP status or a timeout flag, and delay.

Membership and approximate geographic filtering run before the AI ranking. The AI selects only supplied catalogue IDs, with catalogue-quoted evidence for each explanation. Unknown locations or access yield a refinement message. Individual rates, gender and diary availability are not in the catalogue and do not affect ranking. A provider failure is surfaced for retry; there is no simulated matching fallback.
