# Gymbox demo — implementation handoff

Prepared 2 October 2026. This is a plan, not an implementation or release record. Public facts and repository observations below must be refreshed when implementation starts.

## Objective and scope

Build the Gymbox equivalent of the completed David Lloyd demo, using its approved consumer experience, admin dashboard and video production source as the template.

Deliver:

1. A live consumer demo at `https://joinpetey.com/gymbox-demo/`.
2. A live sample-data dashboard at `https://joinpetey.com/gymbox-demo-admin/`.
3. A 52-second `gymbox-preview.mp4`, poster, editable source and validation report in a new `gymbox-output-<timestamp>/` directory.
4. Committed and pushed implementation, with the primary checkout on `gymbox-demo`, clean and aligned with its remote.

Position the proposal around member choice, better-qualified enquiries and visibility into demand. Bank is the lead pilot story; Farringdon provides a second populated club for demonstrating access and demand differences. The real pilot can subsequently launch at either club. Do not present additional PT bookings as verified Gymbox revenue.

This is a working matching demo with fictional trainers and illustrative analytics. Real trainer onboarding, contact capture, enquiry delivery, TEAMUP integration, payments and production analytics are separate pilot work. Do not contact Gymbox or submit its enquiry form as part of building the demo.

## 1. Reconcile David Lloyd before starting Gymbox

Work in `/Users/zainansari/dev/petey/petey-web`. Read `AGENTS.md`, applicable local instructions and `docs/design-consistency.md`. For design review, load `.design-rules/SKILL.md`, its lookup and the relevant guideline files. Use the relevant image/video/release skills when performing those tasks.

Observed starting state:

| Item | Observed value |
|---|---|
| Primary branch | `david-lloyd-demo`, clean |
| Primary HEAD and local remote-tracking ref | `feed65eb4a6ce7dac33396bd608b90efe6116598` |
| Local main and local remote-tracking ref | `bb58a6945756cc5301a954c0c5c217f7ebee61b1` |
| David Lloyd publication pin | `1fde0128730ee90ff3b4bce877e50de33fdb846a` |
| Third Space publication pin | `26af043937b05ccd08a433df21cd5ce1662ab278` |
| Preserved unrelated work | `codex/preserve-core-petey-2026-09-29`, `3a5bff5561aa88b09d89ca9e9e86a6e33f48ae2b` |

David Lloyd is published from an immutable source pin; its implementation is not yet on main. At these refs, main is an ancestor of the David Lloyd branch, which is 12 commits ahead. These are planning observations, not a substitute for fetching and checking the remote.

Implementation sequence:

1. Inspect status, branches, worktrees, stashes, upstreams and recent history; fetch. Preserve new local work on clearly named checkpoint branches before switching. Never reset away unrelated changes or leave an unexplained stash.
2. Verify the completed David Lloyd source with clean dependency installs and Petey, Third Space and David Lloyd verification. Include both admin builds. Capture command exit statuses.
3. Integrate the completed David Lloyd branch into main, using a fast-forward if ancestry still permits. Preserve the existing combined Pages workflow, onboarding recovery fix and both publication pins. Resolve changed ancestry from the actual diff rather than using these old SHAs blindly.
4. Ensure clean CI installs all required backend dependencies, including `functions-third-space` and `functions-david-lloyd`, before the corresponding checks. Retain serial Vitest execution where the release workflow already uses it.
5. Push main, wait for successful verification and Pages publication, then check Petey and both existing demo/admin pairs. Confirm their pinned source and approved assets remain unchanged.
6. Update local main, create `gymbox-demo` from that verified main, switch the primary checkout to it, push and configure `origin/gymbox-demo` tracking.

**Gate: no Gymbox application implementation starts before steps 1–5 pass.** Preserve the unrelated checkpoint branch. Preserve the currently approved wide David Lloyd homepage image; do not restore its discarded later variants.

## 2. Establish Gymbox facts and demo defaults

Record sources, retrieval dates, club aliases, coordinates and any unresolved facts in `docs/gymbox-sources.md`. Keep research notes out of the consumer UI.

The current directory has these ten club filters: Bank, Ealing, Elephant & Castle, Farringdon, Finsbury Park, Holborn, Old Street, Victoria, Westfield Shepherds Bush and Westfield Stratford. Recognise “Westfield London” as an alias of Shepherds Bush and normalise “Elephant and Castle”. Do not infer a trainer count from potentially duplicated directory cards. [Official directory](https://gymbox.com/personal-trainers/)

Gymbox offers single-gym and all-gyms access. Contract duration and access are separate choices. Do not infer access from annual, student or corporate membership names, price, or a promotional PT offer. [Memberships](https://gymbox.com/memberships/)

Its PTs are self-employed. Current terms restrict PT to members aged 18+ and describe the session agreement as being with the trainer. The demo may support exploration before joining, without implying booking eligibility. Do not assume guest passes or Wellhub establish that eligibility. [Terms, section 15](https://gymbox.com/terms-and-conditions/)

PT costs extra; booking can be through TEAMUP or directly with a trainer. The reviewed public pages do not establish a universal session rate or duration. Do not copy David Lloyd's £40/£42.50 assignments, membership dues or an assumed 60-minute session. [Booking FAQ](https://www.support.gymbox.com/support/solutions/articles/103000386102-how-do-i-book-a-personal-training-session-)

The enquiry page offers in-gym and online PT and provides for contact by a freelance trainer. Scope this demo to in-club matching; acknowledge an online request briefly without pretending the synthetic catalogue has verified online provision. Keep group classes and Out the Box separate from personal training. [Personal training and enquiry form](https://gymbox.com/personal-training/)

Verify club addresses and geocodes from current official pages. Initial pilot addresses: Bank, 71 Lombard Street, EC3V 9AY; Farringdon, 12A Leather Lane, EC1N 7SS. Do not retain south-west London distance fixtures. [Bank](https://gymbox.com/gyms/bank/), [Farringdon](https://gymbox.com/gyms/farringdon/)

Bank's published 2026 changes ended Boxing/Muay Thai classes and removed the ring/cage for hybrid space; boxing bags remain. Do not advertise a Bank ring, or conclude that all boxing-related PT is unavailable. Facility evidence must be club-specific. [Class change notice](https://www.support.gymbox.com/support/solutions/articles/103000406050-why-are-the-current-combat-classes-coming-to-an-end-), [equipment notice](https://www.support.gymbox.com/support/solutions/articles/103000406052-will-combat-equipment-will-still-be-available-)

## 3. Clone the approved experience into isolated Gymbox builds

Use the latest approved David Lloyd application source. Its older video snapshots are not the current UI source of truth. Preserve layouts, spacing, card structure, profile expansion, chat interactions, dashboard navigation and restrained copy.

| Template | New destination |
|---|---|
| `david-lloyd-demo/`, `david-lloyd-demo-admin/` | `gymbox-demo/`, `gymbox-demo-admin/` |
| `src/david-lloyd-demo/`, `src/david-lloyd-demo-admin/` | `src/gymbox-demo/`, `src/gymbox-demo-admin/` |
| `david-lloyd-shared/` | `gymbox-shared/` |
| `functions-david-lloyd/` | `functions-gymbox/` |
| `firebase.david-lloyd.json` | `firebase.gymbox.json` |
| Both David Lloyd Vite configs | Equivalent Gymbox consumer/admin configs |
| David Lloyd validation, evaluation and hosted-verification scripts | Equivalent Gymbox scripts |
| `demo-media/david-lloyd-preview/` | `demo-media/gymbox-preview/` |

Use `Gymbox*` types/components, `gb-demo-*` trainer IDs, a separate Firebase codebase/app/rate-limit namespace, `GYMBOX_SERVICE_ACCOUNT`, `dist-gymbox` and `dist-gymbox-admin`. Add the corresponding package scripts, TypeScript entries, lint settings, ignored outputs and CI installs. Development fixtures must remain development-only. Avoid unrelated refactors and importing another demo's runtime catalogue or brand assets.

Create `runGymboxOnboardingTurnV1` and `matchGymboxTrainersV1`, retaining the existing request/response pattern and shared approved model adapter. Do not silently migrate core Petey models during this work.

### Visual treatment

The inspected official homepage uses black, white and yellow, a boxed Gymbox mark and heavy display typography. Its hero heading computes to `#FFCD33` and `Gymbox, sans-serif`. Recheck current assets before implementation; obtain the real logo rather than recreating it as text. Use the official display font only if available for the intended use; otherwise use a suitable licensed substitute. Retain DM Sans for readable body/UI text. [Official homepage](https://gymbox.com/)

Apply those brand cues to the existing composition. Use yellow with dark text for primary actions and accessible focus states. No extra eyebrow headings, generic marketing sections, excessive capitalisation in body copy, or decorative dashboard clutter. Keep “Find your kind of trainer.” and the compact existing CTA unless a Gymbox-specific change is necessary.

Keep the ten monochrome portraits. For the homepage's right-hand image, create one separate Gymbox-appropriate 4K asset inspired by its industrial gym spaces, plus an optimised responsive web derivative. It must not be presented as a photograph of a verified actual Gymbox interior. Preserve the existing hero geometry and useful view of the gym. Record asset provenance and retain editable generation notes. Do not modify the David Lloyd image or resume its rejected revisions.

Do not reintroduce the three removed result disclaimers about prices/availability, membership confirmation and straight-line distances. Keep the small fictional-demo/sample-data identification already used by the demos. Explain an actual restriction only when it affects the user's result or next action.

## 4. Adapt the ten fictional trainers and pricing

Use these proposed sample assignments consistently across catalogue, matching, admin, fixtures and film. They are demo decisions, not claims about actual Gymbox trainers.

| Trainer | Club | Profile emphasis |
|---|---|---|
| Emma Carter | Bank | Patient strength coaching, beginners and confidence |
| Daniel Reed | Bank | Strength, hypertrophy and athletic conditioning; remove the David Lloyd racquet emphasis |
| Amira Hassan | Bank | Strength, mobility and pre/postnatal coaching |
| Nathan Cole | Bank | Strength, body composition and practical nutrition habits |
| Grace Ellis | Bank | Beginner strength, confidence and pre/postnatal coaching |
| Lucas Bennett | Farringdon | Running, hybrid conditioning and event preparation |
| Sophie Morgan | Farringdon | Older-adult strength, balance and mobility; preserve her calm personality |
| Isabel Ross | Farringdon | Running, endurance and mobility |
| Adam Khan | Farringdon | Boxing conditioning, strength and beginner confidence |
| Theo Parker | Farringdon | Strength, Olympic lifting and hybrid performance |

Preserve established personalities and relevant fictional qualifications. Do not copy real biographies, contact details or identities. Public examples support the general variety: [Laura Martin](https://gymbox.com/personal-trainer/laura-martin/) and [Ronni McKay](https://gymbox.com/personal-trainer/ronni-mckay/) at Bank; [Julia Jasinska](https://gymbox.com/personal-trainer/julia-jasinska/) and [Pete Chlopek](https://gymbox.com/personal-trainer/pete-chlopek/) at Farringdon. Do not convert general mobility experience into clinical rehabilitation credentials.

Recognise all ten clubs, but populate only Bank and Farringdon. Other clubs must produce a clear “no demo trainers at this club” state, not an implication that Gymbox has no trainers there.

Retain the price pill beside location and the profile price field. Default to **“Rates on enquiry”**, using nullable price data rather than zero. Preserve free-form per-session budget, “Not sure yet” and “Flexible”. Unknown rates must not become invented prices, affordability claims or budget-based exclusions. If the user later supplies verified Gymbox prices, record their provenance and session/package basis before assigning clearly fictional demo rates; keep cards, profiles, matching logic and film consistent.

## 5. Adapt onboarding and matching rules

Keep the assistant brief and natural: one useful question at a time, no repeated information requests. Capture goals, useful coaching preferences, practical restrictions and per-session budget. Accept free-form answers and clarify only ambiguity that changes matching.

Implement access deterministically before model ranking:

- Single-club membership: match within the confirmed home club.
- Explicit all-clubs access: allow the verified club registry, still respecting the user's preferred area and exclusions.
- Explicit additional club access: add those confirmed clubs to the home club. “I can also use Farringdon” must not remove Bank; “I only want Farringdon” is a separate training restriction.
- Unknown access: ask one concise clarification; do not infer access from package names. If it remains unresolved, use only a confirmed home club, or return an honest empty result when none is known.
- Non-member: ask for one training area; do not repeat home/work location questions. Results are exploratory.
- A later explicit restricted access list replaces an earlier all-clubs statement. A club exclusion wins over home-club defaults, proximity, all-club access and model suggestions.

Retain hard restrictions during refinement. Use the trainer's actual synthetic specialisms and personality to explain fit. Do not force three matches if fewer are eligible. Never fabricate availability, capacity, response times, clinical suitability or facilities. A request unsupported by the sample, including a specific rehabilitation requirement, needs a concise honest response rather than a weak match disguised as expertise. If an under-18 requirement is volunteered, respect the current PT restriction without collecting a date of birth or adding an unnecessary age interrogation to every demo conversation.

Update contracts, schemas, prompts, geographic data, evaluator cases, fixtures, validators and hosted scripts together. Remove David Lloyd-specific club names, membership assumptions, racquet/swimming lesson logic and price assumptions from Gymbox runtime paths.

Preserve App Check enforcement, bounded input/output, known unique trainer IDs, evidence-grounded reasons, timeout budgets, at most two transient retries, visible recovery and full reset. Use a separate Gymbox rate-limit prefix; preserve the existing 120-turn/24-match hourly limits unless verified current configuration differs. Keep transcript, brief and matching results out of persistent storage and raw logs. Infrastructure counters must not contain conversation text.

## 6. Adapt the dashboard to a freelance-PT pilot

Retain existing filters, charts, trainer rankings, demand analysis and drill-downs. Use the same ten IDs, names, clubs, specialisms and portraits everywhere. Regenerate deterministic sample events; derive totals and conversion rates from those events rather than hand-editing headline numbers.

The existing data model represents completed matching searches, not started or abandoned conversations. Keep the demo funnel to completed searches → simulated enquiry intent. Conversion is searches with enquiry intent divided by completed searches in the selected period/filter. Count unique searches consistently rather than dividing individual trainer clicks by searches. Update metric labels, tooltips and sample-event descriptions together; do not claim delivery or bookings. Do not label PTs as Gymbox employees or report invented Gymbox revenue.

The current template has no capacity, boost or matching-priority controls; adding them is outside this adaptation. Show zero synthetic trainer coverage for the other eight clubs. Check every period/club filter and Emma's drill-down against the same event source.

Document the real pilot decisions separately in `docs/gymbox-pilot.md`: who owns the enquiry process, which opted-in trainers receive requests, who funds Petey, what a qualified enquiry means, how consent and retention work, and how downstream outcomes will be returned. Propose measuring completion rate, enquiries per completed conversation, trainer acceptance and time to first response; bookings require verified downstream data. These decisions do not block publishing a clearly synthetic demonstration.

## 7. Verify and release backend before frontend

Use the established Firebase project and region only after checking current configuration: `petey-dev-getcass`, `europe-west2`, Node 22. Deploy only the new Gymbox codebase. Configure `GYMBOX_SERVICE_ACCOUNT` in `functions-gymbox/.env.petey-dev-getcass`; after verification, reuse the reviewed runtime identity `petey-web-onboarding-v2@petey-dev-getcass.iam.gserviceaccount.com`. Confirm its required secret/Firestore permissions and bind the existing `OPENAI_API_KEY` secret. Do not copy secret values into environment files or broaden project permissions.

1. Add and run `verify:gymbox`, plus real-model onboarding/matching evaluations with synthetic inputs. Run Petey, Third Space and David Lloyd regression checks. Use `VITEST_MAX_WORKERS=1 npm run verify` where needed for stable existing suites.
2. Verify no cross-demo namespace, callable, catalogue or asset leakage; no production fixture fallback; correct base paths/noindex; ten unique portraits and coherent admin data.
3. Deploy the two Gymbox callables. Check a ready revision and intended 100% traffic for each; a successful upload alone is insufficient.
4. Follow the current service-specific transport/App Check setup in `functions-david-lloyd/README.md`, replacing both service names with the Gymbox equivalents in every command. Inspect existing IAM constraints rather than changing project-wide policy or weakening protections. Validate rejection without App Check and a full authorised hosted onboarding-to-matching journey, refinement and recovery.
5. Commit and push the tested source. Add `.github/gymbox-demo.json` with its immutable full SHA. Extend the combined `.github/workflows/deploy-pages.yml` to check out `.gymbox-source`, install its dependencies, verify and assemble both new builds alongside existing outputs. Keep both existing demo pins fixed.
6. Publish the workflow/manifest change through main using an available clean checkout; account for its changes separately from the Gymbox source commit. Wait for successful Pages deployment and test the actual new URLs with real callables. HTTP 200 alone is not acceptance.

Do not publish the frontend as working if hosted backend acceptance fails. Continue independent local work and report the exact deployment blocker without claiming a live result. Keep credentials out of code, prompts, screenshots and reports.

## 8. Produce the matching preview film

Use `/Users/zainansari/Documents/Documents/petey-preview.mp4` as the choreography reference and `demo-media/david-lloyd-preview/` as the editable Hyperframes template. Do not modify the original reference or silently substitute a different similarly named video.

Preserve **52 seconds, 1920×1080, 30fps and exactly 1,560 frames**, the existing music segment and mix, and no voiceover or extra sound effects.

| Time | Gymbox scene |
|---|---|
| 0–5.75s | Synthetic directory pan; “Find your kind of trainer.” |
| 5.75–19.5s | Existing wedding-confidence conversation structure |
| 19.5–28.25s | Three eligible matches; Emma selected; reasons expand |
| 28.25–38.25s | Actual completed Gymbox dashboard overview and member demand |
| 38.25–48.25s | Trainer rankings and Emma's details |
| 48.25–52s | Gymbox × Petey lockup |

Keep the wedding motivation and dialogue sequence, changing only brand, club, access and pricing details needed for accuracy. For geographic coherence, the person may still live in Earlsfield but should volunteer that they train near Bank and have Bank access; do not suggest Bank is their nearest club. Keep Emma and the other displayed matches eligible for that story. Do not add a redundant location question or squeeze extra dialogue into the fixed runtime.

Rebuild dashboard captures from final Gymbox components and data. Do not merely recolour old David Lloyd screenshots. Update all hardcoded names, clubs, prices, source manifests and QA report fields in the film tooling. Retain the pinned Hyperframes toolchain unless a change is required.

Deliver `gymbox-preview.mp4`, `gymbox-preview.jpg`, complete editable source and regeneration instructions in the new output directory; also keep the maintainable source under `demo-media/gymbox-preview/`. Validate readable text, every transition, no clipped UI, audio continuity, full decoding, duration, resolution and exact frame count. Capture exit statuses and a contact sheet.

## 9. Acceptance and repository handoff

Required functional cases: single-club access; explicit all-clubs/additional access; exclusions; unknown access; non-member single area; unpopulated clubs; unsupported needs/online requests; unknown/flexible/numeric budgets; fewer than three eligible trainers; refinement preserving restrictions; transient errors; retry; reset and stale response handling.

Check consumer and admin at 320–430px phones, narrow/wide tablets and desktop. Verify no overflow, readable price pills, keyboard-only operation, visible focus, sensible focus restoration, reduced motion, 200% text zoom, adequate targets and contrast. Use 4.5:1 for normal text and 3:1 for large text and meaningful non-text UI. Never hide essential content to pass a screenshot check.

Verify both new live routes and a real hosted journey, plus Petey and both existing branded demo/admin pairs. Record source SHA, release SHA, backend revisions/traffic, test results, live checks and video artifact paths separately in `docs/gymbox-demo.md`.

Commit and push all implementation work. Merge the main publication changes back into `gymbox-demo`, then push it. Finish with:

- Primary checkout on `gymbox-demo`, clean.
- Local HEAD equal to `origin/gymbox-demo`.
- Local main equal to `origin/main`, and main an ancestor of `gymbox-demo`.
- Existing Third Space and David Lloyd pins and approved assets preserved.
- Every stash/checkpoint/worktree accounted for; unrelated preserved work retained.
- No local-only implementation changes, forgotten generated alternatives or unverified claims of deployment.

The final report must distinguish what is built, tested, committed, pushed, deployed and verified live, and link the consumer demo, dashboard, video, poster, source and verification record.
