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
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePoundSterling,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { TrainerCard } from "../../discovery/components/TrainerCard";
import type { Trainer } from "../../discovery/model/trainer";
import type { MatchedTrainer } from "../../onboarding/model/onboarding";

export function FeedScreen({
  matches,
  onEditMatch,
  onHome,
}: {
  matches: MatchedTrainer[];
  onEditMatch: () => void;
  onHome: () => void;
}) {
  const trainers = matches.map(({ trainer }) => trainer);
  const [activeIndex, setActiveIndex] = useState(0);
  const [profileTrainer, setProfileTrainer] = useState<Trainer | null>(null);
  const [requestTrainer, setRequestTrainer] = useState<Trainer | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dialogTrigger, setDialogTrigger] = useState<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();
  const prefersReducedMotion = Boolean(reducedMotion);
  const visibleIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));
  const activeMatch = matches[visibleIndex];
  const activeTrainer = activeMatch?.trainer;

  const move = (direction: number) => {
    if (trainers.length < 2) return;
    setActiveIndex((current) => (current + direction + trainers.length) % trainers.length);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (profileTrainer || requestTrainer) return;
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
        </header>
        <section className="feed-empty" aria-live="polite">
          <h1>No compatible trainers yet.</h1>
          <p>Your training brief is saved. You can update your preferences and search the current selection again.</p>
          <button className="primary-button" onClick={onEditMatch} type="button">Update my preferences <ArrowRight aria-hidden="true" size={18} /></button>
        </section>
      </main>
    );
  }

  return (
    <main className="feed">
      <div
        aria-hidden={profileTrainer || requestTrainer ? true : undefined}
        className="feed__surface"
        inert={profileTrainer || requestTrainer ? true : undefined}
      >
        <header className="feed-header">
        <button aria-label="Petey home" className="feed-header__brand" onClick={onHome} type="button">
          <BrandMark />
        </button>
        <div className="feed-header__title">
          <span>Your shortlist</span>
          <small>{visibleIndex + 1} of {trainers.length}</small>
        </div>
        <button className="quiet-button" onClick={onEditMatch} type="button">Retune match</button>
        </header>

        <div className="feed-layout">
        <aside className="feed-intro">
          <h1>Your trainer matches.</h1>
          <p>{matches.length === 1 ? "One trainer fits" : `${matches.length} trainers fit`} your training preferences. Explore your shortlist.</p>
          <div className="feed-intro__signal">
            <Sparkles aria-hidden="true" size={18} />
            <span><strong>Why you match</strong>{activeMatch.reason}</span>
          </div>
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
          <div aria-hidden="true" className="feed-stage__count">0{visibleIndex + 1}</div>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              animate={{ opacity: 1, scale: 1, x: 0 }}
              className="feed-stage__card"
              drag={reducedMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              exit={{ opacity: 0, scale: 0.98, x: reducedMotion ? 0 : -50 }}
              initial={{ opacity: 0, scale: 0.98, x: reducedMotion ? 0 : 50 }}
              key={activeTrainer.id}
              onDragEnd={(_, info) => {
                if (Math.abs(info.offset.x) > 60) move(info.offset.x < 0 ? 1 : -1);
              }}
              transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <TrainerCard
                matchReason="Matched for you"
                onRequest={(trigger) => {
                  setDialogTrigger(trigger);
                  setRequestTrainer(activeTrainer);
                }}
                onView={(trigger) => {
                  setDialogTrigger(trigger);
                  setProfileTrainer(activeTrainer);
                }}
                trainer={activeTrainer}
                variant="feed"
              />
            </motion.div>
          </AnimatePresence>
        </section>

        <div className="feed-mobile-controls">
          <button aria-label="Previous trainer" onClick={() => move(-1)} type="button"><ChevronLeft size={20} /></button>
          <span>{visibleIndex + 1} / {trainers.length}</span>
          <button aria-label="Next trainer" onClick={() => move(1)} type="button"><ChevronRight size={20} /></button>
        </div>
        </div>
      </div>

      <AnimatePresence>
        {profileTrainer ? (
          <ProfileDialog onClose={() => setProfileTrainer(null)} onRequest={() => {
            setRequestTrainer(profileTrainer);
            setProfileTrainer(null);
          }} reducedMotion={prefersReducedMotion} returnFocusTo={dialogTrigger} trainer={profileTrainer} />
        ) : null}
        {requestTrainer ? (
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

function ProfileDialog({
  trainer,
  onClose,
  onRequest,
  reducedMotion,
  returnFocusTo,
}: {
  trainer: Trainer;
  onClose: () => void;
  onRequest: () => void;
  reducedMotion: boolean;
  returnFocusTo: HTMLButtonElement | null;
}) {
  return (
    <DialogShell
      label={`${trainer.name}'s ${trainer.isDemo ? "demo " : ""}profile`}
      onClose={onClose}
      reducedMotion={reducedMotion}
      returnFocusTo={returnFocusTo}
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="profile-dialog"
        exit={reducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        initial={reducedMotion ? false : { opacity: 0, y: 30 }}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <button aria-label="Close profile" autoFocus className="dialog-close" onClick={onClose} type="button"><X size={20} /></button>
        <div className="profile-dialog__photo">
          <img alt={`${trainer.isDemo ? "Demo portrait for" : "Portrait of"} ${trainer.name}`} src={trainer.photo} />
          <span><BadgeCheck aria-hidden="true" size={16} /> {trainer.isDemo ? "Demo profile" : "Trainer profile"}</span>
        </div>
        <div className="profile-dialog__body">
          <h2>{trainer.name}</h2>
          <p className="profile-dialog__bio">{trainer.bio}</p>
          <div className="profile-dialog__quick">
            <span><MapPin size={16} /><strong>{trainer.area}</strong>Training area</span>
            <span><CirclePoundSterling size={16} /><strong>From £{trainer.price}</strong>per session</span>
          </div>
          <ProfileSection icon={<Target size={17} />} title="Specialises in" items={[trainer.specialty, ...trainer.specialties]} />
          <ProfileSection icon={<Sparkles size={17} />} title="Coaching style" items={trainer.coachingStyles} />
          <ProfileSection icon={<CalendarDays size={17} />} title="Usually available" items={trainer.availability} />
          <ProfileSection icon={<MapPin size={17} />} title="Where you can train" items={trainer.venues} />
          <ProfileSection icon={<ShieldCheck size={17} />} title="Qualifications" items={trainer.qualifications} />
          <div className="profile-dialog__pricing">
            <span><small>Single session</small><strong>£{trainer.price}</strong></span>
            {trainer.tenPackPrice !== null ? <span><small>10 sessions</small><strong>£{trainer.tenPackPrice}</strong></span> : null}
            {trainer.monthlyPrice !== null ? <span><small>Monthly coaching</small><strong>£{trainer.monthlyPrice}</strong></span> : null}
          </div>
          <button className="primary-button profile-dialog__cta" onClick={onRequest} type="button">
            Preview intro request <ArrowRight aria-hidden="true" size={18} />
          </button>
          <p className="demo-disclosure">{trainer.isDemo ? "Illustrative profile, pricing and availability. " : ""}Intro requests are a preview; no trainer is contacted.</p>
        </div>
      </motion.div>
    </DialogShell>
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
  const [shareGoal, setShareGoal] = useState(false);
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
        <h2>Draft your hello.</h2>
        <p>Preview your introduction. Nothing you write or select is sent or saved.</p>
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
        <div className="request-dialog__sharing">
          <p>Include in this preview</p>
          <ToggleShare checked={shareGoal} label="Primary goal" onChange={setShareGoal} />
        </div>
        <div aria-live="polite" className="flow-error">{error ?? <span>&nbsp;</span>}</div>
        <button className="primary-button request-dialog__submit" type="submit">
          <MessageCircle aria-hidden="true" size={17} /> Complete preview
        </button>
      </motion.form>
    </DialogShell>
  );
}

function ToggleShare({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="share-toggle">
      <span>{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span aria-hidden="true" className="share-toggle__track"><span /></span>
    </label>
  );
}
