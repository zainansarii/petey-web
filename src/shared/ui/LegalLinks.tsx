import "./legal-links.css";

export function LegalLinks({ className = "" }: { className?: string }) {
  return <nav aria-label="Legal and support" className={`legal-links ${className}`.trim()}>
    <a href="/privacy/" target="_blank" rel="noopener noreferrer">Privacy<span className="sr-only"> (opens in a new tab)</span></a>
    <a href="/terms/" target="_blank" rel="noopener noreferrer">Terms<span className="sr-only"> (opens in a new tab)</span></a>
    <a href="/support/" target="_blank" rel="noopener noreferrer">Support<span className="sr-only"> (opens in a new tab)</span></a>
  </nav>;
}

export function AccountTerms() {
  return <p className="legal-notice">By continuing, you agree to our <a href="/terms/" target="_blank" rel="noopener noreferrer">Terms<span className="sr-only"> (opens in a new tab)</span></a>. Read our <a href="/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></a>.</p>;
}
