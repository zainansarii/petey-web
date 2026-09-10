import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import "./feed.css";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { TrainerCard } from "../../discovery/components/TrainerCard";
import { TrainerAvailability } from "./TrainerAvailability";
import { EnquiryComposer } from "../../marketplace/EnquiryComposer";
import { marketplace } from "../../marketplace/api";
import type { Trainer } from "../../discovery/model/trainer";
import { MATCH_DEALBREAKER_LABELS, type MatchedTrainer, type MatchDealbreakers } from "../../onboarding/model/onboarding";

function InboxLink() {
  return <a className="quiet-button feed-header__inbox" href={`${import.meta.env.BASE_URL}messages/`}>
    <MessageCircle aria-hidden="true" size={17} /><span>Inbox</span>
  </a>;
}

export function FeedScreen({
  matches,
  onEditMatch,
  onHome,
  liveEnquiries = false,
}: {
  matches: MatchedTrainer[];
  onEditMatch: () => void;
  onHome: () => void;
  liveEnquiries?: boolean;
}) {
  const trainers = matches.map(({ trainer }) => trainer);
  const [activeIndex, setActiveIndex] = useState(0);
  const [requestTrainer, setRequestTrainer] = useState<Trainer | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [enabledTrainerIds, setEnabledTrainerIds] = useState<string[]>([]);
  const matchIds = matches.map(match => match.trainer.id).join(",");
  useEffect(() => {
    if (!liveEnquiries) return;
    let alive = true;
    const refresh = () => { void marketplace<{ trainerIds: string[] }>({ action: "availability", trainerIds: matchIds ? matchIds.split(",") : [] }).then(result => { if (alive) setEnabledTrainerIds(result.trainerIds); }).catch(() => { if (alive) setEnabledTrainerIds([]); }); };
    refresh(); window.addEventListener("focus", refresh);
    return () => { alive = false; window.removeEventListener("focus", refresh); };
  }, [liveEnquiries, matchIds]);
  const [dialogTrigger, setDialogTrigger] = useState<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();
  const prefersReducedMotion = Boolean(reducedMotion);
  const visibleIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));
  const activeMatch = matches[visibleIndex];
  const activeTrainer = activeMatch?.trainer;
  const showingClosest = activeMatch?.matchKind === "closest";

  const move = (direction: number) => {
    if (trainers.length < 2) return;
    setActiveIndex((current) => (current + direction + trainers.length) % trainers.length);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (requestTrainer || (event.target instanceof HTMLElement && event.target.closest("input, textarea, select"))) return;
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!activeTrainer) {
    return (
      <main className="feed feed--empty">
        <header className="feed-header">
          <button aria-label="Petey home" className="feed-header__brand" onClick={onHome} type="button"><BrandMark /></button>
          <div className="feed-header__title"><span>Your shortlist</span><small>0 matches</small></div>
          <div className="feed-header__actions">
            {liveEnquiries && <InboxLink />}
          </div>
        </header>
        <section className="feed-empty" aria-live="polite">
          <h1>No trainers available yet</h1>
          <p>Your training brief is saved. There are no available profiles to show right now. You can update your preferences and search again.</p>
          <button className="primary-button" onClick={onEditMatch} type="button">Update my preferences <ArrowRight aria-hidden="true" size={18} /></button>
        </section>
      </main>
    );
  }

  return (
    <main className="feed">
      <div
        aria-hidden={requestTrainer ? true : undefined}
        className="feed__surface"
        inert={requestTrainer ? true : undefined}
      >
        <header className="feed-header">
          <button aria-label="Petey home" className="feed-header__brand" onClick={onHome} type="button">
            <BrandMark />
          </button>
          <div className="feed-header__title">
            <span>Your shortlist</span>
            <small>{visibleIndex + 1} of {trainers.length}</small>
          </div>
          <div className="feed-header__actions">
            <button className="quiet-button" onClick={onEditMatch} type="button">Retune match</button>
            {liveEnquiries && <InboxLink />}
          </div>
        </header>

        <div className="feed-layout">
          <aside className="feed-intro">
            <h1>{showingClosest ? "Your closest options" : "Your trainer matches"}</h1>
            <p>{showingClosest
              ? "We couldn’t find a close enough match for all your preferences. These are the closest options, with the differences explained."
              : `${matches.length === 1 ? "One trainer fits" : `${matches.length} trainers fit`} your training preferences. Explore your shortlist.`}</p>
            <div className="feed-intro__controls">
              <button aria-label="Previous trainer" onClick={() => move(-1)} type="button"><ChevronLeft size={21} /></button>
              <div className="carousel-dots">
                {trainers.map((trainer, index) => (
                  <button
                    aria-label={`Show ${trainer.name}`}
                    aria-current={index === visibleIndex ? "true" : undefined}
                    className={index === visibleIndex ? "is-active" : ""}
                    key={trainer.id}
                    onClick={() => setActiveIndex(index)}
                    type="button"
                  />
                ))}
              </div>
              <button aria-label="Next trainer" onClick={() => move(1)} type="button"><ChevronRight size={21} /></button>
            </div>
          </aside>

          <section className="feed-stage" aria-live="polite">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className="feed-stage__pair"
                exit={{ opacity: 0, scale: 0.98, x: reducedMotion ? 0 : -50 }}
                initial={{ opacity: 0, scale: 0.98, x: reducedMotion ? 0 : 50 }}
                key={activeTrainer.id}
                transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.div
                  className="feed-stage__card"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={prefersReducedMotion ? 0 : 0.15}
                  onDragEnd={(_, info) => {
                    if (Math.abs(info.offset.x) > 60) move(info.offset.x < 0 ? 1 : -1);
                  }}
                >
                  <TrainerCard trainer={activeTrainer} variant="feed" />
                </motion.div>
                <div className="feed-mobile-controls">
                  <button aria-label="Previous trainer" onClick={() => move(-1)} type="button"><ChevronLeft size={20} /></button>
                  <span>{visibleIndex + 1} / {trainers.length}</span>
                  <button aria-label="Next trainer" onClick={() => move(1)} type="button"><ChevronRight size={20} /></button>
                </div>
                <div className="feed-stage__back">
                  <TrainerDetails
                    trainer={activeTrainer}
                    match={activeMatch}
                    liveEnquiries={liveEnquiries}
                    enquiryEnabled={enabledTrainerIds.includes(activeTrainer.id)}
                    onRequest={(trigger) => {
                      setDialogTrigger(trigger);
                      setRequestTrainer(activeTrainer);
                    }}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </section>

        </div>
      </div>

      <AnimatePresence>
        {requestTrainer && liveEnquiries ? <EnquiryComposer trainerId={requestTrainer.id} trainerName={requestTrainer.name} onClose={() => { setRequestTrainer(null); dialogTrigger?.focus(); }} /> : requestTrainer ? (
          <RequestDialog
            onClose={() => setRequestTrainer(null)}
            onPreviewComplete={() => {
              setToast(`Preview complete — nothing was sent to ${requestTrainer.name}.`);
              setRequestTrainer(null);
            }}
            reducedMotion={prefersReducedMotion}
            returnFocusTo={dialogTrigger}
            trainer={requestTrainer}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="toast"
            exit={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            role="status"
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          >
            <Check aria-hidden="true" size={18} strokeWidth={3} /> {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0,
  );
}

function DialogShell({
  children,
  onClose,
  label,
  reducedMotion,
  returnFocusTo,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
  reducedMotion: boolean;
  returnFocusTo: HTMLButtonElement | null;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      (focusableElements(dialog)[0] ?? dialog).focus();
    }

    return () => {
      window.requestAnimationFrame(() => {
        const anotherDialogIsOpen = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (!anotherDialogIsOpen && returnFocusTo?.isConnected) returnFocusTo.focus();
      });
    };
  }, [returnFocusTo]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = focusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const focused = document.activeElement;
    if (event.shiftKey && (focused === first || !dialog.contains(focused))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (focused === last || !dialog.contains(focused))) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-label={label}
      aria-modal="true"
      className="dialog-backdrop"
      exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      initial={reducedMotion ? false : { opacity: 0 }}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}
    >
      {children}
    </motion.div>
  );
}

function TrainerDetails({ trainer, match, onRequest, liveEnquiries, enquiryEnabled }: {
  trainer: Trainer;
  match: MatchedTrainer;
  onRequest: (trigger: HTMLButtonElement) => void;
  liveEnquiries: boolean;
  enquiryEnabled: boolean;
}) {
  return (
    <section aria-label={`${trainer.name}'s profile details`} className="trainer-details" tabIndex={0}>
      <div className="trainer-details__body">
        <h2>About {trainer.name.split(" ")[0]}</h2>
        <p className="trainer-details__bio">{trainer.bio}</p>
        <div className="trainer-details__match">
          <h3><Sparkles aria-hidden="true" size={18} />{match.matchKind === "closest" ? "Why consider this trainer" : "Why you match"}</h3>
          <p>{match.reason}</p>
          {match.dealbreakers ? <MatchPriorities dealbreakers={match.dealbreakers} tradeoffs={match.tradeoffs ?? []} /> : null}
        </div>
        <ProfileSection icon={<Target aria-hidden="true" size={17} />} title="Specialises in" items={[...new Set([trainer.specialty, ...trainer.specialties])]} />
        <ProfileSection icon={<Sparkles aria-hidden="true" size={17} />} title="Coaching style" items={trainer.coachingStyles} />
        {trainer.coachingStyleNotes ? <p className="trainer-details__bio">{trainer.coachingStyleNotes}</p> : null}
        <TrainerAvailability availability={[...trainer.availability, ...(trainer.availabilityNotes ? [trainer.availabilityNotes] : [])]} />
        <ProfileSection icon={<MapPin aria-hidden="true" size={17} />} title="Where you can train" items={[trainer.area, ...trainer.venues]} />
        {trainer.serviceAreaNotes ? <p className="trainer-details__bio">{trainer.serviceAreaNotes}</p> : null}
        <ProfileSection icon={<ShieldCheck aria-hidden="true" size={17} />} title="Qualifications" items={trainer.qualifications} />
        {trainer.experience ? <p className="trainer-details__bio">Experience: {trainer.experience}</p> : null}
        {trainer.professionalUrl ? <p><a href={trainer.professionalUrl} target="_blank" rel="noopener noreferrer">Professional website or social profile</a></p> : null}
        <dl className="trainer-details__pricing">
          <div><dt>Single session{trainer.sessionDurationMinutes ? ` · ${trainer.sessionDurationMinutes} minutes` : ""}</dt><dd>£{trainer.price}</dd></div>
          {trainer.tenPackPrice !== null ? <div><dt>10 sessions</dt><dd>£{trainer.tenPackPrice}</dd></div> : null}
          {trainer.monthlyPrice !== null ? <div><dt>Monthly coaching</dt><dd>£{trainer.monthlyPrice}</dd></div> : null}
        </dl>
        {trainer.pricingNotes ? <p className="trainer-details__bio">{trainer.pricingNotes}</p> : null}
        <button className="primary-button trainer-details__cta" disabled={liveEnquiries && !enquiryEnabled} onClick={(event) => onRequest(event.currentTarget)} type="button">
          {liveEnquiries ? enquiryEnabled ? "Send an enquiry" : "Enquiries unavailable" : "Preview intro request"} <ArrowRight aria-hidden="true" size={18} />
        </button>
        <p className="trainer-details__disclosure">{liveEnquiries ? enquiryEnabled ? "Review what you share before sending. Continue the conversation in Petey." : "This trainer is not currently accepting enquiries through the pilot." : `${trainer.isDemo ? "Illustrative profile, pricing and availability. " : ""}Intro requests are a preview; no trainer is contacted.`}</p>
      </div>
    </section>
  );
}

function MatchPriorities({ dealbreakers, tradeoffs }: { dealbreakers: MatchDealbreakers; tradeoffs: string[] }) {
  const entries = Object.entries(dealbreakers) as [keyof MatchDealbreakers, MatchDealbreakers[keyof MatchDealbreakers]][];
  const required = entries.filter(([, status]) => status !== "not_required");
  return (
    <div className="match-priorities">
      {required.length ? <section aria-label="Dealbreakers">
        <h4>Dealbreakers</h4>
        <ul>{required.map(([key, status]) => <li key={key}>
          <strong>{MATCH_DEALBREAKER_LABELS[key]}</strong>: {status === "met" ? "Fits" : status === "not_met" ? "Doesn’t meet your requirement" : "Needs confirming"}
        </li>)}</ul>
      </section> : null}
      {tradeoffs.length ? <section aria-label="Preference differences">
        <h4>Preference differences</h4>
        <ul>{tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul>
      </section> : null}
    </div>
  );
}

function ProfileSection({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <section className="profile-section">
      <h3>{icon}{title}</h3>
      <div>{items.map((item) => <span key={item}>{item}</span>)}</div>
    </section>
  );
}

function RequestDialog({
  trainer,
  onClose,
  onPreviewComplete,
  reducedMotion,
  returnFocusTo,
}: {
  trainer: Trainer;
  onClose: () => void;
  onPreviewComplete: () => void;
  reducedMotion: boolean;
  returnFocusTo: HTMLButtonElement | null;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const length = message.trim().length;
    if (length < 10 || length > 500) {
      setError("Write a short introduction between 10 and 500 characters.");
      return;
    }
    onPreviewComplete();
  };

  return (
    <DialogShell
      label={`Preview an introduction to ${trainer.name}`}
      onClose={onClose}
      reducedMotion={reducedMotion}
      returnFocusTo={returnFocusTo}
    >
      <motion.form
        animate={{ opacity: 1, y: 0 }}
        className="request-dialog"
        exit={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        initial={reducedMotion ? false : { opacity: 0, y: 30 }}
        onSubmit={submit}
        transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <button aria-label="Close request" className="dialog-close" onClick={onClose} type="button"><X size={20} /></button>
        <div className="request-dialog__trainer">
          <img alt="" src={trainer.photo} />
          <span><small>Preview with</small><strong>{trainer.name}</strong></span>
        </div>
        <h2>Draft your hello</h2>
        <p>Preview your introduction. Nothing you write is sent or saved.</p>
        <label className="textarea-field">
          <span>Your introduction</span>
          <textarea
            autoFocus
            maxLength={500}
            onChange={(event) => { setMessage(event.target.value); setError(null); }}
            placeholder={`Hi ${trainer.name.split(" ")[0]}, I’m looking for help with…`}
            rows={5}
            value={message}
          />
          <small>{message.length} / 500</small>
        </label>
        <div aria-live="polite" className="flow-error">{error ?? <span>&nbsp;</span>}</div>
        <button className="primary-button request-dialog__submit" type="submit">
          <MessageCircle aria-hidden="true" size={17} /> Complete preview
        </button>
      </motion.form>
    </DialogShell>
  );
}
