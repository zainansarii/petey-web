import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, MapPin, ShieldCheck } from "lucide-react";
import { BrandMark } from "../../../shared/ui/BrandMark";
import { ChoiceGroup } from "../../../shared/ui/ChoiceGroup";
import { AvailabilityGrid } from "../../../shared/ui/AvailabilityGrid";
import { requestMagicLink } from "../../auth/api/magicLink";
import {
  BUDGET_OPTIONS,
  COACHING_OPTIONS,
  EXPERIENCE_OPTIONS,
  formatDobInput,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  ONBOARDING_STEPS,
  normalizePostcode,
  stepError,
  VENUE_OPTIONS,
  type IdentityAnswers,
  type MatchingAnswers,
} from "../model/onboarding";

type OnboardingFlowProps = {
  answers: MatchingAnswers;
  identity: IdentityAnswers;
  initialStep?: number;
  onAnswersChange: (answers: MatchingAnswers) => void;
  onExit: () => void;
  onIdentityChange: (identity: IdentityAnswers) => void;
  onMagicLinkRequested: (email: string, mode: "sent" | "preview") => void;
};

export function OnboardingFlow({
  answers,
  identity,
  initialStep = 0,
  onAnswersChange,
  onExit,
  onIdentityChange,
  onMagicLinkRequested,
}: OnboardingFlowProps) {
  const [step, setStep] = useState(Math.min(initialStep, ONBOARDING_STEPS.length - 1));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const reducedMotion = useReducedMotion();
  const stepCopy = ONBOARDING_STEPS[step];
  const isLastStep = step === ONBOARDING_STEPS.length - 1;
  const progress = ((step + 1) / ONBOARDING_STEPS.length) * 100;

  const patchAnswers = (patch: Partial<MatchingAnswers>) => {
    setError(null);
    onAnswersChange({ ...answers, ...patch });
  };

  const patchIdentity = (patch: Partial<IdentityAnswers>) => {
    setError(null);
    onIdentityChange({ ...identity, ...patch });
  };

  const previous = () => {
    if (submitting) return;
    setError(null);
    if (step === 0) {
      onExit();
      return;
    }
    setDirection(-1);
    setStep((current) => current - 1);
  };

  const advance = async (event?: FormEvent) => {
    event?.preventDefault();
    const validationError = stepError(step, answers, identity);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isLastStep) {
      setDirection(1);
      setError(null);
      setStep((current) => current + 1);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const normalizedEmail = identity.email.trim().toLowerCase();
      const mode = await requestMagicLink(normalizedEmail);
      onMagicLinkRequested(normalizedEmail, mode);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't send the sign-in link. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) previous();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main className="onboarding-shell">
      <header className="flow-header">
        <BrandMark className="flow-header__logo" />
        <div className="flow-header__controls">
          <button aria-label="Back" className="icon-button flow-header__back" disabled={submitting} onClick={previous} type="button">
            <ArrowLeft size={20} />
          </button>
          <div aria-hidden="true" className="flow-progress">
            <motion.span animate={{ width: `${progress}%` }} transition={{ duration: reducedMotion ? 0 : 0.35 }} />
          </div>
          <span className="flow-header__step">{String(step + 1).padStart(2, "0")} / {String(ONBOARDING_STEPS.length).padStart(2, "0")}</span>
        </div>
      </header>

      <div className="onboarding-layout">
        <section className="onboarding-stage">
          <form className="onboarding-form" onSubmit={advance}>
            <AnimatePresence initial={false} mode="wait" custom={direction}>
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="onboarding-step"
                custom={direction}
                exit={{ opacity: 0, x: reducedMotion ? 0 : direction * -28 }}
                initial={{ opacity: 0, x: reducedMotion ? 0 : direction * 28 }}
                key={step}
                transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <StepHeading subtitle={stepCopy.subtitle} title={stepCopy.title} />

                <StepFields
                  answers={answers}
                  identity={identity}
                  patchAnswers={patchAnswers}
                  patchIdentity={patchIdentity}
                  step={step}
                />
              </motion.div>
            </AnimatePresence>

            <div aria-live="polite" className="flow-error" role={error ? "alert" : undefined}>
              {error ?? <span>&nbsp;</span>}
            </div>

            <footer className="flow-footer">
              {step === 5
                && answers.goal !== "recover_from_injury"
                && !answers.medicalNote.trim()
                && !answers.biggestObstacle.trim() ? (
                <button
                  className="text-button"
                  onClick={() => {
                    setDirection(1);
                    setStep(6);
                  }}
                  type="button"
                >
                  Skip for now
                </button>
              ) : <span />}
              <button className="primary-button" disabled={submitting} type="submit">
                {isLastStep ? (submitting ? "Sending link…" : "Email my secure link") : "Continue"}
                {!submitting ? <ArrowRight aria-hidden="true" size={19} /> : null}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </main>
  );
}

function StepHeading({ subtitle, title }: { subtitle: string; title: string }) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="onboarding-step__heading">
      <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function StepFields({
  step,
  answers,
  identity,
  patchAnswers,
  patchIdentity,
}: {
  step: number;
  answers: MatchingAnswers;
  identity: IdentityAnswers;
  patchAnswers: (patch: Partial<MatchingAnswers>) => void;
  patchIdentity: (patch: Partial<IdentityAnswers>) => void;
}) {
  if (step === 0) {
    return (
      <ChoiceGroup
        ariaLabel="Primary goal"
        columns={2}
        onChange={(goal) => patchAnswers({ goal: goal as MatchingAnswers["goal"] })}
        options={GOAL_OPTIONS}
        value={answers.goal}
      />
    );
  }

  if (step === 1) {
    return (
      <div className="field-stack">
        <fieldset className="field-group">
          <legend>Where are you starting from?</legend>
          <ChoiceGroup
            ariaLabel="Training experience"
            onChange={(experience) => patchAnswers({ experience: experience as MatchingAnswers["experience"] })}
            options={EXPERIENCE_OPTIONS}
            value={answers.experience}
          />
        </fieldset>
        <fieldset className="field-group">
          <legend>What gets the best from you?</legend>
          <ChoiceGroup
            ariaLabel="Coaching preference"
            onChange={(coachingStyle) => patchAnswers({ coachingStyle: coachingStyle as MatchingAnswers["coachingStyle"] })}
            options={COACHING_OPTIONS}
            value={answers.coachingStyle}
          />
        </fieldset>
      </div>
    );
  }

  if (step === 2) {
    const hasNoGenderPreference = answers.trainerGenders.length === 0
      || answers.trainerGenders.length === GENDER_OPTIONS.length;
    return (
      <div className="field-stack">
        <fieldset className="field-group">
          <legend>Monthly budget</legend>
          <ChoiceGroup
            ariaLabel="Monthly budget"
            onChange={(budget) => patchAnswers({ budget: budget as MatchingAnswers["budget"] })}
            options={BUDGET_OPTIONS}
            value={answers.budget}
          />
        </fieldset>
        <fieldset className="field-group field-group--compact">
          <legend>Trainer preference <span>Optional</span></legend>
          <ChoiceGroup
            ariaLabel="Trainer gender preference"
            columns={3}
            multiple
            onChange={(trainerGenders) => patchAnswers({ trainerGenders: trainerGenders as MatchingAnswers["trainerGenders"] })}
            options={GENDER_OPTIONS}
            value={answers.trainerGenders}
          />
          <p className="field-hint">{hasNoGenderPreference ? "No preference — everyone is included." : "Your preference will influence the shortlist order."}</p>
        </fieldset>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="field-stack">
        <label className="input-field">
          <span>Home postcode</span>
          <div className="input-field__control">
            <MapPin aria-hidden="true" size={19} />
            <input
              autoComplete="postal-code"
              inputMode="text"
              maxLength={8}
              onBlur={(event) => patchAnswers({ postcode: normalizePostcode(event.target.value) })}
              onChange={(event) => patchAnswers({ postcode: event.target.value.toUpperCase() })}
              placeholder="e.g. SW11 3AA"
              value={answers.postcode}
            />
          </div>
        </label>
        <fieldset className="field-group field-group--compact">
          <legend>I could train at</legend>
          <ChoiceGroup
            ariaLabel="Training venues"
            columns={3}
            multiple
            onChange={(venues) => patchAnswers({ venues: venues as MatchingAnswers["venues"] })}
            options={VENUE_OPTIONS}
            value={answers.venues}
          />
        </fieldset>
        <label className="range-field">
          <span><strong>Travel up to</strong><output>{answers.travelKm} km</output></span>
          <input
            aria-label="Maximum travel distance"
            max="25"
            min="5"
            onChange={(event) => patchAnswers({ travelKm: Number(event.target.value) })}
            step="1"
            type="range"
            value={answers.travelKm}
          />
          <span className="range-field__labels"><span>5 km</span><span>25 km</span></span>
        </label>
      </div>
    );
  }

  if (step === 4) {
    return <AvailabilityGrid onChange={(availability) => patchAnswers({ availability })} value={answers.availability} />;
  }

  if (step === 5) {
    const needsHealthConsent = answers.goal === "recover_from_injury" || answers.medicalNote.trim().length > 0;
    return (
      <div className="field-stack">
        <label className="textarea-field">
          <span>Injuries or medical context <small>Optional</small></span>
          <textarea
            maxLength={400}
            onChange={(event) => patchAnswers({ medicalNote: event.target.value, healthConsent: event.target.value ? answers.healthConsent : false })}
            placeholder="Only share what a trainer should know."
            rows={3}
            value={answers.medicalNote}
          />
          <small>{answers.medicalNote.length} / 400</small>
        </label>
        <label className="textarea-field">
          <span>What usually gets in the way? <small>Optional</small></span>
          <textarea
            maxLength={800}
            onChange={(event) => patchAnswers({ biggestObstacle: event.target.value })}
            placeholder="e.g. I know what to do, but consistency is hard."
            rows={3}
            value={answers.biggestObstacle}
          />
          <small>{answers.biggestObstacle.length} / 800</small>
        </label>
        {needsHealthConsent ? (
          <label className="consent-row">
            <input
              checked={answers.healthConsent}
              onChange={(event) => patchAnswers({ healthConsent: event.target.checked })}
              type="checkbox"
            />
            <span className="consent-row__box"><Check size={15} strokeWidth={3} /></span>
            <span>I explicitly consent to Petey storing this health information for safe training and sharing it only with trainers I choose.</span>
          </label>
        ) : null}
      </div>
    );
  }

  return (
    <div className="identity-fields">
      <div className="identity-fields__privacy">
        <ShieldCheck aria-hidden="true" size={20} />
        <span>Your matching answers are ready. Identity and sign-in come last; this prototype keeps these details only in this browser tab.</span>
      </div>
      <label className="input-field">
        <span>Full name</span>
        <input
          autoComplete="name"
          maxLength={100}
          onChange={(event) => patchIdentity({ fullName: event.target.value })}
          placeholder="Your name"
          value={identity.fullName}
        />
      </label>
      <label className="input-field">
        <span>Date of birth</span>
        <input
          autoComplete="bday"
          inputMode="numeric"
          maxLength={10}
          onChange={(event) => patchIdentity({ dateOfBirth: formatDobInput(event.target.value) })}
          placeholder="DD/MM/YYYY"
          type="text"
          value={identity.dateOfBirth}
        />
        <small>You must be 18 or over. Your date of birth stays private.</small>
      </label>
      <label className="input-field">
        <span>Email address</span>
        <input
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          onChange={(event) => patchIdentity({ email: event.target.value })}
          placeholder="you@example.com"
          type="email"
          value={identity.email}
        />
        <small>No password. We’ll send one secure sign-in link.</small>
      </label>
    </div>
  );
}
