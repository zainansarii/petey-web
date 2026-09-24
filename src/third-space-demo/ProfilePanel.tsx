import { useEffect, useRef } from "react";
import { ArrowUpRight, MapPin, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ThirdSpaceClub, ThirdSpaceMatch, ThirdSpaceTrainer } from "../../third-space-shared/contract";

export function ProfilePanel({ trainer, club, match, onClose }: {
  trainer: ThirdSpaceTrainer; club: ThirdSpaceClub | undefined; match: ThirdSpaceMatch; onClose: () => void;
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
  return <dialog className="ts-profile-dialog" ref={dialog} aria-labelledby="ts-profile-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.article className="ts-profile" initial={{ x: reducedMotion ? 0 : 48, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.3 }}>
      <button ref={close} className="ts-icon-button ts-profile__close" aria-label="Close trainer profile" onClick={onClose}><X size={22} /></button>
      <div className="ts-profile__portrait"><img src={trainer.photoUrl} alt={trainer.name} /><div className="ts-profile__identity"><span>{club?.name}</span><h2 id="ts-profile-title">{trainer.name}</h2></div></div>
      <div className="ts-profile__body">
        <section><h3>Why you could work well together</h3><ul className="ts-reasons">{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section>
        <section><h3>About {trainer.name.split(" ")[0]}</h3><p className="ts-profile__bio">{trainer.bio || trainer.summary}</p>{trainer.tier ? <p className="ts-profile__tier">{trainer.tier === "elite" ? "Elite personal trainer" : "Personal trainer"}</p> : null}</section>
        {trainer.expertise.length > 0 ? <section><h3>Expertise</h3><ul className="ts-profile__list">{trainer.expertise.map((expertise) => <li key={expertise}>{expertise}</li>)}</ul></section> : null}
        {trainer.qualifications.length > 0 ? <section><h3>Qualifications</h3><ul className="ts-profile__list">{trainer.qualifications.map((qualification) => <li key={qualification}>{qualification}</li>)}</ul></section> : null}
        {club ? <section><h3>Your training location</h3><p className="ts-profile__club"><MapPin size={18} />Third Space {club.name}</p><p>{club.address}</p><p className="ts-muted">{match.locationReason}</p></section> : null}
        <p className="ts-profile__rates">Individual session prices and availability need confirming with the club.</p>
        <a className="ts-source-link" href={trainer.sourceUrl} target="_blank" rel="noopener noreferrer">View original Third Space profile <ArrowUpRight size={16} /><span className="ts-sr-only"> (opens in a new tab)</span></a>
      </div>
    </motion.article>
  </dialog>;
}
