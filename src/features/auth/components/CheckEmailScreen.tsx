import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Mail, RotateCw } from "lucide-react";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { requestMagicLink } from "../api/magicLink";

export function CheckEmailScreen({
  email,
  preview,
  onBack,
  onPreviewFeed,
}: {
  email: string;
  preview: boolean;
  onBack: () => void;
  onPreviewFeed: () => void;
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
      <header className="flow-header">
        <button aria-label="Back to your details" className="icon-button" disabled={resending} onClick={onBack} type="button"><ArrowLeft size={20} /></button>
        <BrandMark className="flow-header__logo" />
        <span />
      </header>

      <motion.section
        animate={{ opacity: 1, y: 0 }}
        className="check-email__content"
        initial={{ opacity: 0, y: reducedMotion ? 0 : 22 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={reducedMotion ? undefined : { y: [0, -7, 0], rotate: [0, -2, 0] }}
          className="mail-mark"
          transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6 }}
        >
          <Mail aria-hidden="true" size={48} strokeWidth={1.7} />
          <span />
        </motion.div>

        {preview ? <p className="preview-badge">Interactive preview</p> : <p className="eyebrow">Link sent</p>}
        <h1>{preview ? "Your shortlist is ready to preview." : "Check your email."}</h1>
        <p className="check-email__lede">
          {preview
            ? "Firebase isn’t configured in this build, so no email was sent. Your full matching flow and feed are ready below."
            : <>We sent a secure sign-in link to <strong>{email}</strong>. Open it on this device to save your shortlist.</>}
        </p>

        {preview ? (
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

      <p className="check-email__footer">One link. No password. No marketing email.</p>
    </main>
  );
}
