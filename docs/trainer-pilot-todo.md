# Trainer pilot — post-implementation to-do list

Email delivery and new invitations/enquiries remain disabled until the configuration and controlled smoke test below are complete. No real trainers have been invited as part of implementation.

## Resend setup — deferred at the user's request

- [ ] Create/configure the Petey Resend account and verify the sending domain.
- [ ] Choose a verified Petey sender and set `WEB_MARKETPLACE_EMAIL_FROM` in the development Functions environment.
- [ ] Create a sending API key and store it securely as Secret Manager secret `WEB_MARKETPLACE_RESEND_API_KEY` in `petey-dev-getcass`. Do not put it in source, browser environment variables or chat.
- [ ] Grant the runtime account `petey-web-onboarding-v2@petey-dev-getcass.iam.gserviceaccount.com` Secret Manager accessor access to that secret only.
- [ ] Set `WEB_TRAINER_EMAIL_ENABLED=true` and redeploy the notification worker after sender verification.
- [ ] Confirm invitation delivery, activity preferences, read suppression, provider idempotency and failure recovery with controlled inboxes. Review any old queued invitations before enabling the worker; expired/superseded invitations are automatically suppressed.

## Controlled development smoke test and release

- [ ] Select the final Petey web origin, set `WEB_MARKETPLACE_SITE_URL`, and confirm Firebase Auth authorised domains and App Check registration. Keep App Check debug tokens local. Existing documentation recommends a dedicated origin before a real-user launch because project Pages sites share browser storage with other repositories on that origin.
- [ ] Publish the web build containing `/trainer/`, `/messages/` and reviewer controls to the chosen test origin. The backend deployment alone does not publish the web build.
- [ ] Enable the existing form catalogue flag `WEB_TRAINER_CATALOG_ENABLED` and new `WEB_TRAINER_PILOT_ENABLED` for the controlled development test. Redeploy the functions that consume each changed parameter.
- [ ] Use an approved controlled web application: invite, resend, reject the old link, reject the wrong email, accept once and confirm catalogue ownership. Check cross-device email confirmation and revocation.
- [ ] Complete real trainee onboarding/matching. Confirm that generated summaries exclude medical/private details, correct the disclosure, submit once and verify the locked preview.
- [ ] Unlock for £0, exchange messages in both directions, acknowledge reads, refresh drafts, set a follow-up, close/reopen and verify no repeat unlock or charge.
- [ ] Verify deployed realtime reads and App Check using the actual authenticated web client; exercise withdrawal, blocking and a private report.
- [ ] Replace a photo; publish public edits; confirm fresh matching. Submit/review credentials with the reviewer account. Check deployed Storage upload/signing permissions and preservation of published content.
- [ ] Check dashboard/CSV reconciliation and email delivery with the controlled accounts. Only then invite pilot trainers.

## Operations

- [ ] Assign a staff owner to review `webMarketplaceReports` and pending credential submissions. Reports are stored privately; this pilot does not introduce a separate moderation console.
- [ ] Monitor `web_marketplace_operation` logs by action, success, code and duration for enquiry/unlock/message failures and publication conflicts. Monitor `web_marketplace_notifications`, configuration errors and queue `needs_review` records.
- [x] Verify the notification index is READY and the marketplace rate-limit TTL is ACTIVE in development.
- [ ] Set Cloud Monitoring alerts appropriate to observed pilot traffic.
- [ ] Test account-deletion cleanup in the development project with disposable accounts, including evidence deletion and the form-import tombstone. Handle deletion of the source Google Form response through the existing administrative process.
- [x] Review and commit the web changes together with the two shared mobile Firestore files. Unrelated mobile work stays separate.

## Rollback

Set `WEB_TRAINER_PILOT_ENABLED=false` and redeploy `webMarketplaceV1`. This stops new invitations and enquiries; existing members retain conversation access and existing free unlocks. Set `WEB_TRAINER_EMAIL_ENABLED=false` and redeploy `deliverWebMarketplaceNotificationsV1` to stop email delivery. Keep the deployed read rules and conversation backend available for existing participants.

Stripe, subscriptions, calendar booking, mobile chat migration, training-revenue reporting and self-service trainer signup remain outside this pilot.
