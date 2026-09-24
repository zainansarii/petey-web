import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { LegalLinks } from "../../../shared/ui/LegalLinks";
import "./auth-screen.css";

export function AuthScreen({ title, description, children, onBack, backLabel = "Back to home", busy = false }: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  busy?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  return <main className="auth-screen">
    <header className="auth-screen__header">
      <a className="auth-screen__logo" href={import.meta.env.BASE_URL} aria-label="Petey home"><BrandMark /></a>
      {onBack
        ? <button aria-label={backLabel} className="auth-screen__back" disabled={busy} onClick={onBack} type="button"><ArrowLeft aria-hidden="true" size={20} /></button>
        : <a aria-label={backLabel} className="auth-screen__back" href={import.meta.env.BASE_URL}><ArrowLeft aria-hidden="true" size={20} /></a>}
    </header>
    <motion.section
      className="auth-screen__content"
      initial={reducedMotion ? false : { opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1>{title}</h1>
      {description && <p className="auth-screen__description">{description}</p>}
      {children}
      <LegalLinks />
    </motion.section>
  </main>;
}
