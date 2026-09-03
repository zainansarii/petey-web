import { useCallback, useEffect, useState } from "react";
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
  clearDraftCapability,
  clearLocalConversationV4,
  consumeWebOnboardingDraftV3,
  getWebClientProfileV3,
  prewarmWebOnboarding,
} from "../features/onboarding/api/webOnboarding";
import {
  INITIAL_IDENTITY_ANSWERS,
  type IdentityAnswers,
} from "../features/onboarding/model/onboarding";
import { BrandMark } from "../shared/ui/BrandMark";

type AppPhase = "landing" | "onboarding" | "check-email" | "feed" | "auth-loading" | "auth-error" | "profile-error";

const hasMagicLinkReturn = () => new URLSearchParams(window.location.search).has("finishSignUp");
const hasHandoffPreview = () => {
  const search = new URLSearchParams(window.location.search);
  return import.meta.env.DEV
    && search.has("onboardingFixture")
    && search.has("skipOnboarding");
};

const setHandoffPreviewUrl = (enabled: boolean, removeFixture = false) => {
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set("onboardingFixture", "1");
    url.searchParams.set("skipOnboarding", "1");
  } else {
    url.searchParams.delete("skipOnboarding");
    if (removeFixture) url.searchParams.delete("onboardingFixture");
  }
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
};

export function App() {
  const [handoffPreview, setHandoffPreview] = useState(hasHandoffPreview);
  const [phase, setPhase] = useState<AppPhase>(() => (
    hasMagicLinkReturn() ? "auth-loading" : hasHandoffPreview() ? "onboarding" : "landing"
  ));
  const [profileMarkdown, setProfileMarkdown] = useState("");
  const [identity, setIdentity] = useState<IdentityAnswers>(INITIAL_IDENTITY_ANSWERS);
  const [email, setEmail] = useState("");
  const [preview, setPreview] = useState(false);
  const [authResult, setAuthResult] = useState<FinishMagicLinkResult | null>(null);
  const reducedMotion = useReducedMotion();

  const openOnboarding = (previewHandoff: boolean) => {
    setHandoffPreviewUrl(previewHandoff);
    setHandoffPreview(previewHandoff);
    setPhase("onboarding");
  };

  const exitOnboarding = () => {
    if (handoffPreview) {
      clearLocalConversationV4();
      clearDraftCapability();
    }
    setHandoffPreviewUrl(false, handoffPreview);
    setHandoffPreview(false);
    setPhase("landing");
  };

  useEffect(() => {
    if (hasMagicLinkReturn()) return;
    void prewarmWebOnboarding().catch(() => {
      // The first callable retries normal App Check initialization if prewarming fails.
    });
  }, []);

  const consumeDraftIntoFeed = useCallback(async () => {
    try {
      const consumed = await consumeWebOnboardingDraftV3();
      const profile = consumed?.profileMarkdown ?? (await getWebClientProfileV3()).profileMarkdown;
      if (!profile?.trim()) throw new Error("No web profile notes are available for this account.");
      setProfileMarkdown(profile);
      setPhase("feed");
    } catch {
      setPhase("profile-error");
    }
  }, []);

  useEffect(() => {
    if (hasMagicLinkReturn()) return;

    let active = true;
    let unsubscribe: (() => void) | undefined;

    void observeFirebaseAuthSession((isSignedIn) => {
      if (active && isSignedIn) void consumeDraftIntoFeed();
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
  }, [consumeDraftIntoFeed]);

  useEffect(() => {
    if (phase !== "auth-loading") return;
    let cancelled = false;

    void finishMagicLink().then(async (result) => {
      if (cancelled) return;
      setAuthResult(result);
      if (result === "signed-in") await consumeDraftIntoFeed();
      else if (result === "ignored") {
        window.history.replaceState({}, document.title, window.location.pathname);
        setPhase("landing");
      }
      else setPhase("auth-error");
    });

    return () => {
      cancelled = true;
    };
  }, [consumeDraftIntoFeed, phase]);

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
            <LandingScreen
              onPreviewHandoff={import.meta.env.DEV ? () => openOnboarding(true) : undefined}
              onStart={() => openOnboarding(false)}
            />
          </motion.div>
        ) : null}

        {phase === "onboarding" ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="screen-frame"
            exit={{ opacity: 0, y: reducedMotion ? 0 : -18 }}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 28 }}
            key="onboarding"
            transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <OnboardingFlow
              identity={identity}
              onExit={exitOnboarding}
              onIdentityChange={setIdentity}
              onMagicLinkRequested={(requestedEmail, mode) => {
                setEmail(requestedEmail);
                setPreview(mode === "preview");
                setPhase("check-email");
              }}
              onProfileMarkdownChange={setProfileMarkdown}
              previewHandoff={handoffPreview}
              profileMarkdown={profileMarkdown}
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
                setPhase("onboarding");
              }}
              onPreviewFeed={() => void consumeDraftIntoFeed()}
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
              onEditMatch={() => {
                setPhase("onboarding");
              }}
              onHome={() => setPhase("landing")}
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
            <h1>{authResult === "missing-email" ? "Open the link on this device." : "That link didn’t work."}</h1>
            <p>
              {authResult === "missing-email"
                ? "For security, request a fresh link here and open it in the same browser."
                : "The link may have expired or already been used. Your matching details are still here."}
            </p>
            <button className="primary-button" onClick={() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              setPhase("onboarding");
            }} type="button">
              Request another link <ArrowRight size={18} />
            </button>
          </StatusScreen>
        ) : null}

        {phase === "profile-error" ? (
          <StatusScreen key="profile-error">
            <h1>We couldn’t load your match.</h1>
            <p>Your profile has not been replaced. Check your connection and try the secure handoff again.</p>
            <button className="primary-button" onClick={() => {
              setPhase("auth-loading");
              void consumeDraftIntoFeed();
            }} type="button">
              Try again <ArrowRight size={18} />
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
