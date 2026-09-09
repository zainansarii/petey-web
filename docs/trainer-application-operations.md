# Trainer applications: setup and operations

The web intake is independent of mobile trainer onboarding. Google Form answers
become private `webTrainerApplications` records. A reviewer edits a draft,
records external qualification/insurance checks and publishes an approved
snapshot into `webTrainerCatalog`. Trainer accounts and automated applicant
emails are not created by this flow.

The reviewer workspace is `/petey-web/admin/` on GitHub Pages, with hash routes
for application details. Pending revisions never replace the published snapshot
until a reviewer approves them. Suspension and expired verification exclude a
trainer from matching; restoring eligibility requires a new approval.

## Environment setup

Use the existing `(default)` Firestore database in each project. Development
was verified as **Standard edition, Firestore Native, europe-west2** during
implementation. Check production separately before deployment; do not create a
new database or change its edition for this feature.

| Setting | Development | Production |
| --- | --- | --- |
| Firebase project | `petey-dev-getcass` | `petey-prod-getcass` |
| Form | A separate copy of the application form | Existing form below |
| Function region | `europe-west2` | `europe-west2` |
| Secret | Separate random secret | Separate random secret |
| Reviewer access | Explicit dev grant | Separate explicit prod grant |

The existing production form editor is
[Petey trainer application](https://docs.google.com/forms/d/1VEZsYWQxBvkkmWzsVTluH0ous1Y1SRDlCeMc_tY7SB8/edit).
Keep its published responder URL unchanged. Each environment's frontend sets
`VITE_TRAINER_APPLICATION_URL` to that environment's **responder** URL.

1. Verify Firebase CLI access and the database with an explicit `--project`:

   ```sh
   npx -y firebase-tools@latest firestore:databases:list --project petey-dev-getcass
   npx -y firebase-tools@latest firestore:databases:get '(default)' --project petey-dev-getcass
   ```

2. Set the backend parameters in `functions/.env.<project-id>`:

   ```dotenv
   WEB_TRAINER_FORM_ID=<that-environment-form-editor-id>
   WEB_TRAINER_IMPORT_ENABLED=false
   WEB_TRAINER_CATALOG_ENABLED=false
   ```

   The existing `WEB_ONBOARDING_SERVICE_ACCOUNT_V3` remains the function runtime
   identity. It needs the existing private Firestore/Storage access and signed-URL
   signing permission. Restrict the importer to the configured form ID.

3. Generate at least 32 random bytes for `WEB_TRAINER_FORM_SECRET` and add it to
   Firebase Secret Manager with `firebase functions:secrets:set
   WEB_TRAINER_FORM_SECRET --project <project-id>`. Enter the secret through the
   protected prompt; do not commit or log it. The same value goes in that form's
   script property `PETEY_IMPORT_SECRET`.

4. Deploy the functions, indexes and private Firestore/Storage rules. Deploy the
   admin page with Google sign-in and App Check configured for its actual host.
   Do not use an App Check debug token in a public build. Verify index creation
   has completed before querying the application inbox.

5. Configure the form script as below, establish a reviewer and perform the
   development acceptance run before enabling production ingestion/catalogue.
   An Apps Script trigger runs as its installing Google account; that account
   must retain access to the form and uploaded photos.

## Install the form-bound bridge

Open the target form's **More → Script editor**. Copy
`apps-script/trainer-applications/Code.gs` into its bound Apps Script project.
Enable **Show appsscript.json manifest file in editor** in Project Settings and
use the supplied `appsscript.json`. The script is not deployed as a web app.

Set these **Script Properties** in Project Settings:

| Property | Value |
| --- | --- |
| `PETEY_FORM_ID` | The bound form's editor ID, not its responder ID |
| `PETEY_FUNCTION_BASE_URL` | `https://europe-west2-petey-dev-getcass.cloudfunctions.net` or the production equivalent |
| `PETEY_IMPORT_SECRET` | Same secret value as `WEB_TRAINER_FORM_SECRET` |
| `PETEY_BRIDGE_ENABLED` | `false` during setup; `true` when ready to import |

Keep the profile photo question limited to one image of at most 10 MB. Its help
text should say **“Upload one JPEG, PNG or WebP image, up to 10 MB.”** Verification
documents remain outside the form. The bridge and backend reject unsupported
files even if Google Forms' image picker accepts them.

Turn **Settings → Responses → Limit to 1 response** off in both environments.
Google Forms may prevent replacing an uploaded photo through the response-edit
page, so applicants need to be able to submit a replacement application when a
photo cannot be used. The original application is retained for manual review;
duplicate-email warnings help connect the two records. The script does not change
this setting automatically. Its official read method is
[`Form.hasLimitOneResponsePerUser()`](https://developers.google.com/apps-script/reference/forms/form#hasLimitOneResponsePerUser()).

Run `setupPeteyTrainerBridge` manually and authorise the requested form, Drive
read, external request and trigger permissions. Setup requires exactly the 21
profile questions listed in `PETEY_FIELDS`, each with a unique matching title
and expected type. It seeds `PETEY_MAPPING_V1` with stable question IDs and then
validates those IDs on every run. Reordering questions or sections is safe.
Renaming, recreating or adding questions causes a visible sync failure instead
of silently interpreting the wrong answer.

Setup installs a form-submit trigger and a 15-minute reconciliation trigger,
replacing only previous triggers owned by this bridge. Run setup as the intended
long-lived form owner; triggers installed by a different account are not visible
to this account, so remove that account's old bridge triggers when transferring
ownership. Only one bridge installation should send observations for a form.

Set `WEB_TRAINER_IMPORT_ENABLED=true`, deploy that parameter change, then set
`PETEY_BRIDGE_ENABLED=true`. Run `reconcilePeteyTrainerApplications` once manually
and check sync health in the admin inbox. Existing form responses are imported
as private applications, with no automatic publication.

### Mapping changes

Never delete `PETEY_MAPPING_V1` simply to bypass a mapping error. Disable the
bridge, compare the affected form items with `PETEY_FIELDS`, and fix an accidental
form change or make a reviewed mapping/schema update in code. For an intentional
replacement question in the same schema, explicitly change only its stored
`itemId` after checking its exact title/type and historical responses. Do not
map an old question to a different semantic field. A copied development form
gets a new bound script and freshly seeded mapping; never copy production
acknowledgements or IDs into it.

### Delivery and recovery

The script uses a script-wide lock and re-reads each canonical response before
sending it. It signs the request body, timestamp, endpoint kind and photo
identity with HMAC-SHA256. Metadata and image bytes are separate requests; no
Firestore credential is stored in the script.

Reconciliation rotates through all responses rather than relying on submission
timestamps, so edited answers are detected even if a timestamp stays unchanged.
Each run stops before its runtime budget and the next run continues the same
sweep, preserving its accumulated error count. A successful individual submission
does not clear failures elsewhere; only a completed clean reconciliation sweep
advances the last-successful-sync time.
It retries network failures and incomplete photo transfers with bounded backoff.
Sync health measures successful export, not whether every application is ready
for approval. When the backend acknowledges a missing, oversized or unsupported
photo as an application validation issue and requests no binary transfer, the
bridge marks that export complete. The private application's issue remains
visible and blocks approval; it does not keep global sync health failing forever.
Canonical answers and Drive metadata are still read on subsequent sweeps, so a
changed source is imported again. Drive access failures, failed HTTP transfers
and backend image-processing failures continue to retry and report unhealthy
sync status rather than being hidden as validation acknowledgements.
An unsupported or missing image remains an actionable private application and
never becomes approvable. The applicant can correct editable answers through
their private response-edit link and let the next scan import a revision.

The live development form does not allow respondents to replace or remove a
file after submission: its response-edit page shows the existing upload as
read-only. Do not promise that the edit link can replace a photo. A transient
photo-transfer failure retries the existing file. If the file itself is missing,
unsupported or unsuitable, request a new form submission with a valid JPEG,
PNG or WebP photo under 10 MB, then manually reject the earlier application with
a reason explaining that it was replaced. The new response receives its own application ID; duplicate-email
warnings support review, and the records are never automatically merged.
Do not import a synthetic application into production for testing.

`PETEY_ACK_*` properties contain hashes, acknowledgement time and retry state
only. They contain no answer values, contact details, response-edit links or
photo data. The cache is bounded to 1,000 entries, preferentially evicting old
successful acknowledgements. Evicted responses are safely re-read and deduplicated
by the backend on their next sweep. Corrupt or old-version cache/sweep state also
causes a canonical re-read, without deleting applications. Do not print all
Script Properties: the configuration includes the shared secret. Acknowledgements
can be removed to force a re-scan; the backend deduplicates by form/response ID
and content. Disable the bridge before manually clearing its cache or
`PETEY_SCAN_STATE`, and preserve `PETEY_MAPPING_V1` and configuration. At larger
volumes, monitor Apps Script property/runtime/Drive quotas and
move reconciliation state server-side before those limits become operational
constraints. This full-scan bridge is intentionally a low-volume v1 intake.

The inbox shows the last successful sync and recent failures. An incomplete
scan is not reported as successful; its cursor continues on the next run.
Inspect Apps Script **Executions** when sync becomes stale, checking account
access, quotas, mapping errors, secret alignment and endpoint configuration.
The script reports fixed error codes rather than logging raw Google responses
or application content. A failed sync notification can itself leave health
stale, so monitor age as well as reported failure counts.

## Grant or revoke reviewer access

Use an individually assigned Google account, verified in Firebase Auth, protected
by a passkey/security key and the agreed MFA policy. Do not grant access to the
shared `hello@getcass.com` account merely because it owns the form. Firebase's
Google provider does not attest to the upstream Google account's MFA policy;
the operator must check and record that policy before using the CLI attestations.
Admin calls enforce Google sign-in, verified email, App Check, the dedicated
claim, active allowlist and an authentication age under one hour.

The reviewer first signs in on the admin page to create their Firebase Auth user
(this alone grants no review permissions). Obtain its UID from that project's
Firebase Authentication console. The management CLI uses Application Default
Credentials with Firebase Auth and Firestore administration rights; a Firebase
CLI login alone does not necessarily provide those credentials. Use the existing
approved operator credential mechanism rather than checking service-account
keys into the repository.

Run the CLI from `petey-web`; it is read-only unless `--apply` is supplied:

```sh
node functions/scripts/manage-web-trainer-reviewer.mjs grant \
  --project petey-dev-getcass --uid REVIEWER_UID --email reviewer@example.com \
  --actor operator@example.com --reason 'Initial trainer reviewer' \
  --mfa-confirmed --individual-account-confirmed
```

Review the dry-run result, then repeat the exact command with `--apply`. The CLI
preserves unrelated claims and adds only `webTrainerReviewer: true`, with an
active `webTrainerReviewers/{uid}` registry entry and a
`webTrainerReviewerAudit` record. It never sets mobile's broad `admin` claim.
The reviewer signs in again after a grant so the new claim is present.

```sh
node functions/scripts/manage-web-trainer-reviewer.mjs revoke \
  --project petey-dev-getcass --uid REVIEWER_UID --email reviewer@example.com \
  --actor operator@example.com --reason 'Reviewer access removed' --apply
```

Revocation disables the server allowlist before removing the claim and revoking
refresh tokens. Partial failures leave access disabled and a failure audit;
resolve the operator credential/API issue and repeat the command. Grants use
the same fail-closed ordering and activate only after the Auth steps finish.

## Daily review

Open `/petey-web/admin/`, sign in and open a pending application. Original answers
remain unchanged; edits affect only the review draft and are recorded in history.
Use the public-profile preview to check bio, coaching style, coverage, price and
session duration. Resolve the flags raised for ambiguous or missing values.
Confirm any package price explicitly; do not infer a ten-session package or
monthly coaching price from a single-session rate.

Record accepted qualification and current insurance, their verification dates,
the insurance expiry and a short reference to checks carried out separately.
Keep documents in the separate verification process, not this application.
Confirm the actual future start date when the trainer selected that option.

**Approve & publish** validates the reviewed version and makes the snapshot
eligible according to availability and verification. **Needs changes**, **Reject**
and **Suspend** require a reason. They save a decision only; contact the applicant
manually if needed. The private response-edit link is for the applicant; it is a
capability link and must not be pasted into public profile text or shared with
another applicant. It can correct ordinary answers but cannot replace a
submitted photo in the current Google Form. Duplicate email warnings are for
investigation, not automatic
merging or account assignment.

## Acceptance and rollback

Run the normal web verification, affected Firestore/Storage emulator tests, and:

```sh
node --test apps-script/trainer-applications/Code.test.mjs
node --test functions/scripts/manage-web-trainer-reviewer.test.mjs
```

In development, submit the copied form, confirm exactly one private application,
record external checks and publish it. Verify photo display and practical profile
details in matching. Edit the form response and confirm the approved snapshot
persists until reapproval. Exercise a failed photo, duplicate delivery, two
reviewer tabs making conflicting edits, needs-changes, suspension and insurance
expiry. Confirm non-reviewers cannot call the admin APIs or read private data.

Repeat environment validation for production, keeping separate secrets and
reviewer grants. Enable `WEB_TRAINER_CATALOG_ENABLED=true` only when production
approvals should feed matching. Rebuild the website with the production form URL
and confirm the trainer CTA opens that form.

For rollback, set `PETEY_BRIDGE_ENABLED=false`, set backend
`WEB_TRAINER_IMPORT_ENABLED=false` and `WEB_TRAINER_CATALOG_ENABLED=false`, and
redeploy the backend parameter changes. Existing applications, approved
snapshots and history remain stored. The form can continue collecting responses;
reconciliation catches up after ingestion is restored. Disabling this catalogue
flag does not alter existing mobile-backed trainers.

Primary references: [installable triggers](https://developers.google.com/apps-script/guides/triggers/installable),
[form responses](https://developers.google.com/apps-script/reference/forms/form-response),
[URL Fetch](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app),
[HMAC and digest utilities](https://developers.google.com/apps-script/reference/utilities/utilities),
[Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas),
[Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).

## Development infrastructure verified on 7 September 2026

The following changes were applied only to `petey-dev-getcass`. They do not
activate form ingestion, publish any trainer, grant reviewer access or alter
production infrastructure.

- Runtime identity: `petey-web-onboarding-v2@petey-dev-getcass.iam.gserviceaccount.com`.
  Existing `roles/datastore.user`, `roles/aiplatform.user`, bucket object-viewer
  access and self `roles/iam.serviceAccountTokenCreator` were retained. Added
  `roles/storage.objectCreator` on the existing bucket with the condition
  `resource.name.startsWith('projects/_/buckets/petey-dev-getcass.firebasestorage.app/objects/web-trainer-applications/')`.
  This grants creation only under the intake photo prefix, without overwrite or
  deletion permission. Bucket location is `EUROPE-WEST2`, with uniform access.
- Storage deny rules were deployed at `2026-09-07T21:32:10Z`, ruleset
  `e240fb7d-e9f5-4ec2-abb4-84f12f5e7430`. The prior live rules exactly matched the
  unmodified repository version; the only addition was the private intake prefix.
- Firestore deny rules were deployed at `2026-09-07T21:33:44Z`, ruleset
  `80e7beb1-e771-4806-ae0c-5e0143b02412`. The live source differed from repository
  HEAD only in the account-role comment on line 10. Deployment preserved that
  live source and inserted the five recursive deny matches, with no removals or
  unrelated rewrites. Both deployed releases were read back and matched their
  intended inputs.
- Created the `webTrainerApplications` index on `status ASC, updatedAt DESC`
  (ID `CICAgJiH2JAK`) and `webTrainerCatalog` index on
  `published ASC, verificationExpiresOn ASC` (ID `CICAgNjaxJEK`). Both indexes
  were read back as `READY` after creation.
- Disabled indexing only for `webTrainerApplications.source`, `.draft`,
  `.verification`, `webTrainerCatalog.profile`, and `revisions.source`.
  Readback confirmed all five exemptions and all 11 existing live TTL fields
  were preserved. The live environment has older web-onboarding TTL overrides
  absent from the central mobile index file: do not force an entire-index
  replacement that removes those unrelated settings.
- Secret Manager, Cloud Scheduler, IAM Credentials and Firebase App Check APIs
  were already enabled.

### Remaining host and identity setup

Google sign-in is now enabled in development. A Google-only temporary Firebase
CLI configuration set the public display name to `Petey` and support email to
`hello@getcass.com`; `npx -y firebase-tools@latest deploy --only auth` completed
successfully. Live `google.com` provider readback returned `enabled: true` with
a configured client ID. Existing email, phone and anonymous provider settings,
MFA configuration and authorised domains were compared before/after and were
unchanged. The existing Firebase authorised domains include `zainansarii.github.io`,
`petey-dev-getcass.firebaseapp.com`, `petey-dev-getcass.web.app` and
`petey-auth.getcass.com`; `localhost` is absent. If using localhost for an actual
Google-authenticated dev acceptance run, authorise it in development only.

The development web app has a registered reCAPTCHA Enterprise App Check
configuration with a one-hour token lifetime. Its key allows only
`zainansarii.github.io`; it does not allow every domain. A local acceptance run
needs the approved development debug-token setup (never ship that token) or a
separately authorised development host. No App Check settings or reviewer
permissions were changed by this infrastructure rollout. An individually
assigned reviewer and the documented Google-account MFA policy still need to
be established before granting access.

The currently deployed Pages bundle at
`https://zainansarii.github.io/petey-web/` points to **development** Firebase. At
inspection, `/petey-web/admin/` returned 404 and the live bundle did not yet
include the trainer form link. Publish the new admin build with the matching
environment's Firebase/App Check configuration and `VITE_TRAINER_APPLICATION_URL`.
Verify the Pages environment explicitly before a production cutover; the
existing public site must not be assumed to use production Firebase.

### HTTP endpoint deployment with domain-restricted sharing

The first development deployment created the functions but its eight HTTP
invoker-policy updates failed: Cloud Audit Logs reported that proposed policy
members were outside the permitted customer. The existing working web callable
`getWebClientProfileV3` has no `allUsers` IAM binding; it uses
`run.googleapis.com/invoker-iam-disabled: "true"` and application-level
Firebase/App Check authorisation instead.

The effective `constraints/run.managed.requireInvokerIam` policy was read
through Cloud Resource Manager and was not enforced (`booleanPolicy: {}`).
The effective domain restriction continued to allow only the existing
organisation/customer identities. No organisation policy or API-enable setting
was changed. The deployed intake source was fetched and hash-compared with the
tested source before applying the existing endpoint pattern.

Applied `gcloud run services update SERVICE --no-invoker-iam-check
--region=europe-west2 --project=petey-dev-getcass` only to:

- `importwebtrainerapplicationv1`
- `uploadwebtrainerapplicationphotov1`
- `recordwebtrainerformsyncv1`
- `getwebtrainerreviewaccessv1`
- `listwebtrainerapplicationsv1`
- `getwebtrainerapplicationv1`
- `savewebtrainerapplicationv1`
- `reviewwebtrainerapplicationv1`

All eight services were read back as ready with that setting. Unsigned requests
to the three intake endpoints reached the application and returned **503,
“Form import is disabled.”** Requests without Firebase authentication/App Check
to the five reviewer APIs returned **401, `UNAUTHENTICATED`**. The tested source
retains HMAC verification for enabled intake and Google identity, recent sign-in,
reviewer claim, active allowlist and App Check for admin access. The scheduled
verification-expiry function was not changed by this service setting.

Recheck the setting and these denial responses after future Functions deploys.
Do not weaken organisation policies or add an `allUsers` role to work around a
deployment error. If the organisation later enforces the invoker requirement,
stop and have the platform owner review the endpoint architecture.
See [Cloud Run public endpoint configuration](https://docs.cloud.google.com/run/docs/authenticating/public).

### Development intake activation

After the development form mapping and its two installable triggers were
verified, `WEB_TRAINER_IMPORT_ENABLED` was set to `true` only in
`functions/.env.petey-dev-getcass`. `WEB_TRAINER_CATALOG_ENABLED` remains `false`.
A targeted, codebase-qualified deployment updated only
`importWebTrainerApplicationV1`, `uploadWebTrainerApplicationPhotoV1` and
`recordWebTrainerFormSyncV1` in `petey-dev-getcass`.

All three services were read back as ready with import enabled, catalogue
inclusion disabled and the existing invoker-IAM-disabled annotation preserved.
Unsigned JSON requests now return **403, “Invalid form signature.”** from each
endpoint. Before the development acceptance submission, private applications
and catalogue records both had a count of zero, with no form-sync record yet.
No production settings or catalogue publication were changed.

The live development form submission `Petey Intake QA 2026-09-07` then created
exactly one private application and one immutable source revision. It remained
`pending_review` with no processing issues and no published version. The
submitted £65.50 mapped to `6550` pence, session duration to `60` minutes, and
the five-session package stayed in pricing notes with ten-pack and monthly
prices both `null`. The test applicant is not accepting clients.

Its PNG photo reached `ready` as one immutable `image/webp` object (2,294 bytes)
with `private, max-age=300` cache control and no custom/download-token metadata.
Unauthenticated direct reads of the application document and private photo both
returned `403`. The catalogue record count stayed at zero. This verifies actual Google Form,
installable submission trigger, signed metadata import and private photo
transfer; reviewer approval and publication remain a separate acceptance step.

A manual reconciliation completed with `errorCount: 0` and
`lastSuccessfulSyncAt: 2026-09-07T22:01:54.238Z`. It left the application count,
source revision and draft version unchanged. Editing the same response's price
to £66.25 then produced source revision 2 and draft version 3 on the same
application, with `6625` pence and two immutable revisions. Revision 1 retained
its original content hash. The unchanged photo was reused, leaving one Storage
object. The application remained pending and unpublished.

After the submitted-photo limitation was confirmed, the photo error guidance
was corrected and the affected 20 domain tests plus eight Firestore/Storage
integration tests passed. Only the three development intake functions were
redeployed. Readback again confirmed import enabled, catalogue inclusion
disabled, the invoker setting preserved, and unsigned requests rejected with
`403` by all three endpoints.

The second live development submission,
`Petey Intake QA Unsupported Photo 2026-09-07`, used a GIF accepted by Google
Forms but unsupported by this intake. It created a separate `pending_review`
application at source revision 1 and draft version 1, with `photo.state: error`,
no photo path and the actionable JPEG/PNG/WebP replacement-application message.
There were no Storage objects under this application's prefix. Its published
version remained `null` and it was not accepting clients.

Live readback confirmed two private applications and zero catalogue records.
The synthetic duplicate-email query returned two separate applications without
merging them. The first application remained at source revision 2, draft version
3 and `6625` pence, with no issues and its original single ready WebP object.
After installing the bridge's version-2 acknowledgement behavior and reconciling,
`lastAttemptAt` and `lastSuccessfulSyncAt` were both
`2026-09-07T22:14:55.078Z`, with `errorCount: 0` and no sync message. The second
application's photo validation error remained visible: successful export does
not imply approval readiness. Both QA applications were retained for review.

## Development handover on 9 September 2026

Web implementation commit `10c39a1` was pushed to `main`. GitHub Pages
[run 34391669883](https://github.com/zainansarii/petey-web/actions/runs/34391669883)
completed successfully and the
[reviewer workspace](https://zainansarii.github.io/petey-web/admin/) returned HTTP
200. The deployed host still targets `petey-dev-getcass`; its Firebase and App
Check settings were preserved. `VITE_TRAINER_APPLICATION_URL` remains unset on
this public host until cutover, so the trainer CTA is disabled. Local development
uses the separate development responder URL. The original production form and
production Firebase configuration have not been changed.

The final verification passed lint, types, both builds, 79 frontend tests,
188 Functions tests, 20 Node script tests and 16 Apps Script tests. The eight
emulator-only Functions cases are intentionally skipped in the normal suite;
they passed in the dedicated Firestore/Storage integration run. The 24 affected
central rules tests also passed in emulators. Desktop (1440 px), mobile (390 px),
keyboard and refreshed bookmarked admin URLs were checked. Unauthenticated
bookmarks show sign-in without application content. Local fixture checks covered
draft corrections, verification, approval, failed-photo blocking and suspension.

The six central rules, rules tests and mobile review-guide changes were committed
locally in `mobile-app` as `7945e0d`; this commit has not been pushed. Other mobile
worktree changes were preserved. The development deny rules and required indexes
had already been deployed and checked as described above.

Apps Script's latest 50 visible executions on 9 September were all completed
15-minute reconciliation runs; the latest inspected run started at 19:40:48
Europe/London and took 9.97 seconds. This confirms the schedule is running. A
fresh Firestore sync-health/count read could not authenticate: gcloud, Application
Default Credentials and Firebase CLI cached sessions all required renewed login.
Do not interpret a completed Apps Script execution as a fresh verification of
`lastSuccessfulSyncAt` or `errorCount`; the last direct readback is recorded above.

Before the next live step, renew operator credentials and obtain the individual
reviewer email plus confirmation of the passkey/security-key MFA policy. Have
that person sign in on the hosted admin page, grant development access with the
audited CLI, and complete live review/publication/revision/suspension acceptance.
The new catalogue loader is built and tested, but existing matching callables
have not yet been redeployed with it. Deploy those affected callables and enable
development catalogue inclusion for that acceptance run. No reviewer has been
granted access and no application has been published. Production connection and
catalogue activation remain pending successful development acceptance.
