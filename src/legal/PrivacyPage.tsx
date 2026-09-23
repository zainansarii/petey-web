import { EmailLink, LegalDocument, LegalLink, LegalSection } from "./LegalDocument";

export function PrivacyPage() {
  return <LegalDocument title="Privacy Policy" introduction={<><p>Petey is operated by Cass Technologies LTD, the controller of personal data used to run Petey. Contact <EmailLink /> about your information.</p><p>This notice covers the Petey web app at joinpetey.com, trainer applications and support. Cass, our separate dating app, has its own privacy notice.</p></>}>
    <LegalSection number={1} title="Who This Applies To">
      <p>Petey helps adults find and contact personal trainers. This notice applies to visitors, people looking for a trainer, trainer applicants and trainers using the service. You must be 18 or over to create an account.</p>
    </LegalSection>
    <LegalSection number={2} title="Information We Use">
      <ul>
        <li>Account information: your name, email address, date of birth, sign-in records and account identifiers. Your date of birth is used to check that you are an adult.</li>
        <li>Matching information: the goals, experience, coaching preferences, schedule, budget, training format and general location you share, your onboarding conversation, a generated matching profile, and trainer recommendations.</li>
        <li>Trainer information: application answers, contact details, professional profile, photos, services, prices, availability, qualifications, insurance evidence and review decisions.</li>
        <li>Communications: enquiries, the summary you approve for a trainer, messages, notification preferences, reports, blocks and correspondence with support.</li>
        <li>Technical information: IP addresses and related security signals, browser and device information, timestamps, service errors and delivery records.</li>
      </ul>
      <p>We receive information directly from you, from the trainers you contact, and from our service providers when they authenticate accounts, deliver emails or identify technical and security events.</p>
    </LegalSection>
    <LegalSection number={3} title="Onboarding and AI">
      <p>Petey uses Google’s Gemini models through Vertex AI to respond during onboarding, create your matching profile, recommend trainers and prepare an enquiry summary. Your conversation is sent to Google to provide these features. The current web chat is kept in your browser tab’s session storage; we save the generated matching profile when you finish.</p>
      <p>The name, email and date of birth entered in the account form are kept separate from the AI conversation. The profile generator is instructed to exclude identity details, exact addresses and medical information. Avoid putting those details in the chat itself.</p>
      <p>Recommendations use your training preferences and trainers’ profiles to rank suitable options and explain differences. They may be inaccurate and do not guarantee suitability or results. You can retune your preferences, choose whom to contact, or ask us to correct your saved profile. We do not use these recommendations to make decisions with legal or similarly significant effects.</p>
    </LegalSection>
    <LegalSection number={4} title="Health Information">
      <p>Petey is a trainer-matching service, not a medical service. Please do not include diagnoses, injuries, treatment details or other sensitive health information in onboarding, enquiries or messages. You can describe your training preferences without explaining a medical reason.</p>
      <p>If you include health information in the AI chat, it will still be processed as part of that conversation. Asking the model to omit it from the saved profile does not prevent that initial processing. You can use “Delete chat” before completing onboarding, or contact us to request removal of information already saved.</p>
      <p>If you previously gave Petey consent to store health information, you can <LegalLink href="/support/#privacy-requests">withdraw that consent</LegalLink> without closing your account. Withdrawal does not affect processing that was lawful before withdrawal. Any health assessment a trainer needs should be arranged directly with that trainer under their own privacy information.</p>
    </LegalSection>
    <LegalSection number={5} title="Why We Use Information">
      <ul>
        <li>To take the steps you request and provide our service: run your account, match your preferences, assess trainer applications, publish trainer profiles, introduce you to trainers and provide messaging and service emails. We rely on contract or steps at your request before entering a contract.</li>
        <li>To protect and maintain Petey: prevent abuse, investigate reports, diagnose faults and keep appropriate support and operational records. We rely on our legitimate interests in running a safe, reliable service, balanced against your rights.</li>
        <li>To handle data rights requests and comply with applicable legal duties: we rely on legal obligation where it applies.</li>
      </ul>
      <p>You do not have to provide information by law. Without the account details and training preferences needed for a feature, we may be unable to provide that feature. Accepting our terms is not consent to unrelated marketing or to processing sensitive health information.</p>
    </LegalSection>
    <LegalSection number={6} title="What Other People Can See">
      <p>Your trainee matching profile is not a public profile. When you send an enquiry, the selected trainer receives the summary you review and approve. After an enquiry is unlocked, the trainer can access the disclosed contact details and the conversation. Your messages are available to the participants and to authorised staff where needed for support or safety.</p>
      <p>Published trainer profiles, including photos, services, prices and general location, are visible through Petey’s discovery features. Private application evidence and review records are restricted to authorised staff; they are not part of the public profile.</p>
      <p>Independent trainers are responsible for information they collect to provide their own training services. Deleting information from Petey cannot remove copies already received by a trainer or an email recipient.</p>
    </LegalSection>
    <LegalSection number={7} title="Service Providers and Transfers">
      <p>We use Google/Firebase for accounts, database, file storage, cloud processing, AI and abuse protection; Google Workspace and Google Forms for support and trainer applications; Resend for invitations and activity emails; and GitHub Pages for website hosting. These providers process the information needed for their part of the service. Service emails may contain sign-in or invitation links; activity emails direct you back to Petey without including your message text.</p>
      <p>Providers may process information outside the UK, including in the United States. International processing is subject to the relevant provider’s data-processing terms and applicable transfer arrangements. Contact us for information about the safeguards applying to your data or to request a copy.</p>
      <p>We may also share information with professional advisers or authorities where necessary to comply with law, address safety concerns or protect legal rights. We do not sell your personal information.</p>
    </LegalSection>
    <LegalSection number={8} title="Browser Storage">
      <p>We use browser storage for sign-in, your current onboarding conversation and saved form drafts. Firebase keeps authentication state, and your email may be stored locally while you complete an email sign-in link. Closing a tab clears its normal session storage, although browsers can restore sessions. Use “Delete chat” to clear the current onboarding conversation deliberately.</p>
      <p>Firebase App Check and Google reCAPTCHA Enterprise process device and interaction signals to protect the service from automated abuse. Google’s <LegalLink href="https://policies.google.com/privacy">Privacy Policy</LegalLink> and <LegalLink href="https://policies.google.com/terms">Terms of Service</LegalLink> apply to reCAPTCHA. The current web pilot does not use advertising trackers or optional analytics.</p>
    </LegalSection>
    <LegalSection number={9} title="How Long We Keep Information">
      <ul>
        <li>Current onboarding conversation: in the browser tab until cleared, replaced or the session ends; processed by our backend and AI provider when you ask for a reply or complete matching.</li>
        <li>Unclaimed matching drafts and temporary account details: access expires after 24 hours. Drafts are removed when saved to an authenticated account or deleted; abandoned drafts are scheduled for automatic deletion, which is not instantaneous. Older onboarding drafts can also contain chat messages.</li>
        <li>Temporary records that prevent duplicate profile saves: expire after seven days and are then scheduled for deletion.</li>
        <li>Account, matching profile, application and marketplace records: kept while needed to provide your account and the pilot, then deleted or de-identified when no longer needed or following a valid deletion request.</li>
        <li>Support, security, reporting and legal records: kept for the period needed to resolve the issue, protect the service, meet a legal obligation or deal with a legal claim. Minimal deletion records may be retained to prevent deleted trainer applications being imported again.</li>
      </ul>
      <p>Where a fixed period is not listed, we consider the purpose, whether your account or request remains active, security needs and applicable legal requirements. Provider logs, email copies and any backups have their own retention cycles; deletion from live Petey records is not a promise of immediate removal from every residual copy.</p>
    </LegalSection>
    <LegalSection number={10} title="Your Choices and Rights" id="your-rights">
      <p>You may have rights to access, correct, delete or receive a portable copy of your data, restrict processing, object to processing based on legitimate interests, and withdraw consent where it is used. These rights depend on the circumstances.</p>
      <p>Use <LegalLink href="/support/#privacy-requests">Support and privacy requests</LegalLink> or email <EmailLink />. We may need proportionate evidence that the account is yours. You do not need to send identity documents or health information in your first email. We normally respond to data rights requests within one month, and will explain any lawful extension or reason a request cannot be fulfilled.</p>
      <p>You can change email preferences in your inbox or trainer workspace. “Delete chat” removes an onboarding draft; it does not delete an account. To close your account and request removal of its data, use the account-deletion link on our support page.</p>
    </LegalSection>
    <LegalSection number={11} title="Questions and Complaints">
      <p>Contact <EmailLink subject="Petey privacy complaint" /> if you have a concern. You also have the right to complain to the UK <LegalLink href="https://ico.org.uk/make-a-complaint/">Information Commissioner’s Office</LegalLink>.</p>
    </LegalSection>
    <LegalSection number={12} title="Changes to This Notice">
      <p>We will update this page and its date when our practices change. We will bring material changes to your attention through the service or another appropriate channel before using information for a new, incompatible purpose.</p>
    </LegalSection>
  </LegalDocument>;
}
