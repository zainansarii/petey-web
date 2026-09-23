import { EmailLink, LegalDocument, LegalLink, LegalSection } from "./LegalDocument";

export function TermsPage() {
  return <LegalDocument title="Terms of Use" introduction={<><p>These terms apply to the Petey web app, operated by Cass Technologies LTD. By creating an account or using Petey’s matching and marketplace features, you agree to these terms.</p><p>Our <LegalLink href="/privacy/">Privacy Policy</LegalLink> explains how we use personal information. For help, contact <EmailLink />.</p></>}>
    <LegalSection number={1} title="The Service">
      <p>Petey helps people discover and contact independent personal trainers. The web app is in beta. Features and availability may change, and some screens may show clearly labelled previews. A profile, recommendation or enquiry does not confirm a training appointment.</p>
    </LegalSection>
    <LegalSection number={2} title="Your Account">
      <p>You must be at least 18 to create an account. Give accurate information, keep access to your sign-in email secure and do not share sign-in or invitation links. Tell us promptly if you suspect unauthorised access. Trainer invitations are for their intended recipient.</p>
    </LegalSection>
    <LegalSection number={3} title="The Free Pilot">
      <p>Petey’s current web pilot is free to use, including trainer enquiry unlocks. No payment details are required for these unlocks. If we introduce paid features, we will explain the price and terms before asking you to opt in; using the free pilot does not authorise future charges.</p>
      <p>A trainer’s fees, cancellation terms and training contract are agreed separately between you and the trainer. Petey does not currently take payment for or book training sessions.</p>
    </LegalSection>
    <LegalSection number={4} title="Matching and Training">
      <p>AI-generated recommendations and summaries can be wrong. Review the information you share and decide whether a trainer meets your needs. Petey does not provide medical advice, prescribe exercise or guarantee outcomes.</p>
      <p>Trainers provide their own services and are responsible for them. Ask about relevant qualifications, insurance, experience, suitability and prices before agreeing to train. Petey’s profile review does not guarantee a trainer’s competence or suitability for every person. Seek advice from an appropriate health professional when needed.</p>
    </LegalSection>
    <LegalSection number={5} title="Trainer Responsibilities">
      <p>Trainers must have permission to offer their services and keep profiles, prices, qualifications, insurance and availability accurate. Submit genuine evidence when requested, respect enquiry and messaging preferences, and only use a person’s information to respond to their enquiry or provide the services they request, unless you have another lawful basis.</p>
      <p>Do not add people to marketing lists without the necessary permission. You are responsible for your own training agreements, privacy information, safeguarding and legal obligations.</p>
    </LegalSection>
    <LegalSection number={6} title="Acceptable Use">
      <p>Do not impersonate others, submit false credentials, harass people, send spam or illegal content, scrape private information, misuse another person’s data, bypass access controls or disrupt the service. Do not include sensitive medical details in Petey’s chat or enquiries.</p>
      <p>You retain ownership of your content. You give us a non-exclusive licence to store, process and display it as needed to provide Petey, including displaying a trainer profile you publish and delivering messages you send. This does not give us ownership of your content or permission to use it for unrelated advertising.</p>
    </LegalSection>
    <LegalSection number={7} title="Safety and Account Closure">
      <p>You can use the available report, block and enquiry-withdrawal controls or contact <EmailLink subject="Petey safety concern" />. Petey is not an emergency service.</p>
      <p>We may restrict or suspend access where reasonably necessary to protect users, investigate misuse or comply with law. Where appropriate, we will explain our decision and allow you to contact us to challenge it. You can stop using Petey at any time and <LegalLink href="/support/#privacy-requests">request account deletion</LegalLink>.</p>
    </LegalSection>
    <LegalSection number={8} title="Our Responsibility">
      <p>We will use reasonable care and skill in providing Petey. We cannot promise uninterrupted access or that all beta features will remain available. We are responsible for loss that is a foreseeable result of our breach of these terms or failure to use reasonable care and skill, subject to applicable law.</p>
      <p>Nothing in these terms excludes or limits liability for fraud, death or personal injury caused by negligence, or any liability that cannot lawfully be excluded or limited. Your statutory consumer rights are unaffected.</p>
    </LegalSection>
    <LegalSection number={9} title="Changes and Disputes">
      <p>We may update these terms as Petey develops. We will give appropriate notice of material changes and any new charges. Changes will not remove rights you have already acquired. If you do not accept a material change, you can stop using the service and request account closure.</p>
      <p>Contact <EmailLink subject="Petey complaint" /> to raise a complaint. These terms are governed by the laws of England and Wales. Consumers retain mandatory protections and the right to bring proceedings in the courts of their home part of the UK where applicable.</p>
    </LegalSection>
  </LegalDocument>;
}
