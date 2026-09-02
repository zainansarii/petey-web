# Web onboarding V3: privacy and staff handling

This document covers the Petey web onboarding flow only. It does not change the
mobile onboarding flow or `completeClientOnboarding`.

## Customer-facing disclosure

The surrounding onboarding experience and privacy notice must explain that Petey
uses AI, that the completed conversation becomes an internal matching profile,
and that identity details do not enter the AI conversation. The internal profile
is not displayed during onboarding; the user confirms the handoff from the secure
final-details modal and retains the usual account correction and deletion routes.

The assistant must not solicit medical information. If a user volunteers a
health detail, it may remain in the short-lived transcript until the draft is
consumed, deleted, or expires, but the Markdown generator must omit it. V3 does
not create a new durable health record. The legacy withdrawal callable remains
available while old web health records are being retired.

## Data boundaries and retention

| Data | Purpose | Sharing | Retention |
| --- | --- | --- | --- |
| `webOnboardingDraftsV3/{draftId}` plus message and idempotency subcollections | Continue the chat, prepare the internal Markdown profile once, and validate the magic-link handoff | Petey and its model processor only | Capability access expires after 24 hours; authenticated consumption recursively deletes the draft and transcript; TTL handles abandoned drafts and child records |
| `_webOnboardingConsumptionsV3/{draftId}` | Make authenticated consumption safely retryable without restoring the transcript | Petey server processing only | 7 days plus asynchronous TTL deletion |
| `webClientProfiles/{uid}` | Keep the user-confirmed internal matching profile for a future matching service | The Markdown profile is not currently parsed or ranked by the demo feed | Until account deletion or an earlier verified deletion request |
| Legacy `webClientHealth/{uid}` and consent records | Support withdrawal and deletion of pre-cutover web health data | Restricted privacy and server processing only | Removed during the approved web-only reset, withdrawal, or account deletion |
| Identity handoff fields in the confirmed short-lived draft | Bind the confirmed matching profile to the correct authenticated account | Petey authentication services only | Only until authenticated consumption or draft expiry |

V3 creates no concierge-note records. It does not persist per-turn profile
patches, coverage states, evidence quotes, model reasoning, or staff notes. The
only model-derived profile is the final internal Markdown document produced from
the complete transcript. Semantic uncertainty is retained in ordinary language
instead of being rejected or converted into invented values.

The durable profile is one user-confirmed `profileMarkdown` value. It has no goal
category, postcode, availability, budget, health, or other structured matching
fields. A usable non-empty profile and separately validated identity are required
before confirmation. Raw transcripts never appear in trainer summaries and are
deleted after authenticated consumption.

## Access, correction, consent withdrawal, and deletion

1. Verify the requester through the authenticated account and record the
   request in the restricted support workflow without copying transcript or
   health text into general-purpose tickets.
2. Check for a legal hold or moderation restriction. If one exists, stop and
   route the request to the privacy lead.
3. Use audited, least-privilege server tooling. Browser, mobile, and trainer
   clients must not receive direct access to draft transcripts or health data.
4. Correct the internal Markdown document as one profile value. V3 has no
   structured matching fields or concierge-note store to inspect or update.
5. For a legacy health withdrawal, clear the old active health values, record
   the deterministic withdrawal, and verify their deletion.
6. For an abandoned draft deletion, recursively delete the capability-protected
   draft so its messages and idempotency records are removed as well.

## Launch gate

Do not enable real data collection until the privacy lead has approved the
published notice, processor and retention records, user correction/deletion
route, legacy consent withdrawal path, and structured operational logging. Logs
may contain only failure counts, Markdown preparation retries/failures, turn
count, document length, confirmation counts, and latency. They must never
contain transcript text, health data, Markdown profile text, or identity.
