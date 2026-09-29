# David Lloyd demo

The standalone consumer and sample-data dashboard are built for `/david-lloyd-demo/` and `/david-lloyd-demo-admin/`. They share the same ten fictional trainer identities. They do not create accounts, send enquiries or book sessions.

## Build and isolation

```sh
npm ci
npm ci --prefix functions
npm ci --prefix functions-david-lloyd
npm run dev:david-lloyd
npm run dev:david-lloyd-admin
npm run verify:david-lloyd
```

`vite.david-lloyd.config.ts` and `vite.david-lloyd-admin.config.ts` build to `dist-david-lloyd/` and `dist-david-lloyd-admin/`. Assets, contracts, data and functions live in their own David Lloyd directories. Neither demo imports the Third Space catalogue. The existing Third Space source pin remains independent.

The visual direction preserves the existing composition, spacing and interactions: cream `#FCFCF6`, plum `#82285F`, charcoal `#474A4A`, DM Sans, the official script logo and monochrome synthetic portraits. The landing page pairs the existing copy with an original generated coaching photograph, placed to the right on desktop and after the CTA on mobile. Responsive 1600px and 4K WebP exports keep delivery lightweight. The conversation, matches and profile panel retain their current roles and restrained motion, with reduced-motion support. Per-session prices appear beside club locations on cards and profiles; the three results confirmation notes are no longer displayed.

## Matching and data handling

Members match at their home club and any additional clubs whose access they explicitly confirm. Package names do not grant access. Exclusions take precedence. Non-members supply one training area. Budgets remain free-form per-session preferences and do not filter or rank matches. Profiles display assigned £40 or £42.50 per-session demo rates based on the supplied Cheam app examples; actual club tariffs, session lengths and affordability are not inferred. Tennis and swimming lessons are outside this PT catalogue.

The sample contains four Raynes Park trainers, three Kingston trainers and three Colliers Wood trainers. Other verified Greater London clubs remain recognised but have no fictional profiles. See [research and provenance](david-lloyd-sources.md).

The Firebase codebase `david-lloyd-demo` exports `runDavidLloydOnboardingTurnV1` and `matchDavidLloydTrainersV1` in `europe-west2`. It uses the existing server-side OpenAI adapter and secret, App Check, bounded requests, transient retries and validated match evidence. Conversation text and results stay in browser memory and are sent to the backend/provider for processing; application code does not persist them or log their contents. Reset and refresh clear the conversation. Rate limiting retains hashed-IP counters in the existing server-only collection under a separate `david-lloyd-demo` prefix.

The dashboard is a deterministic sample, not live analytics. Submitted enquiry figures illustrate a possible future integration; the consumer demo does not submit them.

## Release order

1. Run local deterministic verification and the relevant model evaluations using synthetic conversations.
2. Deploy only the new codebase with `npx -y firebase-tools@latest deploy --config firebase.david-lloyd.json --only functions:david-lloyd-demo --project petey-dev-getcass`.
   The existing project blocks public `allUsers` invoker bindings. As with Third Space, source uses a private invoker and the two new Cloud Run services use `--no-invoker-iam-check`; Firebase App Check remains mandatory. See the exact service-specific commands in [the backend runbook](../functions-david-lloyd/README.md). Never change other services or project-wide IAM for this release.
3. Verify ready Cloud Run revisions, traffic, App Check rejection, and the protected hosted onboarding/matching flow. Do not infer runtime readiness from a successful upload.
4. Commit and push the verified source. Pin its full SHA in `.github/david-lloyd-demo.json` on main and publish through the combined Pages workflow. Keep `.github/third-space-demo.json` unchanged.
5. Verify both new live routes, an actual browser journey, and existing Petey/Third Space routes.

Use a registered local App Check debug token only from ignored environment files for optional hosted checks. Never put it in a production build or commit it.

## Preservation checkpoint

Before this work, all dirty local changes were committed and pushed as `3a5bff5` on `codex/preserve-core-petey-2026-09-29`. The unrelated core model migration remains there. The completed Third Space location flow was committed as `dcbcbbe`, merged into main as `3ababa7`, and published at `438ba42`, retaining main's combined workflow and onboarding recovery fix. The shared timeout normalisation is `26af043`, also selected by the protected Third Space pin. No stash was used.

## Preview film

The [editable 52-second preview](../demo-media/david-lloyd-preview/README.md) and its local render assets are versioned separately from production assets. The delivered MP4 and poster are in `../david-lloyd-output-2026-09-29-190738/` relative to this repository. The film preserves the reference music, scene boundaries and wedding story, with actual adapted dashboard captures. QA confirms 1920×1080, 30fps, exactly 1,560 frames, 52 seconds and complete decoding.

## Acceptance evidence — 29 September 2026

- Local verification: 34 consumer/admin tests and 80 backend tests pass; both builds, typechecking, lint and catalogue/isolation validation pass. Full Petey regression passed: 184 frontend tests (3 skipped), 212 backend tests (20 skipped), and the script contract suites.
- Hosted verification: real seven-turn wedding conversation with uncertain per-session budget reaches three matches; home club only despite a package name, explicitly confirmed additional access, exclusions, uncovered clubs and refinement all pass. Both endpoints reject a missing App Check token.
- Cloud Run: `rundavidlloydonboardingturnv1-00003-rim` and `matchdavidlloydtrainersv1-00003-rud` are ready and each receives 100% of its service traffic.
- UI: phone (320/390), tablet (768) and desktop (1440) layouts checked without horizontal page overflow. Profile and dashboard details open by keyboard; Escape restores trigger focus. Reduced-motion paths remain in place. Text contrast on cream is 8.43:1 (plum), 8.69:1 (charcoal) and 5.88:1 (muted text).
- Dashboard data reconciles across periods/clubs/trainers. At 28 days: 2,818 completed searches, 911 sample enquiries, 32.3% conversion; Emma has 643 recommendations and 147 sample enquiries. Uncovered clubs show explicit zero-data states.
- Video: full decoding, audio continuity, reference timings and exactly 1,560 frames verified; detailed evidence is in the preview source's `qa/verification.json`.

The combined Pages [run 36616205027](https://github.com/zainansarii/petey-web/actions/runs/36616205027) passed and published both routes from source `9584887`, with main at `a428cbd`. An initial run stopped before publication on animation-test timeouts; the successful run uses one Vitest worker. The Third Space source pin remains unchanged.

Final live acceptance confirms 23 existing Petey/Third Space route and asset hashes unchanged, both new routes and their assets served, and all ten David Lloyd portrait hashes matched. A genuine hosted browser wedding journey with `Not sure yet` budget returned Grace, Emma and Adam. A transient chat failure recovered via the visible retry control without losing or duplicating the answer. Emma's profile, focus restoration and retained refinement history passed. Reset returned to the landing page, and starting again showed only the opening prompt with no previous answers. Native Chrome verified the live dashboard totals, Emma's drill-down, Acton Park's zero state, 390px layout and clean console. The machine-readable [release record](david-lloyd-release-2026-09-29.json) records the release pins and asset checks.
