import { type FormEvent, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { requestMagicLink } from "../api/magicLink";

type LoginScreenProps = {
  onBack: () => void;
  onLinkRequested: (email: string, mode: "sent" | "preview") => void;
};

export function LoginScreen({ onBack, onLinkRequested }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const reducedMotion = useReducedMotion();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      setSending(true);
      setError(null);
      const mode = await requestMagicLink(normalizedEmail);
      onLinkRequested(normalizedEmail, mode);
    } catch {
      setError("We couldn’t send your login link. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="login-screen">
      <header className="flow-header login-screen__header">
        <BrandMark className="flow-header__logo" />
        <button aria-label="Back to home" className="icon-button login-screen__back" disabled={sending} onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={20} />
        </button>
      </header>

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="login-screen__content"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 22 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1>Welcome back</h1>
        <p>Enter the email linked to your Petey account and we’ll send you a secure login link.</p>

        <form className="login-form" noValidate onSubmit={submit}>
          <label className="input-field">
            <span>Email address</span>
            <input
              aria-describedby="login-email-error"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              inputMode="email"
              maxLength={320}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>
          <p aria-live="polite" className="login-form__error" id="login-email-error" role={error ? "alert" : undefined}>{error}</p>
          <button className="primary-button login-form__submit" disabled={sending} type="submit">
            {sending ? "Sending link…" : "Email me a login link"}
            {!sending ? <ArrowRight aria-hidden="true" size={19} /> : null}
          </button>
        </form>
      </motion.section>
    </main>
  );
}
