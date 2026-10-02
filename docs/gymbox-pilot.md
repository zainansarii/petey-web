# Gymbox pilot decisions

The published demonstration uses ten fictional trainers, a synthetic matching catalogue and deterministic sample analytics. It does not capture contact details, deliver enquiries, integrate with TEAMUP, book sessions, take payments or report production outcomes. Bank is the lead pilot story; Farringdon is the second populated demonstration club. A real pilot can start at either club.

## Decisions before a real pilot

| Decision | Proposed starting point | Still to agree |
| --- | --- | --- |
| Enquiry ownership | Gymbox names a club-level owner; participating freelance PTs receive only requests they have agreed to receive. | Who receives, triages and follows up each enquiry, and who is accountable when it is unanswered. |
| Participating trainers | Opt-in trainers review their profiles, specialisms, rates and contact route. | Selection, consent, onboarding, updates and how a trainer pauses participation. |
| Funding | Establish one buyer and a bounded pilot scope. | Whether Gymbox, participating trainers or another party funds Petey. Extra PT bookings are not assumed to be Gymbox revenue. |
| Qualified enquiry | A member explicitly requests contact with a named opted-in trainer after sharing a usable goal and training club. | Eligibility checks, required fields, duplicates and trainer acceptance criteria. |
| Consent and retention | Explain who will receive contact details at the point of enquiry; collect only what is necessary. | Controller/processor responsibilities, approved notices, lawful basis, retention period, deletion and access requests. |
| Outcome reporting | Return aggregate progress or minimal status events through an agreed route. | Who reports acceptance, first response and any later booking; which identifiers and timestamps are needed. |

These decisions do not prevent publication of a clearly synthetic demonstration. No outreach or enquiry-form submission is part of this build.

## Measurement

The demo counts completed matching searches and searches with simulated enquiry intent. Its conversion rate is unique completed searches with intent divided by unique completed searches in the selected period and club. It cannot measure starts, abandonment, contact delivery, responses or bookings.

A real pilot should instrument conversation starts and completions to measure completion rate, enquiries per completed conversation, trainer acceptance and time to first response. Each numerator and denominator needs a stable definition and deduplication key. Booking conversion is reportable only after verified downstream outcome data is returned. Keep sample figures separate from real pilot reports.

## Access and scope

Gymbox's public PT terms currently restrict personal training to members aged 18+. Exploration before joining does not establish booking eligibility. In-club matching is the demo's scope. Rates, session duration, availability and facilities require trainer- or club-specific confirmation before a real enquiry or booking flow uses them. See [sources](./gymbox-sources.md).
