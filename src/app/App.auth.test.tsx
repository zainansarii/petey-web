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
    profileMarkdown: "# Training brief\n\n## The trainee\nWants to improve general fitness.",
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

describe("App auth restoration", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    window.localStorage.clear();
    authMocks.observeFirebaseAuthSession.mockReset();
    onboardingMocks.consumeWebOnboardingDraftV3.mockClear();
    onboardingMocks.getWebClientProfileV3.mockClear();
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
});
