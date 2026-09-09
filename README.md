# Petey web

A web trainer/trainee matching marketplace. Trainees complete conversational onboarding and discover matched trainers; invited trainers manage enquiries, free pilot unlocks, conversations and public profiles in their workspace.

## Run locally

```bash
npm install
npm run dev
```

The interactive trainer dashboard concept is available at `/petey-web/trainer-preview/`.
It uses sample data and simulated unlocks, with no live payments or messaging.
See [the wireframe specification](./docs/trainer-dashboard-wireframe.md) for the
codebase findings, metric definitions, interaction coverage and implementation gaps.

The live pilot entry points are `/petey-web/trainer/` and `/petey-web/messages/`.
They use authenticated server data and are separate from the sample wireframe.
See [the pilot implementation guide](./docs/trainer-pilot.md) and
[post-implementation to-do list](./docs/trainer-pilot-todo.md), including the
deferred Resend setup. New invitations/enquiries and email delivery default to off.
`npm run test:marketplace` runs verification with Firebase emulators and the shared mobile rules suites.

`npm run verify` runs linting, type-checking, unit tests, and production builds for both the web app and the `web-onboarding-v3` Firebase Functions codebase. The Functions runtime targets Node 22; the web app supports Node 20.19 or newer.

There is deliberately no browser-side extraction parser or simulated concierge. A usable onboarding conversation requires the configured V3 Functions backend and Gemini; unit tests inject bounded response fixtures at the protocol boundary.

For responsive manual QA only, a Vite development build accepts `?onboardingFixture=1`. This lazy-loads fixed protocol snapshots (it does not interpret text), and the branch is removed from production builds.

## Conversational onboarding backend

The `functions/` package is a separate Firebase Functions codebase named `web-onboarding-v3`, deployed in `europe-west2`. It exports:

- `createWebOnboardingDraftV3`
- `getWebOnboardingDraftV3`
- `runWebOnboardingTurnV3`
- `finalizeWebOnboardingDraftV3`
- `confirmWebOnboardingDraftV3`
- `consumeWebOnboardingDraftV3`
- `getWebClientProfileV3`
- `deleteWebOnboardingDraftV3`
- `withdrawWebHealthConsentV3`

The browser keeps only a V3 opaque draft capability in session storage. Each ordinary turn continues one native Gemini chat and stores messages only. In that same call, Gemini returns a small private application envelope containing the user-facing reply, a readiness signal, and up to three contextual example answers. Only the reply and examples can reach the interface; the envelope itself is never shown or stored as a chat message. There is no coverage engine, profile patch, concierge-note store, or secondary model judge. Gemini may finish from the fifth answer when it has a good-enough picture, but availability and budget must each have been asked and answered first. Seven answers is a target rather than a limit, with twelve as the fallback finish point after those required topics are complete. A separate finalization call turns the complete transcript into an internal Markdown matching profile. The profile is never rendered in onboarding; the secure final-details modal opens over the completed chat instead. Identity stays outside prompts and transcript messages.

The conversation is one native Gemini chat: every turn restores the stored
`user`/`model` history and sends only the new user message. To change Petey's
tone, questioning style, or conversational behaviour, edit
`ONBOARDING_CONVERSATION_SYSTEM_PROMPT` in
[`functions/src/onboardingConversationPrompt.ts`](./functions/src/onboardingConversationPrompt.ts).
The prompt guides the conversation through trainee, trainer, and sessions phases,
with one open-ended question per turn, restrained acknowledgements, useful
clarifications inside each phase, and context-specific example answers.
The end-only `ONBOARDING_MARKDOWN_PROFILE_SYSTEM_PROMPT` is in the same file and is intentionally separate
from the live chat. It controls the internal matching profile, which is not rendered to the user.

Draft messages and idempotency records are subcollections rather than one growing array. Authenticated consumption atomically writes the user-confirmed internal `profileMarkdown` document, then recursively removes the capability-protected draft and raw transcript. The Markdown-aware matcher reads eligible catalogue entries and persists versioned matches. The marketplace creates a separate trainee-confirmed practical summary when the trainee sends an enquiry.

For a production environment:

1. Enable Firestore and configure the six TTL policies in the [rollout runbook](./docs/web-onboarding-v3-rollout.md).
2. Enable App Check for the Web app with reCAPTCHA Enterprise and set `VITE_FIREBASE_APPCHECK_SITE_KEY`.
3. Enable the Vertex AI API and deploy the V3 Functions with a dedicated runtime service account carrying only the Firestore and Vertex AI roles documented in the rollout runbook. No Gemini API key is stored in the browser or repository.
4. Optionally set `WEB_ONBOARDING_GEMINI_MODEL_V3`; it defaults to `gemini-3.7-flash`.
5. Build and test with `npm run verify`, then deploy with `firebase deploy --only functions:web-onboarding-v3`.
6. If organization policy rejects an `allUsers` invoker binding, apply the
   documented Cloud Run `--no-invoker-iam-check` post-deploy step to the nine
   V3 services. App Check and the callable's capability checks still run on
   every onboarding request.

The callable endpoints enforce App Check, capability authorization, request/version limits, rate limits, idempotency keys, a 2,000-character message limit, and a twelve-answer fallback finish point once availability and budget are complete. A failed conversational call produces an explicit retry state. Readiness automatically starts internal profile preparation; failed preparation preserves the transcript and can be retried. Successful preparation opens the secure final-details modal over the chat without rendering the Markdown profile. The production mobile `completeClientOnboarding` callable remains untouched.

Before a V3 launch or web-only data reset, follow the
[privacy procedure](./docs/web-onboarding-v3-privacy.md) and
the [guarded reset and rollout runbook](./docs/web-onboarding-v3-rollout.md).

## Firebase email-link authentication

The configured app reads approved catalogue profiles and supports real introductions to accepted, enabled pilot trainers. The separate onboarding and trainer-preview fixtures remain demo-only. Onboarding and enquiry summary generation require Firebase configuration and the protected Gemini backend.

For real web magic links and secure onboarding drafts, copy `.env.example` to `.env.local` and provide the Firebase Web app configuration plus the reCAPTCHA Enterprise App Check site key. Local development should additionally use a registered `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`; that value must stay in ignored local environment files and must never be added to a deployed build. Enable Email/Password > Email link in Firebase Authentication and add both `localhost` and the deployed custom domain to Firebase Authentication's authorised domains.

The mobile app's current callable and redirect are intentionally not reused: they enforce App Check and hand links to the native app. This web build uses Firebase's Web SDK and returns to the current GitHub Pages URL.

## GitHub Pages

The included workflow builds and deploys `dist/` on pushes to `main`.

1. In the GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Push this repository to GitHub.
3. Optional: add the following repository variables under **Settings → Secrets and variables → Actions → Variables** to enable real email delivery:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_APPCHECK_SITE_KEY`

Vite uses relative asset paths, so the same build works at a project Pages URL such as `https://zainansarii.github.io/petey-web/` and at a custom domain.

Use the default project Pages URL only for the Firebase-free prototype. Before enabling real authentication or collecting user information, use a dedicated custom domain: every repository under `username.github.io/*` shares the same browser-storage origin.

## Product integration note

The transcript and sensitive matching details live in the short-lived server draft in configured environments. Name, date of birth, and email are accepted only by the final confirmation callable and never enter the assistant runtime or Gemini request. The email address is also kept locally only as required to complete Firebase email-link sign-in and is removed after successful authentication or a failed send.

The confirmed internal Markdown profile drives saved web matches after sign-in. Pilot enquiries share only the trainee-confirmed practical summary and introduction. Web membership and conversations remain separate from production mobile profiles and chat contracts.
