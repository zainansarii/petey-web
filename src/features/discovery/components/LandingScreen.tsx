import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { TrainerCard } from "./TrainerCard";
import { TRAINERS } from "../data/trainers";

const AUTO_ADVANCE_MS = 5000;
const CAROUSEL_SPRING = {
  type: "spring" as const,
  stiffness: 220,
  damping: 28,
  mass: 0.95,
};

type CarouselSlot = -2 | -1 | 0 | 1 | 2;

const cardRailPose = (slot: CarouselSlot) => ({
  opacity: slot === 0 ? 1 : Math.abs(slot) === 1 ? 0.42 : 0,
  scale: slot === 0 ? 1 : Math.abs(slot) === 1 ? 0.7 : 0.62,
  x: `${slot * 30}%`,
  y: 0,
});

const trainerIndexAt = (position: number) => (
  (position % TRAINERS.length + TRAINERS.length) % TRAINERS.length
);

export function LandingScreen({ onStart }: { onStart: () => void }) {
  const [carouselPosition, setCarouselPosition] = useState(0);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const transitionLocked = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const reducedMotion = useReducedMotion();
  const activeIndex = trainerIndexAt(carouselPosition);
  const activeTrainer = TRAINERS[activeIndex];

  const move = useCallback((nextDirection: number) => {
    setCarouselPosition((current) => current + nextDirection);
  }, []);

  const moveManually = useCallback((nextDirection: number) => {
    move(nextDirection);
  }, [move]);

  const start = () => {
    if (transitionLocked.current) return;
    transitionLocked.current = true;
    onStart();
  };

  useEffect(() => {
    if (interactionPaused || reducedMotion) return;
    const timer = window.setTimeout(() => {
      move(1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [carouselPosition, interactionPaused, move, reducedMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLButtonElement) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveManually(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveManually(-1);
        return;
      }
      if (["ArrowDown", "PageDown", " "].includes(event.key) && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const visibleCards = ([-2, -1, 0, 1, 2] as CarouselSlot[]).map((slot) => ({
    slot,
    trainer: TRAINERS[trainerIndexAt(carouselPosition + slot)],
    virtualIndex: carouselPosition + slot,
  }));

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
        else if (Math.abs(deltaX) > 46) moveManually(deltaX < 0 ? 1 : -1);
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
      </header>

      <div className="landing__composition">
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="landing__copy"
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: reducedMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1>Find your personal trainer.</h1>
          <p className="landing__lede">We find the best match for your goals, schedule and the way you like to be coached.</p>
          <div className="landing__cta-row">
            <button className="primary-button" onClick={start} type="button">
              Find my trainer <ArrowRight aria-hidden="true" size={20} />
            </button>
            <button className="primary-button landing__trainer-cta" type="button">
              I'm a personal trainer <ArrowRight aria-hidden="true" size={20} />
            </button>
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
          tabIndex={0}
        >
          <p aria-atomic="true" aria-live="polite" className="sr-only">
            Showing {activeTrainer.name}, {activeTrainer.specialty}, {activeIndex + 1} of {TRAINERS.length}
          </p>
          {visibleCards.map(({ trainer, slot, virtualIndex }) => {
              const isActive = slot === 0;
              const isVisibleSide = Math.abs(slot) === 1;

              return (
                <motion.div
                  animate={cardRailPose(slot)}
                  aria-hidden={isActive ? undefined : true}
                  className={`hero-carousel__card hero-carousel__card--${isActive ? "active" : isVisibleSide ? "side" : "offstage"}`}
                  data-carousel-slot={slot}
                  drag={isActive && !reducedMotion ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  dragMomentum={false}
                  inert={isActive ? undefined : true}
                  initial={false}
                  key={virtualIndex}
                  onDragEnd={(event, info) => {
                    const isTouch = "pointerType" in event
                      ? event.pointerType === "touch"
                      : "changedTouches" in event;
                    if (isTouch) return;
                    if (Math.abs(info.offset.x) > 54 || Math.abs(info.velocity.x) > 520) {
                      moveManually(info.offset.x < 0 || info.velocity.x < -520 ? 1 : -1);
                    }
                  }}
                  style={{ zIndex: isActive ? 3 : 1 }}
                  transition={reducedMotion ? { duration: 0 } : {
                    ...CAROUSEL_SPRING,
                    opacity: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                  }}
                  whileDrag={isActive && !reducedMotion ? { cursor: "grabbing", scale: 0.985 } : undefined}
                >
                  <TrainerCard trainer={trainer} />
                </motion.div>
              );
            })}

        </section>
      </div>

      <button aria-label="Start matching" className="scroll-cue" onClick={start} type="button">
        <span className="scroll-cue__icon"><ArrowDown aria-hidden="true" size={16} /></span>
      </button>
    </motion.main>
  );
}
