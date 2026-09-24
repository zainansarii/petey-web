# Third Space demo functions

An isolated Firebase codebase for anonymous, live AI trainer matching. It uses the existing development project's Vertex AI service identity and App Check, without Firebase Auth or persistent conversations/profiles. Only hashed-IP counters are written, under a `third-space-demo` key namespace in the existing server-only `_webOnboardingRateLimitsV3` collection.

The two callables in `europe-west2` are `runThirdSpaceOnboardingTurnV1` and `matchThirdSpaceTrainersV1`. Both accept `{ messages: [{ role, content }] }`, starting with the assistant opening and alternating roles. The turn endpoint ends on a user message. Results follow `third-space-shared/contract.ts`.

Install and validate:

```sh
npm ci --prefix functions-third-space
npm --prefix functions-third-space run build
npm --prefix functions-third-space test
```

Deploy this codebase alone, from the demo branch:

```sh
npx -y firebase-tools@latest deploy --config firebase.third-space.json --project petey-dev-getcass --only functions:third-space-demo
```

Runtime parameters are `THIRD_SPACE_SERVICE_ACCOUNT`, `THIRD_SPACE_CHAT_MODEL` and `THIRD_SPACE_MATCHING_MODEL`. Development values are configured in the package's project-specific environment file. Model credentials remain server-side through the runtime service account; no model API key is shipped to the browser. The service identity needs its existing Vertex AI and Firestore permissions.

The project's existing Cloud Run invocation pattern may require disabling the IAM invoker check on the two newly deployed services because organisation policy prevents an `allUsers` binding. Keep App Check enforced in the callable. Do not update the original Petey services or their function ownership labels.

The dedicated codebase label prevents a later deployment of `web-onboarding-v3` from treating these functions as omitted source. Shared TypeScript and catalogue modules are compiled into this package's own `lib/` directory before upload, so deployment has no runtime dependency on files outside its source package.

Transient model HTTP 429/502/503/504 responses receive at most two retries with 2s/5s backoff plus up to 500ms jitter. Brief extraction and ranking try `THIRD_SPACE_MATCHING_MODEL` first, then use `THIRD_SPACE_CHAT_MODEL` for the remaining attempts if that first request fails transiently. The prompt, response schema, candidate filtering and evidence validation stay the same. Chat continues to use its original model. SDK retries are disabled; fallback does not add attempts. Attempts time out after 20s for chat or 25s for brief/ranking, keeping the worst-case two-stage match within the 180s callable limit. Invalid model output and other failures are not retried. Retry telemetry contains only operation type, model names, retry number, HTTP status and delay.

Membership and approximate geographic filtering run before the AI ranking. The AI selects only real candidate IDs, with source-quoted evidence for each explanation. Unknown locations or access yield a refinement message. Individual rates, gender and diary availability are not in the catalogue and do not affect ranking. A provider failure is surfaced for retry; there is no simulated matching fallback.
