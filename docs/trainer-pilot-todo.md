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
- [x] Deploy the current matching/account backend (2026-09-24): `matchWebOnboardingDraftV1`, `confirmWebOnboardingDraftV3`, `consumeWebOnboardingDraftV3` and `getWebClientProfileV3`. All four are ACTIVE on new revisions; the uploaded matching source and compiled code match the tested checkout, and unauthenticated callable probes return 401. Catalogue/pilot flags remained false for this deployment. Full signed-in acceptance is separate below.
- [x] Temporarily enable the catalogue/pilot flags for controlled acceptance. On 2026-09-24, restore both flags to false across all five affected services and verify every operation completed with ACTIVE revisions. Email delivery remains configured on.
- [x] Approve a synthetic application; invite, resend, reject the old link and wrong email, redeem as the intended trainer and confirm workspace ownership. Reusing the link as that member recovers the existing workspace. Reviewer revocation returns "Trainer access revoked" and invitation status revoked.
- [ ] Check email-link confirmation in a different browser/device from the one that requested it. The successful same-browser flow does not establish this.
- [ ] Independently verify access denial immediately after revocation. The reviewer UI confirmed revocation and the trainer subsequently lost access, but account deletion had already occurred before that denial was observed.
- [x] Complete actual trainee onboarding, email sign-in and schema-2 matching against the controlled trainer. Correct the disclosure before submitting an enquiry and verify the locked trainer preview hides the full name/introduction.
- [ ] Exercise omission of synthetic medical/private input from generated summaries. The completed onboarding path deliberately contained no health information.
- [x] Unlock for £0, exchange messages in both directions, acknowledge reads, restore a draft after refresh, set a follow-up, close/reopen and verify no second unlock/charge. One intermediate tracking save returned `internal`; retries passed and scoped logs did not identify its cause.
- [x] Verify deployed realtime reads through authenticated clients; exercise withdrawal, blocking and a private report. Withdrawal used a second synthetic locked enquiry seeded for that specific check; the primary enquiry was created through the real UI.
- [x] Replace a photo, save/reload/publish public edits, upload replacement credentials and approve them through the reviewer UI. Verify Storage upload/signing and preservation of trainer-authored published content.
- [ ] Confirm fresh matching after the trainer edits and successful browser download of private credential evidence. The signed link was generated, but Chrome reported `net::ERR_BLOCKED_BY_CLIENT`; the cause is unconfirmed.
- [x] Reconcile the dashboard and actual CSV: one free unlock, £0.00. Verify invitation, enquiry and unread-message emails, read-suppression and persisted notification preferences.
- [ ] Onboard approved real pilot trainers and deliberately enable launch flags after remaining gates are satisfied. No real trainer was invited during acceptance.

The controlled run ended on 2026-09-24 with both disposable Auth accounts, their app content and Storage evidence deleted. Seven test email conversations were moved to the owner's Gmail Trash. The owner/reviewer and both pre-existing applications were preserved. Minimal inactive/reimport tombstones and deletion-job records remain. Detailed evidence is in the workspace audit `audits/2026-09-23-web-acceptance.md`; this is a partial acceptance result, not full release sign-off.

## Privacy and support — implementation 2026-09-23

- [x] Build public `/privacy/`, `/terms/` and `/support/` pages in the Cass legal-page font/layout, with verified company details and Petey-specific data descriptions.
- [x] Link policies at onboarding/account entry and provide support, correction, access/export, account deletion and legacy health-consent withdrawal email routes to `hello@joinpetey.com`.
- [x] Document [processor/retention inventory and request handling](web-privacy-operations.md); verify live draft/receipt TTL; remove provider exception text from onboarding error logs.
- [ ] Controller review of the notice, lawful bases including incidental health input, provider contract/transfer evidence and retention. Publishing pages does not constitute this approval. Support mailbox ownership is assigned below.
- [x] Verify deployed deletion for both controlled accounts, including marketplace content, profile/evidence, Storage and the trainer reimport tombstone. Recursively check legacy health children and manually remove the known consumption receipt as required by the runbook.
- [ ] Complete correction acceptance: the synthetic identity/brief update and matching-cache invalidation were written, but the browser's fresh matching result was not verified before cleanup.

## Operations

- [x] Assign operational ownership: the Petey owner, using `hello@joinpetey.com`, confirmed responsibility on 2026-09-23 for reviewing `webMarketplaceReports`, pending credential submissions and the support mailbox, including correction/deletion requests. Reports are stored privately; this pilot does not introduce a separate moderation console. Reviewer access and end-to-end operational checks remain separate tasks.
- [ ] Monitor `web_marketplace_operation` logs by action, success, code and duration for enquiry/unlock/message failures and publication conflicts. Monitor `web_marketplace_notifications`, configuration errors and queue `needs_review` records.
- [x] Verify the notification index is READY and the marketplace rate-limit TTL is ACTIVE in development.
- [ ] Set Cloud Monitoring alerts appropriate to observed pilot traffic.
- [x] Test deployed account-deletion jobs with disposable accounts and verify completion/readback, evidence deletion and the form-import tombstone (2026-09-24).
- [ ] Verify the separate administrative source-erasure process using a disposable Google Form response, linked Sheet row and Drive uploads. This run imported a synthetic fixture directly and did not create those source records.
- [x] Review and commit the web changes together with the two shared mobile Firestore files. Unrelated mobile work stays separate.

## Rollback

Set `WEB_TRAINER_PILOT_ENABLED=false` and redeploy `webMarketplaceV1`. This stops new invitations and enquiries; existing members retain conversation access and existing free unlocks. Set `WEB_TRAINER_EMAIL_ENABLED=false` and redeploy `deliverWebMarketplaceNotificationsV1` to stop email delivery. Keep the deployed read rules and conversation backend available for existing participants.

Stripe, subscriptions, calendar booking, mobile chat migration, training-revenue reporting and self-service trainer signup remain outside this pilot.
