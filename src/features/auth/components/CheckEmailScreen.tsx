import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { requestMagicLink } from "../api/magicLink";

export function CheckEmailScreen({
  email,
  preview,
  onBack,
  onPreviewFeed,
  purpose = "onboarding",
}: {
  email: string;
  preview: boolean;
  onBack: () => void;
  onPreviewFeed: () => void;
  purpose?: "login" | "onboarding";
}) {
  const [cooldown, setCooldown] = useState(preview ? 0 : 30);
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const resendInFlight = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resend = async () => {
    if (cooldown > 0 || resendInFlight.current) return;
    resendInFlight.current = true;
    setResending(true);
    try {
      setStatus("Sending another link…");
      await requestMagicLink(email);
      setCooldown(30);
      setStatus("A fresh link is on its way.");
    } catch {
      setStatus("We couldn't resend the link. Try again in a moment.");
    } finally {
      resendInFlight.current = false;
      setResending(false);
    }
  };

  return (
    <main className="check-email">
      <header className="flow-header check-email__header">
        <BrandMark className="flow-header__logo" />
        <button aria-label={purpose === "login" ? "Back to login" : "Back to your details"} className="icon-button check-email__back" disabled={resending} onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={20} /></button>
      </header>

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="check-email__content"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 22 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <svg aria-hidden="true" className="mail-mark" viewBox="0 0 24 24">
          <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z" />
        </svg>

        <h1>{preview && purpose === "onboarding" ? "Your shortlist is ready to preview" : "Check your email"}</h1>
        <p className="check-email__lede">
          {preview
            ? purpose === "login"
              ? "Firebase isn’t configured in this build, so no login email was sent."
              : "Firebase isn’t configured in this build, so no email was sent. Your full matching flow and feed are ready below."
            : <>We sent a secure {purpose === "login" ? "login" : "sign-in"} link to <strong>{email}</strong>. Open it on this device to {purpose === "login" ? "sign in" : "save your shortlist"}.</>}
        </p>

        {preview && purpose === "onboarding" ? (
          <button className="primary-button" onClick={onPreviewFeed} type="button">
            Preview matched feed <ArrowRight aria-hidden="true" size={19} />
          </button>
        ) : (
          <div className="check-email__resend">
            <span>Didn’t receive it?</span>
            <button disabled={cooldown > 0 || resending} onClick={resend} type="button">
              <RotateCw aria-hidden="true" size={15} />
              {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
            </button>
          </div>
        )}
        <div aria-live="polite" className="check-email__status">{status}</div>
      </motion.section>
    </main>
  );
}
