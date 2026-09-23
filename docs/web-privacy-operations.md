# Petey web privacy operations

Prepared 2026-09-23 for the free web pilot. Controller: Cass Technologies LTD (17095002). Public notice: https://joinpetey.com/privacy/. Rights and support intake: https://joinpetey.com/support/ and hello@joinpetey.com.

## Processor and service inventory

| Service | Petey use / information | Location and contract record |
| --- | --- | --- |
| Google Cloud / Firebase | Auth identity, Firestore profiles/drafts/messages, Storage trainer photos/evidence, Functions processing, security logs, App Check / reCAPTCHA signals | Web Functions are in europe-west2; do not infer all services or support access are UK-only. Record applicable [Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum) and UK transfer arrangements. |
| Google Vertex AI (Gemini) | Onboarding transcript, generated profile, trainer catalogue and matching, enquiry summary | Source uses `location: global`. No claim of UK-only processing or zero provider retention. Confirm the account-specific AI retention / abuse-monitoring settings and applicable Google terms. |
| Google Workspace / Forms / Drive | Support mailbox, trainer application source responses, photos/evidence | Existing trainer form remains in the company’s Cass Workspace; Petey mailbox is in its separate Workspace. Same controller, distinct product records. Record applicable Workspace DPA and transfer terms. Source records need separate erasure. |
| Resend | Recipient address, invitation link, generic activity email, delivery status | Domain configured in eu-west-1; TLS enforced; tracking not enabled. Region is not a promise that every processing activity remains in Ireland. [Resend DPA](https://resend.com/legal/dpa). |
| GitHub Pages | Static public web content; visitor network/request information | [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Do not place personal records, credentials or private exports in this repository. |
| Independent trainers | Approved enquiry summary and, after unlock, contact details and messages | Separate controllers for their training services; recipients rather than Petey’s infrastructure processors. Do not promise deletion of copies outside Petey. |

The links identify current provider documentation, not evidence of account-specific acceptance or a completed UK transfer assessment. The controller must retain that evidence and approve the inventory before closing the existing privacy launch gate.

## Retention record

- V4 conversation: browser session storage; sent to Functions/Vertex per turn; not written as a server transcript by V4. Browser session restore may preserve it. “Delete chat” deliberately clears it.
- Finalised draft and separately entered identity: 24-hour capability expiry; recursively removed on authenticated consumption or explicit deletion. V3 legacy drafts may also contain message/idempotency children.
- Consumption receipt: seven-day expiry.
- Live TTL confirmed ACTIVE on 2026-09-23 for `webOnboardingDraftsV3`, `messages`, `idempotentTurnsV3`, `idempotentFinalizationsV3`, `_webOnboardingRateLimitsV3`, `_webOnboardingConsumptionsV3`. Expiry is not instantaneous physical deletion.
- Accounts, matching profile, applications, marketplace messages and evidence: retain to run the account/pilot, subject to valid erasure requests. No invented automatic inactivity purge: there is no such job in this release.
- Provider logs, delivery records, support emails, original Form/Drive records and any backups: review separately. Public notice gives purpose-based criteria rather than an unverified numeric retention promise.
- Retain only minimal non-content tombstones/deletion records needed to prevent reimport or reactivation; review continued need. Legal holds require a documented reason and restricted access.

## Handling a request

1. Monitor hello@joinpetey.com and record received date, request type, affected account, verification status, due date and operator. Do not copy health/transcript content into the request register.
2. Verify control of the account through a proportionate, trusted account/email verification process before disclosure or destructive changes. Never ask the requester to forward a magic sign-in link, password or medical history. An unverified supplied email address alone is not proof.
3. Acknowledge and normally respond within one month; document any lawful extension/exception and notify the requester. Distinguish a support enquiry, correction, access/export, consent withdrawal and account erasure.
4. Locate only the verified person’s records. Check existing legal/security holds first. Use restricted admin access, never a public export or broad project reset.
5. Return an explanation of what was done and any retained information/reason. Verify actual readback before recording completion. Record operator, timestamp and affected identifiers/counts without the removed content.

### Correction

Correct the saved `webClientProfiles/{uid}` identity or `profileMarkdown` as appropriate. A change to the matching brief requires invalidating/recomputing cached matches, not merely editing visible copy. Retuning in the app is the normal preference-update path. Separately correct trainer application source responses, workspace and published projection when affected, so the next import does not restore an error. Do not silently change Auth email based only on a support message; use verified account-recovery/change procedures.

### Account erasure

After verification and hold review, delete the specific Firebase Auth user through the approved administrative flow. The existing `deleteWebMarketplaceAccountV1` trigger runs `cleanupMarketplaceAccount(uid)`; inspect `webMarketplaceDeletionJobs/{uid}` for completion rather than treating Auth deletion as proof of full cleanup.

Verify profile, enquiries/message subcollections, participant inboxes, notifications, lead tracking, trainer memberships/workspaces/catalogue, credentials and Storage evidence. The trainer reimport tombstone must remain effective. The cleanup currently deletes the `webClientHealth` parent; legacy `consents` children need a separate recursive check/removal where appropriate. Check capability drafts/consumption receipts linked to the account and manually remove identified personal records when required.

For trainers, separately erase the original Google Form response, linked Sheet row, Drive uploads and any export/support copies; deleting the imported Firestore projection is insufficient. Do not run the project-wide `reset-user-data` script for an individual request. Explain external recipient/provider copies and any justified retained records.

The deployed end-to-end deletion acceptance test remains in pilot step 5. This release provides request intake and an operational procedure; it does not claim that test has already passed.

### Legacy health-consent withdrawal

The authenticated `withdrawWebHealthConsentV3` callable clears active medical fields and records withdrawal. For a verified support request, use the existing restricted administrative process to apply the same state change and verify readback. Check old consent children and any source copies; retain only justified minimum consent/withdrawal evidence. Withdrawal is not account closure and does not require the user to supply the health information again.

## Health information and launch decision

The public notice and chat ask users not to supply health details. Current prompts do not solicit medical information and instruct the profile generator to omit it. This is minimisation, not proof that no special-category processing occurs: any volunteered health text is sent to Google before profile generation. The controller needs to decide and document an appropriate approach for incidental health information (including any required Article 9 condition), or implement a separate explicit consent path before allowing that use. General terms acceptance is not explicit health consent. A warning or an AI omission instruction does not close this issue by itself.

## Approval and operational gate

- Implemented: public privacy/terms/support pages, links at data-entry and signed-in surfaces, correction/deletion/access/legacy withdrawal intake, current retention inventory, live TTL verification, safe provider-error classifications and regression tests.
- Controller review still required: policy/legal bases, special-category approach above, provider contract/transfer evidence, purpose-based retention decisions and assignment of the monitored support mailbox.
- Preserve the existing closed marketplace/catalogue flags until the separate pilot acceptance steps are complete. Do not mark this document as controller approval or a legal compliance certification.

Reference: [ICO privacy information requirements](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/); [ICO special-category conditions](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/).
