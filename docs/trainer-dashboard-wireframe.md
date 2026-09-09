# Petey trainer dashboard — product wireframe

The approved concept is now implemented as a separate [free trainer pilot](./trainer-pilot.md).
The live pilot supersedes the example prices and implementation gaps below; this document records the original sample wireframe.

The [app-wide design consistency rules](./design-consistency.md) apply to brand
basics such as Oxygen, the wordmark and no eyebrow text. Preserve the approved
dashboard, inbox and profile styling, including its smaller text and compact layout.

An interactive, responsive concept for a trainer’s lead workspace. Open
`/petey-web/trainer-preview/` with the existing Vite dev server. The preview is
a separate entry point; trainee onboarding, matching and the reviewer app are
unchanged. All people, enquiries, transactions and outcomes are sample data.
Changes last for the current page session; reloading resets the prototype.

## What the codebase tells us

Petey is a marketplace for finding a suitable personal trainer. Trainees describe
their goals, experience, preferred coaching relationship, training setting,
location, frequency, availability, budget and dealbreakers through a conversational
onboarding flow. A final Markdown brief drives matching against eligible, approved
trainer profiles. The shortlist explains practical compatibility and exposes
differences for closest alternatives. The browser initially receives previews;
authenticated trainees can explore full profiles.

The trainer’s value proposition is therefore relevant introductions from people
who have chosen to contact them. The dashboard should answer: Who is interested?
Is this a fit? Who should I reply to? Did my paid introductions become clients?
Is my published profile accurate enough to attract the right people?

Current source evidence, inspected for this wireframe:

| Area | Source | Implication |
| --- | --- | --- |
| App flow and sign-in | `src/app/App.tsx` | Trainee phases and magic-link authentication exist; there is no trainer dashboard or trainer login flow. |
| Conversational discovery | `src/features/onboarding/components/OnboardingFlow.tsx`, `functions/src/onboardingConversationPrompt.ts` | Use the actual practical matching fields in a lead preview, with free-form goals retained. |
| Matching and publication | `functions/src/trainerMatching.ts`, `functions/src/webMatching.ts`, `docs/web-matching-architecture.md` | Match scores are ranking signals, not probabilities; do not present a fictitious “98% likely to become a client”. |
| Trainee profile exploration | `src/features/feed/components/FeedScreen.tsx` | Existing introduction dialog explicitly says nothing is sent or saved. Live web enquiries still need implementation. |
| Trainer profile fields | `src/features/discovery/model/trainer.ts`, `src/features/trainerApplications/model.ts` | Bio, specialisms, style, area, settings, pricing, packages, availability, experience and professional link inform the editor. |
| Trainer application operations | `docs/trainer-application-operations.md`, `src/admin/ReviewEditor.tsx` | Google Form intake creates reviewed catalogue entries, not trainer login accounts. Edits must respect the approved publication boundary. |
| Paired mobile request flow | `../mobile-app/shared/petey/trainerRequests.ts`, `../mobile-app/features/feed/components/TrainerRequestCard.tsx`, `../mobile-app/functions/src/features/petey/requests.ts` | Mobile already models requests, an introduction, a client snapshot, acceptance and subsequent chat. This is a useful reference, not an existing web paid-unlock integration. |
| Brand | `src/shared/design/tokens.css`, `src/shared/ui/BrandMark.tsx` | Reuse Oxygen, cream `#f7f8f2`, lime `#c9ff5c`, charcoal and the actual wordmark. |

The older README still describes parts of matching as a neutral catalogue. The
current implementation and matching runbook provide the newer source of truth.
This is a source review, not a claim about deployed Firebase state.

## Design direction

**Visual thesis:** a warm, spacious workspace with cream surfaces, a personal
profile anchor and a focused lime accent, using the supplied reference’s
rounded panels, large numerals, split layout and quiet separators.

**Content plan:** overview of actionable enquiries → lead assessment and paid
unlock → conversation and follow-up → editable profile and spending history.

**Interaction thesis:** metric tiles open the corresponding inbox view; short
dialog transitions preserve the dashboard context; restrained hover and chart
transitions help show what can be acted on. Reduced motion removes animation.

The reference’s abstract productivity scores become real enquiry counts. Its
meetings rail becomes trainer-created follow-up reminders because Petey does not
currently know a trainer’s external calendar. “Developed areas” becomes a count
of goals people are enquiring about. The profile ring represents verified profile
identity visually, not an invented completion percentage.

## Information architecture and wireframes

### 1. Overview

Desktop has a top navigation bar, a primary workspace and a narrower right rail.

- Profile: approved name, photo, specialism, rough area, verification indicator,
  accepting-clients toggle, edit and public preview actions.
- New enquiries: the clearest acquisition action. Select to review relevant
  people and decide whether to pay.
- Ready for your reply: unlocked introductions awaiting the first trainer reply.
  This prevents paid leads being forgotten.
- Funnel strip: enquiries received → unlocked → started training. This is one
  received-date cohort, not three unrelated totals.
- Newest enquiries: name, goal, stated session budget, rough area/setting and an
  action to inspect the enquiry. On mobile, secondary details move into the dialog.
- Enquiry activity: paired count bars by received date, plus an accessible data
  table. Values are actual fixture counts, not decorative curves.
- Follow-ups: upcoming trainer-created reminders with context and a deep link
  to the lead. This queue intentionally includes all dates, independently of
  the reporting filter.
- Conversion and spend: started-training share, clearly labelled as outcomes
  entered by the trainer, plus money actually spent on unlocks during the period.
- Goals: count of enquiries by goal. A live version needs reliable categorisation
  while preserving the person’s original free-form goal in the enquiry itself.

The 28-day example has 24 enquiries, 8 still new, 16 unlocked, 3 awaiting a reply,
4 marked started training, £128 unlock spend and a 25% recorded conversion share.
The 7-day selector updates counts, chart, conversion, goals and spending. The
default overview is deliberately useful before profile-view tracking exists.

### 2. Enquiry inbox

One list, with status filters and search by name, goal or area. The list respects
the reporting period. Statuses are New enquiry, Needs a reply, Contacted,
Consultation, Started training and Closed. “Consultation” is a manual lead stage,
not an integrated calendar booking. “Started training” is a reported outcome,
not proof of revenue or an automatically verified client relationship.

Opening an enquiry retains context in a dialog. The locked state shows enough
practical information to make a purchase decision: goal, rough area, venue,
budget, availability, frequency with the trainer, experience and fit reasons.
An example budget mismatch is shown explicitly. It never disappears into a
generic positive match badge.

The introduction and fuller shared brief are absent from the locked DOM. The
placeholder consists of decorative empty lines, not CSS-blurred personal text.
The prototype’s fixtures are bundled locally; they are not an access-control
implementation. The real server must omit locked content from every response.

### 3. Unlock → conversation → outcome

1. Choose an enquiry and assess the fit without paying.
2. Select “Unlock enquiry · £8”.
3. Review a clear one-off total and what it includes. Contact access does not
   guarantee a booking. The example price is a design assumption, not approved pricing.
4. Simulate the payment. An optional declined-payment test keeps the lead locked,
   leaves all counters unchanged and explains retry.
5. On simulated success, reveal the introduction and reply composer, change
   the stage to Needs a reply and update spending once.
6. A first preview reply moves the lead to Contacted. Further replies do not
   create more unlock charges.
7. Add a private note and follow-up date in “Training brief & notes”. The date
   feeds the overview queue; marking the lead Started training or Closed removes
   it from that queue.
8. Manually track the lead’s outcome as the conversation develops.

Identity before payment remains a product decision. This concept uses fictional
names for readable assessment; first name plus surname initial may be preferable
in production. Exact addresses, medical notes, date of birth, personal email and
telephone numbers do not belong in the locked preview. A brief shared with a
trainer needs its own explicit trainee-facing sharing boundary; the internal
matching Markdown must not simply be exposed wholesale after payment.

### 4. My profile

The form is divided into three sections with a live draft preview:

| Section | Editable information | Why the trainer cares |
| --- | --- | --- |
| You & your coaching | Name, headline specialism, bio, specialisms, style, experience, professional website | Helps people recognise a coach they want to work with. |
| Where & when | Rough area, service-area notes, Home/Online/Commercial gym/Private studio settings, broad weekly availability, accepting new clients | Reduces enquiries the trainer cannot serve. Availability represents matching windows, not bookable appointments. |
| Sessions & pricing | Session price, duration, 10-session package, monthly coaching, inclusions | Sets expectations before an enquiry and informs budget compatibility. |

Credentials are shown separately as verified information. Qualification and
insurance changes require evidence review. Insurance renewal is a clearly labelled
example date. Photo upload and evidence replacement are specified but not active
in this wireframe; no dummy upload buttons suggest otherwise.

Draft edits survive navigation within the current page session and appear in the
draft preview. “Save draft” acknowledges that session draft. “Submit changes”
shows an awaiting-review state while the approved overview profile stays live.
No backend submission occurs. A production editor must persist drafts, show
unsaved changes, version submissions, preserve unknown availability notes and
deal with concurrent reviewer edits. Capacity pause should stop new matching
promptly without making existing paid conversations inaccessible.

### 5. Spending

Three clear figures: total unlock spending, number of paid unlocks and average
cost per unlock. The ledger identifies each enquiry, payment date, amount and
status. Export produces a real CSV of the sample ledger. No fictitious stored
card, available credit balance, earnings, MRR or total training revenue is shown.
Transaction-level receipts and refund/request-support controls belong in the
production flow once payment policy and provider have been selected.

## Metric definitions and data readiness

| Metric | Definition | Required production signal |
| --- | --- | --- |
| New enquiries | Received in range and currently new/locked | Durable, deduplicated enquiry creation and state |
| Ready for reply | Received in range, unlocked, awaiting first trainer reply | Paid access plus message author/timestamp |
| Enquiries | Distinct enquiries received in range | Enquiry ID and server-created timestamp |
| Unlocked cohort | Enquiries received in range that have been unlocked, regardless of payment date | Unlock entitlement linked to enquiry |
| Started training | Enquiries received in range currently marked started training | Trainer-entered outcome, with change history |
| Recorded conversion | Started-training cohort / unlocked cohort | Above; show “—” if denominator is zero |
| Unlock spend | Successful payment totals with payment date in range | Payment ledger; refunds must be represented separately |
| Average unlock cost | Unlock spend / successful unlock payments in range | Same ledger; zero denominator shows “—” |
| Follow-ups | Open unlocked leads with a trainer-set reminder | Note/reminder state, independent of reporting dates |
| Goal demand | Enquiry count by goal category in received-date cohort | Shared enquiry summary and validated categorisation |

The web code does not currently supply these new trainer metrics. They are
available *to implement from the proposed lead lifecycle*, not existing live
analytics. Profile views, shortlist appearances and view-to-enquiry conversion
can be added later after their events, deduplication rules and denominators exist.
The matching result currently belongs to the trainee; it is not a trainer
impression counter. Training revenue, delivered sessions, attendance and retention
require integrations or explicit manual reporting beyond this marketplace scope.

## Interaction and state coverage

Working in this prototype: four navigation views, reporting range, status filters,
search, locked lead assessment, budget difference, price review, declined-payment
recovery, successful unlock, included replies, manual stages, notes/reminders,
profile draft editing, availability, capacity switch, public draft preview,
submission-pending banner, sample CSV export, help, empty account and load retry.

Specified for production: pending payment with safe recovery after refresh;
already-unlocked and duplicate-purchase protection; withdrawn/expired lead before
payment; successful charge with delayed entitlement reconciliation; refunds;
replies failing to send with draft retained; loading skeletons; unsaved-dialog
draft recovery; credential expiry and rejected profile edits; notification
preferences; genuine trainer authentication and account recovery.

## Responsive and accessible behaviour

Desktop retains the reference’s profile/metric composition and secondary rail.
At tablet widths the rail moves beneath the main workspace. On a phone the
profile becomes compact, the two actionable metrics stay together, and bottom
navigation keeps Overview, Enquiries, My profile and Spending reachable. Enquiry
detail dialogs retain the practical facts hidden from narrow rows.

Use semantic buttons, labelled inputs, selected-state announcements, visible
keyboard focus, native dialog focus containment/Escape dismissal/focus return,
and a table alternative to the bar chart. State is communicated with words and
icons as well as colour. Primary mobile controls use 44px targets. Weekly availability rotates into
seven day rows on phones, keeping all three time-window buttons at least 44px
high and wide; the desktop grid retains weekdays across the top.

Design checks were grounded in the repository guidelines: Layout > Visual
hierarchy and Adaptability; Accessibility > Vision and Mobility; Color > Inclusive
color; Typography > Conveying hierarchy; Charting Data > Best practices; Entering
Data > Best practices; Modality > Best practices. These informed the reading order,
plain data labels, contrast, form labels, responsive disclosure and short dialogs.

## Implementation sequence after concept approval

1. Establish trainer account ownership, including claiming form-backed catalogue
   entries, without granting ownership by an unverified email match.
2. Add durable trainee enquiries and a consented practical snapshot; keep locked
   and paid payloads distinct. Retain source profile versions and clear fit differences.
3. Implement a payment ledger and server-confirmed unlock entitlement. Use
   idempotency and recheck lead availability; a checkout return URL alone must
   never grant access. Keep existing mobile acceptance separate until migrated.
4. Add conversations, message delivery/read state, private notes, follow-up
   reminders and manual outcomes. Preserve message drafts across interruptions.
5. Expose trainer draft editing through the existing publication/review model.
   Keep verification documents separate from public marketing copy.
6. Derive the dashboard from those events; instrument profile exposure only when
   there is a concrete reporting question and trustworthy denominator.

Decisions still open: unlock price and any variation, tax presentation, what
trainee identity is visible before unlock, lead expiry/exclusivity, invalid-lead
refund policy, whether ongoing chat stays in Petey or offers contact handoff,
which profile edits require review, and how trainer notification consent works.

## Local validation

`npm run verify` passes: lint, TypeScript, 83 frontend tests, production web build,
Functions build, 188 Functions tests, 20 script tests and 16 form-bridge tests.
Eight gated Functions integration tests remain skipped by the existing suite.
Four new tests cover unlock failure/success and included replies, reporting/filter
consistency, draft preservation and the empty/error states.

Browser QA covered the enquiry → unlock → reply flow, desktop profile editing,
and responsive layouts at 1920, 1440, 768, 390 and 320 CSS pixels. Checked layouts
had zero horizontal page/content overflow; the 1920px layout has equal 160px
outer margins. At 320px, availability controls measure approximately 73 × 44px.
Live Firebase, actual payment processing, delivery of messages and backend trainer
authorisation are outside this isolated wireframe and were not tested.
