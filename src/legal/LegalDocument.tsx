import type { ReactNode } from "react";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import { BrandMark } from "../shared/ui/BrandMark";
import "./legal.css";

export function LegalDocument({ title, introduction, children }: { title: string; introduction: ReactNode; children: ReactNode }) {
  return <div className="petey-legal-page"><main className="petey-legal-shell">
    <header className="petey-legal-topbar">
      <a href="/" className="petey-legal-back" aria-label="Back to Petey home"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7M8 12h12" /></svg></a>
      <BrandMark className="petey-legal-brand" light />
    </header>
    <article>
      <header className="petey-legal-lede petey-legal-grid"><div><h1>{title}</h1><p className="petey-legal-updated">Last updated · <time dateTime="2026-09-23">September 23, 2026</time></p></div><div className="petey-legal-copy">{introduction}</div></header>
      {children}
    </article>
    <nav className="petey-legal-footer" aria-label="Legal and support"><LegalLink href="/privacy/">Privacy</LegalLink><LegalLink href="/terms/">Terms</LegalLink><LegalLink href="/support/">Support</LegalLink></nav>
    <p className="petey-legal-company">Petey is operated by Cass Technologies LTD, registered in England and Wales, company number <LegalLink href="https://find-and-update.company-information.service.gov.uk/company/17095002">17095002</LegalLink>. Registered office: 44 Blakes Lane, New Malden, United Kingdom, KT3 6NR.</p>
  </main></div>;
}

export function LegalSection({ number, title, children, id }: { number: number; title: string; children: ReactNode; id?: string }) {
  return <section className="petey-legal-section petey-legal-grid" id={id}><h2>{number}. {title}</h2><div className="petey-legal-copy">{children}</div></section>;
}

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="petey-legal-link">{children}</a>;
}

export function EmailLink({ subject, children = "hello@joinpetey.com" }: { subject?: string; children?: ReactNode }) {
  return <LegalLink href={`mailto:hello@joinpetey.com${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`}>{children}</LegalLink>;
}
