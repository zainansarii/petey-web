import { render, screen } from "@testing-library/react";
import { App } from "./App";

const authMocks = vi.hoisted(() => ({
  finishMagicLink: vi.fn(),
  observeFirebaseAuthSession: vi.fn(),
  requestMagicLink: vi.fn(),
}));

const onboardingMocks = vi.hoisted(() => ({
  consumeWebOnboardingDraftV3: vi.fn(async () => null),
  getWebClientProfileV3: vi.fn(async () => ({
    profileMarkdown: "# Training brief\n\n## The trainee\nWants to improve general fitness." as string | null,
  })),
}));

vi.mock("../features/auth/api/magicLink", () => ({
  finishMagicLink: authMocks.finishMagicLink,
  observeFirebaseAuthSession: authMocks.observeFirebaseAuthSession,
  requestMagicLink: authMocks.requestMagicLink,
}));

vi.mock("../features/onboarding/api/webOnboarding", async (importOriginal) => ({
  ...await importOriginal<typeof import("../features/onboarding/api/webOnboarding")>(),
  consumeWebOnboardingDraftV3: onboardingMocks.consumeWebOnboardingDraftV3,
  getWebClientProfileV3: onboardingMocks.getWebClientProfileV3,
}));

vi.mock("../features/onboarding/components/OnboardingFlow", () => ({
  OnboardingFlow: () => <main><h1>Sign-up flow chat</h1></main>,
}));

describe("App auth restoration", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    window.localStorage.clear();
    authMocks.finishMagicLink.mockReset();
    authMocks.observeFirebaseAuthSession.mockReset();
    onboardingMocks.consumeWebOnboardingDraftV3.mockReset().mockResolvedValue(null);
    onboardingMocks.getWebClientProfileV3.mockReset().mockResolvedValue({
      profileMarkdown: "# Training brief\n\n## The trainee\nWants to improve general fitness.",
    });
    authMocks.observeFirebaseAuthSession.mockImplementation(async (onSessionChange) => {
      onSessionChange(true);
      return () => undefined;
    });
  });

  it("restores the feed for an existing Firebase session", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /four demo trainers to explore/i })).toBeInTheDocument();
    expect(onboardingMocks.getWebClientProfileV3).toHaveBeenCalledOnce();
  });

  it("sends a new email-link user into the signup chat", async () => {
    window.history.replaceState({}, "", "/?finishSignUp=1&mode=signIn&oobCode=code");
    authMocks.finishMagicLink.mockResolvedValue("signed-in");
    onboardingMocks.getWebClientProfileV3.mockResolvedValue({ profileMarkdown: null });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign-up flow chat" })).toBeInTheDocument();
    expect(onboardingMocks.getWebClientProfileV3).toHaveBeenCalledOnce();
  });

  it("keeps genuine profile-loading failures out of the signup flow", async () => {
    window.history.replaceState({}, "", "/?finishSignUp=1&mode=signIn&oobCode=code");
    authMocks.finishMagicLink.mockResolvedValue("signed-in");
    onboardingMocks.getWebClientProfileV3.mockRejectedValue(new Error("Network unavailable"));

    render(<App />);

    expect(await screen.findByRole("heading", { name: /couldn’t load your match/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign-up flow chat" })).not.toBeInTheDocument();
  });
});
