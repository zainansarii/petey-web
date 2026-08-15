import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { TrainerCard } from "./TrainerCard";
import { TRAINERS } from "../data/trainers";

const AUTO_ADVANCE_MS = 4600;

export function LandingScreen({ onStart }: { onStart: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const transitionLocked = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const reducedMotion = useReducedMotion();
  const paused = interactionPaused || manuallyPaused;

  const move = (direction: number) => {
    setActiveIndex((current) => (current + direction + TRAINERS.length) % TRAINERS.length);
  };

  const start = () => {
    if (transitionLocked.current) return;
    transitionLocked.current = true;
    onStart();
  };

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => move(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " "].includes(event.key) && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const activeTrainer = TRAINERS[activeIndex];
  const nextTrainer = TRAINERS[(activeIndex + 1) % TRAINERS.length];

  return (
    <motion.main
      animate={{ opacity: 1 }}
      className="landing"
      initial={{ opacity: 0 }}
      onTouchEnd={(event) => {
        const startPoint = touchStart.current;
        const endPoint = event.changedTouches[0];
        touchStart.current = null;
        if (!startPoint || !endPoint) return;
        const deltaX = endPoint.clientX - startPoint.x;
        const deltaY = endPoint.clientY - startPoint.y;
        if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -46) start();
        else if (Math.abs(deltaX) > 46) move(deltaX < 0 ? 1 : -1);
      }}
      onTouchStart={(event) => {
        touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }}
      onWheel={(event) => {
        if (event.deltaY > 12) start();
      }}
      transition={{ duration: reducedMotion ? 0 : 0.35 }}
    >
      <header className="landing__header">
        <BrandMark className="landing__logo" />
        <span className="landing__header-note">Personal training, personally matched.</span>
      </header>

      <div className="landing__composition">
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="landing__copy"
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: reducedMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow">Meet your match</p>
          <h1>Your trainer is closer than you think.</h1>
          <p className="landing__lede">A shortlist shaped around your goals, schedule and the way you like to be coached.</p>
          <div className="landing__cta-row">
            <button className="primary-button" onClick={start} type="button">
              Find my trainer <ArrowRight aria-hidden="true" size={20} />
            </button>
            <span>No account needed to start</span>
          </div>
        </motion.section>

        <section
          aria-label="Trainer previews"
          aria-roledescription="carousel"
          className="hero-carousel"
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false);
          }}
          onFocusCapture={() => setInteractionPaused(true)}
          onMouseEnter={() => setInteractionPaused(true)}
          onMouseLeave={() => setInteractionPaused(false)}
        >
          <p aria-live="polite" className="sr-only">
            Showing {activeTrainer.name}, {activeTrainer.specialty}, {activeIndex + 1} of {TRAINERS.length}
          </p>
          <div aria-hidden="true" className="hero-carousel__word">MOVE</div>
          <motion.div
            animate={{ opacity: 0.42, rotate: 4, scale: 0.94, x: "9%", y: 8 }}
            aria-hidden="true"
            className="hero-carousel__card hero-carousel__card--behind"
            inert
            key={`behind-${nextTrainer.id}`}
            transition={{ duration: reducedMotion ? 0 : 0.45 }}
          >
            <TrainerCard decorative trainer={nextTrainer} />
          </motion.div>

          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              animate={{ opacity: 1, rotate: 0, scale: 1, x: 0 }}
              className="hero-carousel__card"
              drag={reducedMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              exit={{ opacity: 0, rotate: -3, scale: 0.96, x: -90 }}
              initial={{ opacity: 0, rotate: 3, scale: 0.97, x: 80 }}
              key={activeTrainer.id}
              onDragEnd={(event, info) => {
                const isTouch = "pointerType" in event
                  ? event.pointerType === "touch"
                  : "changedTouches" in event;
                if (isTouch) return;
                if (Math.abs(info.offset.x) > 60) move(info.offset.x < 0 ? 1 : -1);
              }}
              transition={{ duration: reducedMotion ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }}
            >
              <TrainerCard trainer={activeTrainer} />
            </motion.div>
          </AnimatePresence>

          <div className="hero-carousel__controls">
            <div aria-label={`Trainer ${activeIndex + 1} of ${TRAINERS.length}`} className="carousel-dots">
              {TRAINERS.map((trainer, index) => (
                <button
                  aria-label={`Show ${trainer.name}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  className={index === activeIndex ? "is-active" : ""}
                  key={trainer.id}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                />
              ))}
            </div>
            <div className="carousel-arrows">
              <button
                aria-label={manuallyPaused ? "Resume trainer carousel" : "Pause trainer carousel"}
                aria-pressed={manuallyPaused}
                onClick={() => setManuallyPaused((current) => !current)}
                type="button"
              >
                {manuallyPaused ? <Play aria-hidden="true" size={17} /> : <Pause aria-hidden="true" size={17} />}
              </button>
              <button aria-label="Previous trainer" onClick={() => move(-1)} type="button"><ChevronLeft size={20} /></button>
              <button aria-label="Next trainer" onClick={() => move(1)} type="button"><ChevronRight size={20} /></button>
            </div>
          </div>
        </section>
      </div>

      <button className="scroll-cue" onClick={start} type="button">
        <span>Scroll once to start</span>
        <span className="scroll-cue__icon"><ArrowDown aria-hidden="true" size={16} /></span>
      </button>
    </motion.main>
  );
}
