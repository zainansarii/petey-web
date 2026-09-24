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

Membership and approximate geographic filtering run before the AI ranking. The AI selects only real candidate IDs, with source-quoted evidence for each explanation. Unknown locations or access yield a refinement message. Individual rates, gender and diary availability are not in the catalogue and do not affect ranking. A provider failure is surfaced for retry; there is no simulated matching fallback.
