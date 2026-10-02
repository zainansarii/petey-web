# Gymbox demo implementation and verification

Implementation and release record, 2 October 2026. Local verification, backend deployment, frontend publication and media acceptance are recorded separately.

## Existing-demo integration gate

The starting primary checkout was `david-lloyd-demo` at `feed65eb4a6ce7dac33396bd608b90efe6116598`, 12 commits ahead of fetched `origin/main`. The only untracked file was the implementation handoff, preserved on pushed `codex/preserve-gymbox-plan-2026-10-02` at `75d888c`. No stash was created. The unrelated `codex/preserve-core-petey-2026-09-29` branch remains intact. Both existing auxiliary checkouts were clean and were left in place.

Clean locked dependency installs completed for the root and all three existing backend packages. Checks ran with Node 22.13.1 and serial Vitest where applicable, with exit code zero:

- Petey `verify`: 185 frontend tests passed / 3 skipped; 212 backend tests passed / 20 skipped; additional Node suites 20 and 16 passed.
- Third Space `verify:third-space`: 30 consumer tests and 71 backend tests passed; consumer and admin builds passed.
- David Lloyd `verify:david-lloyd`: 34 UI/admin tests and 80 backend tests passed; both builds passed.

Main was fast-forwarded to `f3bae21f044eb30f185b564c7453f0cc1c5850b7`, including the CI dependency-install fix and serial verification. It was pushed along with the David Lloyd branch. [Pages run 37029993480](https://github.com/zainansarii/petey-web/actions/runs/37029993480) succeeded. All five existing public route HTML hashes and JS/CSS asset references were byte-identical before and after publication. `gymbox-demo` was then created from verified main and pushed with upstream tracking.

The existing protected David Lloyd hosted script passed the full wedding onboarding/matching journey, home-only access, additional access with exclusion, unpopulated club and refinement. An earlier run was interrupted and timed out; the completed rerun returned exit code zero.

Preserved publication pins:

- Third Space: `26af043937b05ccd08a433df21cd5ce1662ab278`.
- David Lloyd: `1fde0128730ee90ff3b4bce877e50de33fdb846a`.
- Approved wide David Lloyd 1600px hero SHA-256: `847663769b7df8186dc371c36b0cb5b08f4de5902adf68eb53d56e2a44585b27`.
- Approved wide David Lloyd 4K hero SHA-256: `ba684e9a36bfcd360c4d854275690e0a96967e7d8ab0e8e1f51d9c3dca768958`.

## Infrastructure preflight

Firebase and Google Cloud credentials were refreshed by the user. The existing project is `petey-dev-getcass`; `(default)` Firestore is STANDARD / FIRESTORE_NATIVE in `europe-west2`. The reviewed runtime identity remains `petey-web-onboarding-v2@petey-dev-getcass.iam.gserviceaccount.com`, with existing `roles/datastore.user` and secret-level `roles/secretmanager.secretAccessor` for `OPENAI_API_KEY`. No secret value was written into an environment file and no permissions were broadened.

## Gymbox verification and publication

The isolated consumer and dashboard builds are implemented with ten fictional trainers (five each at Bank and Farringdon), ten recognised clubs, nullable prices, deterministic access restrictions and sample enquiry-intent analytics. `npm run verify:gymbox` passed lint, typechecking, 39 UI/admin tests, 98 backend tests, both builds and asset/catalogue isolation checks. Real-model evaluations passed all 28 onboarding cases and 16 matching cases.

The final Petey regression passed 224 frontend tests / 3 skipped, 212 backend tests / 20 skipped and the additional 20- and 16-test Node suites. Third Space passed 30 UI tests, 71 backend tests and both builds. David Lloyd's standalone UI suite exposed a test-helper race: a synchronous change/click could precede the assistant-ui composer update. The test helpers now await realistic typing/clicks and reset queued API mocks; production David Lloyd code and its publication pin are unchanged. The corrected standalone verification returned exit code zero: 34 UI/admin tests, 80 backend tests and both builds passed.

Gymbox deployment succeeded. Both new Cloud Run services have service-specific `run.googleapis.com/invoker-iam-disabled=true`; App Check remains enforced. The first protected hosted run rejected missing App Check and completed wedding onboarding/matching, home-only access, additional access with an exclusion and an unpopulated-club result. It exposed a combined refinement parsing bug (`only Bank, and exclude Farringdon and Holborn`), which was corrected with three regression cases. The full protected acceptance rerun returned exit code zero: missing App Check rejected on both callables; authorised malformed input rejected followed by a valid journey; wedding onboarding/matching; home-only access; additional access and exclusions; unpopulated club; refinement; all-club access with a training preference; later restrictions; and honest empty results for online-only, clinical rehabilitation and under-18 requests.

Published routes: [Gymbox consumer demo](https://joinpetey.com/gymbox-demo/) and [Gymbox sample dashboard](https://joinpetey.com/gymbox-demo-admin/). Responsive/accessibility QA passed the recorded checks at 320, 375, 430, 768, 1024 and 1440px, with 200% browser zoom, visible focus, focus restoration, refinement/reset and 44px mobile dashboard controls. Reduced-motion source/test branches were verified; OS-level preference and screen-reader sessions were not performed. See [UI QA](./gymbox-ui-qa.md). Verified implementation and editable media source were committed and pushed at `77ebfb6cdda2697b49f1e1f9df0a706476ba1b55` on `gymbox-demo`.

The final deployment returned exit code zero. Ready revisions are `rungymboxonboardingturnv1-00004-gom` and `matchgymboxtrainersv1-00004-jer`, each serving 100% of traffic. See [backend deployment evidence](./gymbox-backend-release-2026-10-02.json). The protected-backend gate passed before frontend publication. The separate publication commit is `a33b9ddd7aed3deb17654b540f15da5f2ab10fe6` on main, prepared in the previously clean `petey-web-release` checkout. It adds the immutable source pin `.github/gymbox-demo.json`, the combined Pages checkout/install/verify/assembly steps, and the test-only composer timing fix. [Pages run 37074602206](https://github.com/zainansarii/petey-web/actions/runs/37074602206) completed successfully: build and deploy both passed, including clean pinned-source verification of all three branded demos. Main's publication changes were merged back into `gymbox-demo`; local main was aligned with origin/main. All seven public routes and their entrypoint JS/CSS assets returned successfully. Existing Petey, Third Space consumer/admin and David Lloyd consumer/admin HTML hashes and asset references remain identical to the verified pre-Gymbox gate. Both new routes have noindex. All 14 new public images (logo, three hero derivatives and ten portraits) match source SHA-256 bytes; both approved live David Lloyd hero exports also match their preserved source. See [live asset evidence](./gymbox-live-release-2026-10-02.json). The normal-App-Check browser journey passed on the public site with no fixture or debug token. Initial matching returned Emma, Grace and Daniel at Bank. Refinement to only Bank while excluding Farringdon and Holborn returned Emma, Daniel and Nathan at Bank, retaining unknown rates and prior preferences. Profile details, reset and focus behavior passed. The public dashboard loaded all portraits and passed all 30 club/period combinations; Emma's metrics matched the sample events. Both sites had no document overflow at 375/1440px and no captured console errors or warnings. Exact evidence and the minor same-club distance-copy observation are in [UI QA](./gymbox-ui-qa.md).

## Assets and pilot boundaries

The ten trainers and all analytics are fictional. Pricing is unknown, shown as “Rates on enquiry”. The independent Gymbox hero and its generation prompt are documented in [hero provenance](../demo-media/gymbox-hero/README.md). It is an imagined industrial gym, with a resampled 4K delivery export and responsive derivatives. It does not depict a verified Gymbox interior.

Official source evidence is in [Gymbox sources](./gymbox-sources.md). Real pilot ownership, enquiry consent, retention, funding and outcome measurement are separate decisions in [Gymbox pilot](./gymbox-pilot.md).

## Preview film

The completed delivery directory is `/Users/zainansari/dev/petey/gymbox-output-2026-10-02-181629/`. It contains `gymbox-preview.mp4`, `gymbox-preview.jpg`, the complete editable source, `qa/verification.json`, command statuses and scene/transition contact sheets. Maintainable source, poster and QA are versioned in [demo-media/gymbox-preview](../demo-media/gymbox-preview/README.md).

The pinned Hyperframes 0.8.70 render and postprocessing returned exit code zero. Verified: 52.0 seconds, 1920×1080, 30fps, exactly 1,560 frames, H.264/AAC, full decode passed, original music excerpt/mix preserved, no narration or additional effects. Hyperframes passed runtime, layout, motion and all 58 contrast checks. Six inherited nonblocking source-structure warnings are documented in the visual review. All scenes and five transition boundaries were inspected in encoded frames.

The actual completed dashboard supplied the film captures: 1,800 completed searches, 555 simulated enquiry intents, 30.8% conversion, 149 unmatched searches. Emma's detail shows 570 recommendations, 98 intents and 17.2% conversion. All are labelled sample data. Final source hashes and capture provenance are recorded with the film; the supplied reference was not modified.

## Repository handoff

The primary checkout remains `gymbox-demo`, tracking `origin/gymbox-demo`. Main's separate publication commit has been merged into it. Local main equals origin/main at `a33b9ddd7aed3deb17654b540f15da5f2ab10fe6`, and main is an ancestor of the Gymbox branch. The final live verification documentation is committed and pushed on the same branch; the handoff checks confirm a clean working tree and HEAD equal to origin/gymbox-demo.

Both preservation branches remain on origin: `codex/preserve-gymbox-plan-2026-10-02` (`75d888c14fcc0134007035b1d5209c415c3df3b7`) and `codex/preserve-core-petey-2026-09-29` (`3a5bff5561aa88b09d89ca9e9e86a6e33f48ae2b`). No stash was created or left. The existing release checkout is clean at the main publication commit; the existing synthetic checkout remains clean at `b38ffca52a7272df52a3a10b135120f4245cfab1`. No worktree was deleted, archived or replaced. The task's local consumer/admin development servers were stopped after QA.

The output directory intentionally retains `render-master.mp4` as the intermediate encoded render, alongside the delivered `gymbox-preview.mp4`; `tools/`, generated builds and QA frame caches are local regeneration aids. The maintainable source excludes these caches and MP4s, and includes the required local media, poster, scripts and reports.
