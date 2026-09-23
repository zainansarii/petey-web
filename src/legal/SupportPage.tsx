import { EmailLink, LegalDocument, LegalLink, LegalSection } from "./LegalDocument";

export function SupportPage() {
  return <LegalDocument title="Support" introduction={<p>For help with Petey, email <EmailLink />. This is also the contact for privacy requests to Cass Technologies LTD.</p>}>
    <LegalSection number={1} title="Help With Petey">
      <p><EmailLink subject="Petey support">Contact support</EmailLink> about sign-in, matching, your trainer profile or a problem with the app. Briefly describe what happened and the page you were using. Never send passwords or sign-in links.</p>
    </LegalSection>
    <LegalSection number={2} title="Privacy Requests" id="privacy-requests">
      <ul>
        <li><EmailLink subject="Petey — correct my information">Correct my information</EmailLink>: tell us which account or profile detail needs changing.</li>
        <li><EmailLink subject="Petey — delete my account and personal data">Delete my account and personal data</EmailLink>: request account closure and removal of linked information.</li>
        <li><EmailLink subject="Petey — access or export my personal data">Access or export my data</EmailLink>: request a copy of your personal information.</li>
        <li><EmailLink subject="Petey — withdraw legacy health consent">Withdraw previous health-data consent</EmailLink>: ask us to stop processing and remove any health information held under an earlier consent.</li>
        <li><EmailLink subject="Petey — privacy request">Other privacy request</EmailLink>: object to processing, request a restriction or ask a privacy question.</li>
      </ul>
      <p>Email from the address linked to your account where possible. If you have lost access, explain that first. We will verify the request before changing or disclosing account data. Do not send medical details or identity documents in your first message.</p>
      <p>These links open your email app; they do not submit a request until you send the email. If no email app opens, write directly to hello@joinpetey.com with the relevant subject. We normally respond to data rights requests within one month, explaining any lawful extension or exception.</p>
    </LegalSection>
    <LegalSection number={3} title="Deleting a Chat or Account">
      <p>“Delete chat” in onboarding clears the current chat and any linked draft. It does not close your account or remove a matching profile already saved to it.</p>
      <p>An account-deletion request is handled by support after verification. We remove the account and linked records subject to any lawful retention requirements. For trainer applications, this also requires checking the original application and uploaded evidence. We will explain what was removed and any information we need to retain.</p>
      <p>Deleting your Petey account does not delete copies already held by a trainer or messages in someone’s email inbox. See our <LegalLink href="/privacy/#your-rights">Privacy Policy</LegalLink> for more information.</p>
    </LegalSection>
    <LegalSection number={4} title="Safety and Complaints">
      <p>Use the report or block controls in a conversation, or <EmailLink subject="Petey safety concern">report a safety concern</EmailLink>. For a complaint about our service or handling of your information, <EmailLink subject="Petey complaint">contact us here</EmailLink>. If someone is in immediate danger, contact the emergency services.</p>
    </LegalSection>
  </LegalDocument>;
}
