import { useEffect, useRef } from "react";
import { ArrowUpRight, MapPin, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { GymboxClub, GymboxMatch, GymboxTrainer } from "../../gymbox-shared/contract";
import { sessionPrice } from "./price";

export function ProfilePanel({ trainer, club, match, onClose }: {
  trainer: GymboxTrainer; club: GymboxClub | undefined; match: GymboxMatch; onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const panel = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.showModal();
    close.current?.focus();
    return () => {
      panel.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <dialog className="gb-profile-dialog" ref={dialog} aria-labelledby="gb-profile-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <button ref={close} className="gb-icon-button gb-profile__close" aria-label="Close trainer profile" onClick={onClose}><X size={22} /></button>
    <motion.article className="gb-profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.3 }}>
      <div className="gb-profile__portrait"><img src={trainer.photoUrl} alt={trainer.name} /><div className="gb-profile__identity"><div className="gb-profile__meta"><span>{club?.name}</span><span className="gb-profile__price">{sessionPrice(trainer.pricePerSessionGbp)}</span></div><h2 id="gb-profile-title">{trainer.name}</h2></div></div>
      <div className="gb-profile__body">
        <section><h3>Why you could work well together</h3><ul className="gb-reasons">{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section>
        <section><h3>About {trainer.name.split(" ")[0]}</h3><p className="gb-profile__bio">{trainer.bio || trainer.summary}</p></section>
        {trainer.expertise.length > 0 ? <section><h3>Expertise</h3><ul className="gb-profile__list">{trainer.expertise.map((expertise) => <li key={expertise}>{expertise}</li>)}</ul></section> : null}
        {trainer.qualifications.length > 0 ? <section><h3>Qualifications</h3><ul className="gb-profile__list">{trainer.qualifications.map((qualification) => <li key={qualification}>{qualification}</li>)}</ul></section> : null}
        {club ? <section><h3>Your training location</h3><p className="gb-profile__club"><MapPin size={18} />Gymbox {club.name}</p><p>{club.address}</p><p className="gb-muted">{match.locationReason}</p></section> : null}
        <p className="gb-profile__rates">{trainer.kind === "synthetic" ? "Fictional profile for this demo. Sessions are not available to book." : "Individual session prices and availability need confirming with the trainer."}</p>
        {trainer.kind === "sourced" && trainer.sourceUrl ? <a className="gb-source-link" href={trainer.sourceUrl} target="_blank" rel="noopener noreferrer">View original Gymbox profile <ArrowUpRight size={16} /><span className="gb-sr-only"> (opens in a new tab)</span></a> : null}
      </div>
    </motion.article>
  </dialog>;
}
