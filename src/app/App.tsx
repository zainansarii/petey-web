import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { CheckEmailScreen } from "../features/auth/components/CheckEmailScreen";
import {
  finishMagicLink,
  observeFirebaseAuthSession,
  type FinishMagicLinkResult,
} from "../features/auth/api/magicLink";
import { LandingScreen } from "../features/discovery/components/LandingScreen";
import { FeedScreen } from "../features/feed/components/FeedScreen";
import { OnboardingFlow } from "../features/onboarding/components/OnboardingFlow";
import {
  INITIAL_IDENTITY_ANSWERS,
  loadMatchingDraft,
  saveMatchingDraft,
  type IdentityAnswers,
  type MatchingAnswers,
} from "../features/onboarding/model/onboarding";
import { BrandMark } from "../shared/ui/BrandMark";

type AppPhase = "landing" | "onboarding" | "check-email" | "feed" | "auth-loading" | "auth-error";

const hasMagicLinkReturn = () => new URLSearchParams(window.location.search).has("finishSignUp");

export function App() {
  const [phase, setPhase] = useState<AppPhase>(() => hasMagicLinkReturn() ? "auth-loading" : "landing");
  const [answers, setAnswers] = useState<MatchingAnswers>(loadMatchingDraft);
  const [identity, setIdentity] = useState<IdentityAnswers>(INITIAL_IDENTITY_ANSWERS);
  const [onboardingStartStep, setOnboardingStartStep] = useState(0);
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState(false);
  const [authResult, setAuthResult] = useState<FinishMagicLinkResult | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (hasMagicLinkReturn()) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void observeFirebaseAuthSession((isSignedIn) => {
      if (active && isSignedIn) setPhase("feed");
    }).then((stopObserving) => {
      if (active) unsubscribe = stopObserving;
      else stopObserving();
    }).catch(() => {
      // Public landing and prototype mode stay available if auth restoration fails.
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (phase !== "auth-loading") return;
    let cancelled = false;

    void finishMagicLink().then((result) => {
      if (cancelled) return;
      setAuthResult(result);
      if (result === "signed-in") setPhase("feed");
      else if (result === "ignored") {
        window.history.replaceState({}, document.title, window.location.pathname);
        setPhase("landing");
      }
      else setPhase("auth-error");
    });

    return () => {
      cancelled = true;
    };
  }, [phase]);

  const updateAnswers = (next: MatchingAnswers) => {
    setAnswers(next);
    saveMatchingDraft(next);
  };

  return (
    <div className="app-shell">
      <AnimatePresence initial={false} mode="wait">
        {phase === "landing" ? (
          <motion.div
            className="screen-frame"
            exit={{ opacity: 0, y: reducedMotion ? 0 : -22 }}
            key="landing"
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <LandingScreen onStart={() => {
              setOnboardingStartStep(0);
              setPhase("onboarding");
            }} />
          </motion.div>
        ) : null}

        {phase === "onboarding" ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="screen-frame"
            exit={{ opacity: 0, y: reducedMotion ? 0 : -18 }}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 28 }}
            key={`onboarding-${onboardingStartStep}`}
            transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <OnboardingFlow
              answers={answers}
              identity={identity}
              initialStep={onboardingStartStep}
              onAnswersChange={updateAnswers}
              onExit={() => setPhase("landing")}
              onIdentityChange={setIdentity}
              onMagicLinkRequested={(requestedEmail, mode) => {
                setEmail(requestedEmail);
                setPreview(mode === "preview");
                setPhase("check-email");
              }}
            />
          </motion.div>
        ) : null}

        {phase === "check-email" ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="screen-frame"
            initial={{ opacity: 0 }}
            key="check-email"
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <CheckEmailScreen
              email={email}
              onBack={() => {
                setOnboardingStartStep(6);
                setPhase("onboarding");
              }}
              onPreviewFeed={() => setPhase("feed")}
              preview={preview}
            />
          </motion.div>
        ) : null}

        {phase === "feed" ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="screen-frame"
            initial={{ opacity: 0 }}
            key="feed"
            transition={{ duration: reducedMotion ? 0 : 0.24 }}
          >
            <FeedScreen
              answers={answers}
              onEditMatch={() => {
                setOnboardingStartStep(0);
                setPhase("onboarding");
              }}
              onHome={() => setPhase("landing")}
              preview={preview}
            />
          </motion.div>
        ) : null}

        {phase === "auth-loading" ? (
          <StatusScreen key="auth-loading">
            <LoaderCircle className="status-spinner" size={30} />
            <h1>Securing your shortlist…</h1>
            <p>We’re finishing your sign-in and loading your trainer matches.</p>
          </StatusScreen>
        ) : null}

        {phase === "auth-error" ? (
          <StatusScreen key="auth-error">
            <p className="eyebrow">Link not completed</p>
            <h1>{authResult === "missing-email" ? "Open the link on this device." : "That link didn’t work."}</h1>
            <p>
              {authResult === "missing-email"
                ? "For security, request a fresh link here and open it in the same browser."
                : "The link may have expired or already been used. Your matching answers are still here."}
            </p>
            <button className="primary-button" onClick={() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              setOnboardingStartStep(6);
              setPhase("onboarding");
            }} type="button">
              Request another link <ArrowRight size={18} />
            </button>
          </StatusScreen>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StatusScreen({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.main
      animate={{ opacity: 1 }}
      className="status-screen"
      initial={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.24 }}
    >
      <BrandMark />
      <section>{children}</section>
    </motion.main>
  );
}
