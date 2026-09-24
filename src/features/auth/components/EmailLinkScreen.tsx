import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AccountTerms } from "../../../shared/ui/LegalLinks";
import { AuthScreen } from "./AuthScreen";

export function EmailLinkScreen({ onSubmit, onBack, title = "Welcome back", description = "Enter the email linked to your Petey account and we’ll send you a secure login link.", submitLabel = "Email me a login link", busyLabel = "Sending link…", showTerms = true, failureMessage, children }: {
  onSubmit: (email: string) => Promise<void>;
  onBack?: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  busyLabel?: string;
  showTerms?: boolean;
  failureMessage?: (error: unknown) => string;
  children?: ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError(null);
    try { await onSubmit(normalizedEmail); }
    catch (failure) { setError(failureMessage?.(failure) ?? "We couldn’t send your login link. Check your connection and try again."); }
    finally { inFlight.current = false; setSending(false); }
  };

  return <AuthScreen title={title} description={description} onBack={onBack} busy={sending}>
    <form className="auth-email-form" noValidate onSubmit={submit}>
      <label className="auth-field">
        <span>Email address</span>
        <input aria-describedby="login-email-error" aria-invalid={Boolean(error)} autoCapitalize="none" autoComplete="email" autoFocus inputMode="email" maxLength={320} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} disabled={sending} />
      </label>
      <p aria-live="polite" className="auth-form-error" id="login-email-error" role={error ? "alert" : undefined}>{error}</p>
      <button className="auth-primary-button" disabled={sending} type="submit">
        {sending ? busyLabel : submitLabel}
        {!sending && <ArrowRight aria-hidden="true" size={19} />}
      </button>
    </form>
    {children}
    {showTerms && <AccountTerms />}
  </AuthScreen>;
}
