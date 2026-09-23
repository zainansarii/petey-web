# Trainer pilot — post-implementation to-do list

Email delivery is configured and verified on 2026-09-23. The web app is deployed at `https://joinpetey.com`. Catalogue inclusion and new invitations/enquiries remain disabled until the remaining pilot checks are complete. No real trainers have been invited as part of implementation or setup testing.

## Resend setup — completed 2026-09-23

- [x] Configure the Petey Resend account and verify `joinpetey.com` in Ireland (`eu-west-1`). Receiving remains with Google Workspace; Resend tracking is not enabled and TLS is enforced.
- [x] Set `WEB_MARKETPLACE_EMAIL_FROM=Petey <hello@joinpetey.com>` in the development Functions environment.
- [x] Store a sending-only API key restricted to `joinpetey.com` as Secret Manager secret `WEB_MARKETPLACE_RESEND_API_KEY` in `petey-dev-getcass`. The key is not in source, browser environment variables or chat.
- [x] Grant the runtime account `petey-web-onboarding-v2@petey-dev-getcass.iam.gserviceaccount.com` Secret Manager accessor access to that secret only.
- [x] Set `WEB_TRAINER_EMAIL_ENABLED=true` and redeploy `deliverWebMarketplaceNotificationsV1` and `webMarketplaceV1`.
- [x] Verify setup, invitation and unread-message delivery to the owner's controlled inbox. The live worker sent two fixture notifications and suppressed read/muted alerts, with zero failures. Repeating the direct provider request returned the same receipt. All ten marketplace transaction tests, including retry recovery, passed against an isolated local emulator. The queue was empty before enabling delivery and all 13 disposable live fixture documents were removed afterward.

## Controlled development smoke test and release

- [x] Set `WEB_MARKETPLACE_SITE_URL=https://joinpetey.com`; authorise `joinpetey.com` and `www.joinpetey.com` in Firebase Auth and the existing reCAPTCHA Enterprise App Check key. The live email-link flow returned to the new origin and a subsequent callable verified both Auth and App Check as valid. Existing mobile auth domains remain in place.
- [x] Publish the root-path web build containing `/trainer/`, `/messages/` and `/admin/` to `https://joinpetey.com`. Verify these routes, assets, the landing page and `/trainer-preview/`. The old GitHub Pages URLs redirect to the corresponding new paths.
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
