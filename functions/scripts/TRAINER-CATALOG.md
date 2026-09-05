# Trainer catalog

The shared Firestore catalog lives in `publicTrainers/{trainerId}`. Mobile owns
the approved publication fields and the private application in
`trainerProfiles/{trainerId}`. The web adds `webProfile`, validated by
`src/features/discovery/model/trainer.ts`, plus its schema version, source and
update timestamp. The web profile contains the complete display profile,
including biography and practical training information.

Use the trainer's Firebase UID as the document and profile ID. The eight dev
records use `petey-demo-trainer-<slug>`. Real trainers follow the same schema with
their own IDs and `isDemo: false`; there is no name-based allowlist in matching.
`photo` stores the existing approved `onboarding/{trainerId}/profile/{filename}`
Storage path. The server issues expiring HTTPS URLs for display. No image upload,
public bucket access or credential/evidence publication is needed for this
migration. Omit `distanceMiles` from a catalog record: a distance requires a
specific client location.

Client apps cannot read these collections directly. Server matching rechecks
publication, the account status, the approved version and current evidence before
using an entry. A web publisher should update `webProfile` whenever its public
copy changes. Mobile approval preserves that separately published field when
rebuilding its projection. On every read, the web overlays the latest approved
name, image, specialties, prices, venues, precise availability, coaching styles
and qualifications. A changed home area replaces an obsolete town label. Package
prices may be null when the trainer does not offer that package.

## Import the existing demos into dev

Use an existing `gcloud` login with Firestore and Storage access. The script never
changes the active account/project, creates credentials, or supports production.
It checks that all eight records belong to the existing demo seed, are approved
and active, and reference images already in Storage. Then one transaction adds
only the web metadata. Existing mobile fields and records are preserved and
verified after writing. Repeated runs perform no writes when values match.

From `petey-web`:

```sh
npm --prefix functions run build
node functions/scripts/migrate-demo-web-trainers.mjs --validate
node functions/scripts/migrate-demo-web-trainers.mjs
node functions/scripts/migrate-demo-web-trainers.mjs --apply --project=petey-dev-getcass
node --test functions/scripts/migrate-demo-web-trainers.test.mjs
```

The default invocation is a live read-only dry-run. `--validate` checks local
data only. The script refuses to overwrite a web profile owned by another
publisher, recreate absent seed records, modify private trainer records, or
invent missing media. The original complete mobile seeder remains in
`mobile-app/scripts/seed-demo-trainers.mjs` and is a separate operation.

The bundled `src/features/discovery/data/trainers.ts` records are fixtures for
the public landing carousel and local QA. Actual matchmaking and signed-in
profiles come from the server catalog.
