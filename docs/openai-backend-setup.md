# OpenAI backend setup

> This demo release includes the shared OpenAI adapter and the Third Space migration. Core Petey provider changes are released separately. For core credential rotation, inspect deployed bindings and update existing service revisions without deploying unrelated source changes from a working checkout. The broader migration instructions below apply only when that source migration is included in its own release.

The web backends use OpenAI Responses through the shared adapter in `functions/src/openai.ts`:

| Workload | Model | Reasoning |
| --- | --- | --- |
| Petey onboarding, including V3 compatibility requests | `gpt-6-luna` | `low` |
| Third Space onboarding | `gpt-6-luna` | `low` |
| Matching profile generation, trainer ranking and enquiry summaries | `gpt-6-sol` | `medium` |
| Third Space brief extraction and trainer ranking, including retries | `gpt-6-sol` | `medium` |

The model and effort are fixed in this adapter. Old `WEB_*MODEL*` and `THIRD_SPACE_*MODEL` Gemini settings are no longer read. No key belongs in Vite variables, a browser bundle or tracked `.env` files. Both Firebase codebases bind the same project secret, `OPENAI_API_KEY`. Setting the secret alone does not deploy the code.

## 1. Create the OpenAI key

1. Sign in to the [OpenAI API platform](https://platform.openai.com/) and select or create the API project for Petey.
2. Configure API billing and budget alerts suitable for the pilot. Ensure the project allows `gpt-6-luna` and `gpt-6-sol`.
3. Open [API keys](https://platform.openai.com/api-keys) for that project and create a new server API key, named `Petey Firebase`. A project service-account key is suitable for a deployed backend. The key must be permitted to create Responses; if using scoped service-account keys, this is `api.responses.write`.
4. Copy the secret value when it is displayed. Enter it only into the secret prompt in the next step.

Official references: [API quickstart](https://developers.openai.com/api/docs/quickstart), [service-account key scopes](https://developers.openai.com/api/docs/guides/terraform/service-accounts), [data controls](https://developers.openai.com/api/docs/guides/your-data).

## 2. Save the key in the existing Firebase project

Use Node 22, matching both Functions packages. In a terminal:

```sh
cd /Users/zainansari/dev/petey/petey-web
nvm use 22
npx -y firebase-tools@latest login
npx -y firebase-tools@latest functions:secrets:set OPENAI_API_KEY --project petey-dev-getcass
```

Paste the key at Firebase's secret-value prompt. The CLI stores it in Google Secret Manager. The main web functions and the separate Third Space functions already declare their secret bindings; do not paste the key into source code or send it in chat.

The existing `WEB_ONBOARDING_SERVICE_ACCOUNT_V3` and `THIRD_SPACE_SERVICE_ACCOUNT` identities remain in use. Deployment must be able to grant them access to this secret. If Firebase reports a permission error granting access, have a project administrator grant each named runtime identity `roles/secretmanager.secretAccessor` on `OPENAI_API_KEY` and retry deployment. This provider migration does not require a Firestore data reset.

See [Firebase secret parameters](https://firebase.google.com/docs/functions/config-env#secret_parameters).

## 3. Check real model access before deploying

These optional commands make billable model requests using synthetic conversations and public trainer data. They require a key in the current terminal environment; they do not read Secret Manager automatically or write Firebase data. In macOS zsh, input it without putting the value into shell history:

```sh
read -rs 'OPENAI_API_KEY?OpenAI API key: '
printf '\n'
export OPENAI_API_KEY
npm --prefix functions run build
npm --prefix functions-third-space run build
node scripts/check-openai-models.mjs
node scripts/eval-third-space-onboarding.mjs
node scripts/eval-third-space-matching.mjs
node scripts/eval-third-space-matching.mjs --force-retry
unset OPENAI_API_KEY
```

The connectivity check exercises Luna streaming and Sol structured output through the production adapter. The Third Space evaluations check actual conversational coverage and evidence-checked ranking, including membership/location constraints. Review the replies and latency as well as pass counts. `--force-retry` injects one transient failure per matching stage, then calls Sol again at medium reasoning; it never downgrades to the chat model.

For the local Firebase emulator only, `.secret.local` in each Functions package can contain `OPENAI_API_KEY=...`. That filename is gitignored. Normal Vite development still calls the deployed backend unless the frontend is explicitly configured for the emulator.

## 4. Validate and deploy both backends

From the repository root, with Node 22 active and dependencies installed in the root, `functions` and `functions-third-space` (`npm ci`, `npm ci --prefix functions`, `npm ci --prefix functions-third-space` on a fresh checkout):

```sh
npm run verify
npm run verify:third-space
npx -y firebase-tools@latest deploy --config firebase.json --project petey-dev-getcass --only functions:web-onboarding-v3
npx -y firebase-tools@latest deploy --config firebase.third-space.json --project petey-dev-getcass --only functions:third-space-demo
```

Redeploy both after rotating the key: deployed functions need a new revision to pick up a new secret version. Firebase hosting/Pages publication is separate. Include the updated privacy notice in the web release so it names OpenAI when these backends become active.

### If the V4 deploy fails at the invoker IAM step

The development project's domain-restricted sharing policy rejects an `allUsers` invoker binding. The function build can succeed and create its Cloud Run service before Firebase reports `Failed to set invoker`. Confirm that the error specifically says the policy members do not belong to a permitted customer; a missing administrator permission or a failed build is a different issue.

The existing browser endpoints use Cloud Run's `--no-invoker-iam-check` setting, while the callable still enforces App Check and its application checks. Apply that same setting to the two new V4 services, without changing organisation policy:

```sh
gcloud auth login
gcloud run services update runwebonboardingturnv4 --region=europe-west2 --project=petey-dev-getcass --no-invoker-iam-check
gcloud run services update finalizewebonboardingv4 --region=europe-west2 --project=petey-dev-getcass --no-invoker-iam-check
```

`gcloud` and the Firebase CLI maintain separate logins. Reauthenticate `gcloud` if it cannot refresh its token. If the service update is rejected by `run.managed.requireInvokerIam`, stop and have the project owner review the endpoint architecture; do not disable that organisation policy. Google's [public endpoint documentation](https://docs.cloud.google.com/run/docs/authenticating/public) describes this supported configuration for domain-restricted projects.

After the update, read back both services' `run.googleapis.com/invoker-iam-disabled` annotations and verify their readiness and zero minimum instances. A POST with callable JSON but without App Check must reach the application and return `401 UNAUTHENTICATED`, without making a model call. This verifies access protection, not a successful live AI conversation. Do not delete and recreate functions to repair this IAM step. A later targeted Functions update can confirm a clean Firebase CLI deployment after the services exist.

The installed Firebase SDK/CLI treats `onCall` separately from `onRequest`: adding `invoker: "private"` to callable options does not suppress the CLI's initial public-invoker binding attempt. The Cloud Run setting and its readback are the effective controls for this project.

After deployment, complete a real App Check-protected onboarding and matching journey in normal Petey and at `https://joinpetey.com/third-space-demo/`, including refinement and an enquiry summary. Existing cached normal-Petey matches from another model are refreshed on the next matching/profile request. Existing saved matching briefs remain intact.

## Development cost controls

Both normal-Petey chat callables explicitly use `minInstances: 0`. Third Space also uses the default of zero. They can scale to zero between requests, so no instances are reserved just to keep chat warm. The first request after an idle period may take longer. This removes the reserved-instance minimum in the deployment warning after redeployment; it does not make all Firebase services free or impose a dollar cap.

If a deployment is already waiting at the old minimum-instance cost prompt, answer `n` and rerun the deployment command. That process already read the previous configuration; continuing it will not pick up this edit.

Firebase/Google Cloud and OpenAI are separate bills. For a development target of about $5 total per month, a starting allocation is $2 for Functions and $2 for OpenAI, leaving some room for other Google Cloud charges. These settings have to be saved in the provider consoles; changing the source code does not configure billing limits.

1. **Firebase Functions:** select `petey-dev-getcass`, then Settings > Usage and billing > Details & settings > Service-level spend caps. Set a monthly spend cap for **Cloud Run functions** (the underlying service for Firebase Functions), then click Configure. Caps are in Preview and apply to all functions using that service in the project, including mobile functions. They pause new usage when the tracked threshold is reached, but delayed reporting can produce overages. Firestore, Storage, build/artifact storage and other services are outside this cap. See [Firebase spend caps](https://firebase.google.com/docs/projects/billing/spend-caps).
2. **OpenAI:** select the Petey API project, then Project settings > Limits > Spend > Edit spend limit. Enter the monthly amount, turn on **Enforce a hard limit**, and save. A plain spend alert does not stop requests. Enforcement can lag slightly here too. See [OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits).
3. Add an **all-services Google Cloud budget alert** for the project to monitor charges outside Functions. Alerts do not stop services. See [Firebase budget alerts](https://firebase.google.com/docs/projects/billing/budgets).

These controls do not guarantee a combined $5 maximum. For development without deployed compute charges, use the Firebase emulators and the existing UI fixtures; real OpenAI requests remain billable.

## Data handling and limits

Requests replay only the application-provided conversation or matching inputs, use `store: false`, and do not use OpenAI conversation persistence or `previous_response_id`. This does not guarantee zero provider retention; OpenAI's abuse-monitoring, caching and account-specific data policies still apply. Confirm the API project's processing location and contract/transfer settings. GPT-6 EU residency requires eligible account configuration and Standard processing; a Firebase function running in London does not by itself establish OpenAI processing location.

The adapter rejects refusals, incomplete output, empty output and streams that end without a completed response. It disables SDK retries and enforces an overall request deadline. Third Space retains its bounded application retries: chat attempts have 20 seconds; each brief/ranking attempt has 25 seconds, with at most two retries per stage inside the existing 180-second matching callable. Real model latency and quality require the API key and live evaluation; mocked transport checks alone do not establish them.
