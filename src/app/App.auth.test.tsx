import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";
import { DEMO_TRAINER_FIXTURES as TRAINERS } from "../features/discovery/data/demoTrainerFixture";
import type { ConsumeWebOnboardingDraftV3Response, DraftCapability, MatchedTrainer } from "../features/onboarding/model/onboarding";

const authMocks = vi.hoisted(() => ({
  finishMagicLink: vi.fn(),
  observeFirebaseAuthSession: vi.fn(),
  requestMagicLink: vi.fn(),
}));

const onboardingMocks = vi.hoisted(() => ({
  consumeWebOnboardingDraftV3: vi.fn<(draft?: DraftCapability) => Promise<ConsumeWebOnboardingDraftV3Response | null>>(async () => null),
  getWebClientProfileV3: vi.fn(async () => ({
    profileMarkdown: "# Training brief\n\n## The trainee\nWants to improve general fitness." as string | null,
    matches: [] as MatchedTrainer[],
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
  OnboardingFlow: ({ onMatchesReady }: { onMatchesReady?: (draft: DraftCapability) => Promise<void> }) => (
    <main><h1>Sign-up flow chat</h1>{onMatchesReady ? <button onClick={() => void onMatchesReady({ draftId: "retuned-draft", capability: "retuned-capability" })}>Complete retune</button> : <p>Basic details required</p>}</main>
  ),
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
      matches: [{ trainer: TRAINERS[3]!, score: 86, reason: "Your boxing interests and evening schedule fit." }],
    });
    authMocks.observeFirebaseAuthSession.mockImplementation(async (onSessionChange) => {
      onSessionChange(true);
      return () => undefined;
    });
  });

  it("restores the feed for an existing Firebase session", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /your trainer matches/i })).toBeInTheDocument();
    expect(onboardingMocks.getWebClientProfileV3).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Rohan Kapoor" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Maya Chen" })).not.toBeInTheDocument();
    expect(screen.getByText("Your boxing interests and evening schedule fit.", { exact: false })).toBeInTheDocument();
  });

  it("uses the matches from a newly consumed draft", async () => {
    onboardingMocks.consumeWebOnboardingDraftV3.mockResolvedValue({
      profileMarkdown: "# Training brief\n\nLooking for patient running coaching.",
      matches: [{ trainer: TRAINERS[5]!, score: 90, reason: "Your running goals fit John's coaching." }],
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "John Kim" })).toBeInTheDocument();
    expect(onboardingMocks.getWebClientProfileV3).not.toHaveBeenCalled();
  });

  it("keeps completed profiles with no matches in an honest empty shortlist", async () => {
    onboardingMocks.getWebClientProfileV3.mockResolvedValue({
      profileMarkdown: "# Training brief\n\nA training plan for specialist goals.",
      matches: [],
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "No trainers available yet" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Maya Chen" })).not.toBeInTheDocument();
  });

  it("returns an authenticated client from an empty feed through retuning to their new matches", async () => {
    onboardingMocks.getWebClientProfileV3.mockResolvedValue({
      profileMarkdown: "# Training brief\n\nA training plan for specialist goals.", matches: [],
    });
    render(<App />);
    await screen.findByRole("heading", { name: "No trainers available yet" });
    fireEvent.click(screen.getByRole("button", { name: "Update my preferences" }));
    const finishRetune = await screen.findByRole("button", { name: "Complete retune" });
    onboardingMocks.consumeWebOnboardingDraftV3.mockResolvedValue({
      profileMarkdown: "# Training brief\n\nUpdated running preferences.",
      matches: [{ trainer: TRAINERS[5]!, score: 90, reason: "Your updated running goals fit." }],
    });
    fireEvent.click(finishRetune);
    expect(await screen.findByRole("heading", { name: "John Kim" })).toBeInTheDocument();
    expect(onboardingMocks.consumeWebOnboardingDraftV3).toHaveBeenLastCalledWith({ draftId: "retuned-draft", capability: "retuned-capability" });
    expect(authMocks.requestMagicLink).not.toHaveBeenCalled();
  });

  it("sends a new email-link user into the signup chat", async () => {
    window.history.replaceState({}, "", "/?finishSignUp=1&mode=signIn&oobCode=code");
    authMocks.finishMagicLink.mockResolvedValue("signed-in");
    onboardingMocks.getWebClientProfileV3.mockResolvedValue({ profileMarkdown: null, matches: [] });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign-up flow chat" })).toBeInTheDocument();
    expect(screen.getByText("Basic details required")).toBeInTheDocument();
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
