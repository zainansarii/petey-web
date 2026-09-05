import { act, fireEvent, render, screen } from "@testing-library/react";
import { App } from "./App";

vi.mock("../features/onboarding/api/webOnboarding", async () => {
  const model = await import("../features/onboarding/model/onboarding");
  const snapshot = {
    schemaVersion: 3 as const,
    draftId: "app-test-draft",
    version: 1,
    status: "collecting" as const,
    profileMarkdown: null,
    messages: model.ONBOARDING_OPENING_MESSAGES.map((text, index) => ({
      id: `opening-${index}`,
      role: "assistant" as const,
      text,
      createdAt: "2026-08-31T12:00:00.000Z",
      sequence: index + 1,
    })),
    quickReplies: [...model.ONBOARDING_OPENING_QUICK_REPLIES],
    expiresAt: "2026-09-01T12:00:00.000Z",
    confirmationVersion: null,
    userTurns: 0,
  };
  const session = {
    schemaVersion: 4 as const,
    status: "collecting" as const,
    messages: snapshot.messages,
    quickReplies: snapshot.quickReplies,
    userTurns: 0,
    updatedAt: "2026-08-31T12:00:00.000Z",
  };
  return {
    clearLocalConversationV4: vi.fn(),
    clearDraftCapability: vi.fn(),
    confirmWebOnboardingDraftV3: vi.fn(),
    consumeWebOnboardingDraftV3: vi.fn(async () => null),
    createLocalConversationV4: vi.fn(() => session),
    createIdempotencyKey: vi.fn(() => "app-test-turn"),
    createWebOnboardingDraftV3: vi.fn(async () => ({
      draftId: snapshot.draftId,
      capability: "app-test-capability",
      snapshot,
    })),
    deleteWebOnboardingDraftV3: vi.fn(async () => ({ deleted: true })),
    finalizeWebOnboardingV4: vi.fn(async ({ messages }) => ({
      draftId: snapshot.draftId,
      capability: "app-test-capability",
      snapshot: {
        ...snapshot,
        status: "review" as const,
        profileMarkdown: "# Training brief\n\nReady to preview the matching handoff.",
        messages,
        quickReplies: [],
        userTurns: messages.filter(({ role }: { role: string }) => role === "user").length,
      },
      timings: { rateLimitMs: 0, modelMs: 1, writeMs: 1, totalMs: 2 },
    })),
    finalizeWebOnboardingDraftV3: vi.fn(),
    getWebOnboardingDraftV3: vi.fn(async () => ({ snapshot })),
    getWebClientProfileV3: vi.fn(async () => ({ profileMarkdown: null, matches: [] })),
    matchWebOnboardingDraftV1: vi.fn(async () => ({ matching: { totalMatches: 0, previews: [] } })),
    prewarmWebOnboarding: vi.fn(async () => undefined),
    readLocalConversationV4: vi.fn(() => null),
    readDraftCapability: vi.fn(() => null),
    runWebOnboardingTurnV4: vi.fn(),
    runWebOnboardingTurnV3: vi.fn(),
    saveLocalConversationV4: vi.fn(),
    WEB_ONBOARDING_CONSENT_VERSION: "2026-08-31",
  };
});

describe("Petey web journey", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("moves from the trainer carousel into trainee onboarding with one downward wheel gesture", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /find your personal trainer/i })).toBeInTheDocument();
    fireEvent.wheel(screen.getByRole("main"), { deltaY: 80 });

    expect(screen.queryByText(/i’m a personal trainer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: /sign-up progress/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/private by design/i)).not.toBeInTheDocument();

    expect(await screen.findByText("Hi, welcome to Petey!")).toBeInTheDocument();
    expect(screen.getByText(/tell us a bit about what you're hoping to achieve/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /conversation progress/i })).toHaveAttribute("aria-valuenow", "12");
  });

  it("offers a development shortcut to the completed chat handoff", async () => {
    const { unmount } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /skip onboarding and preview the matching flow/i }));

    expect(new URLSearchParams(window.location.search).has("onboardingFixture")).toBe(true);
    expect(new URLSearchParams(window.location.search).has("skipOnboarding")).toBe(true);
    expect(await screen.findByText("Thanks! We have everything needed now to find your match.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /conversation progress/i })).toHaveAttribute("aria-valuenow", "100");

    unmount();
    render(<App />);

    expect(await screen.findByText("Thanks! We have everything needed now to find your match.")).toBeInTheDocument();
  });

  it("opens the existing-member login from the home header", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "Log in" }));

    expect(new URLSearchParams(window.location.search).has("login")).toBe(true);
    expect(await screen.findByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email address/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to home/i }));
    expect(await screen.findByRole("heading", { name: /find your personal trainer/i })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("login")).toBe(false);
  });

  it("presents the landing profiles as a centered horizontal carousel", () => {
    render(<App />);

    expect(screen.queryByText("Personal training, personally matched.")).not.toBeInTheDocument();
    expect(screen.queryByText("Meet your match")).not.toBeInTheDocument();
    expect(screen.queryByText("Scroll once to start")).not.toBeInTheDocument();
    expect(screen.queryByText("No account needed to start")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause trainer carousel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /previous trainer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next trainer/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start matching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I'm a personal trainer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show Maya Chen" })).not.toBeInTheDocument();
    const carousel = screen.getByRole("region", { name: "Trainer previews" });
    expect(carousel.querySelectorAll(".hero-carousel__card")).toHaveLength(5);
    expect(carousel.querySelectorAll(".hero-carousel__card--side")).toHaveLength(2);
    expect(carousel.querySelectorAll(".hero-carousel__card--offstage")).toHaveLength(2);
    expect([...carousel.querySelectorAll<HTMLElement>(".hero-carousel__card")]
      .map(({ dataset }) => dataset.carouselSlot)).toEqual(["-2", "-1", "0", "1", "2"]);
    expect(screen.getByRole("heading", { name: /^Maya$/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Maya Chen$/ })).not.toBeInTheDocument();
    expect(screen.getByText(/showing maya chen, running and endurance, 1 of 8/i)).toBeInTheDocument();

    fireEvent.touchStart(screen.getByRole("main"), { touches: [{ clientX: 240, clientY: 240 }] });
    fireEvent.touchEnd(screen.getByRole("main"), { changedTouches: [{ clientX: 150, clientY: 242 }] });

    expect(carousel.querySelector<HTMLElement>('[data-carousel-slot="0"]')?.textContent)
      .toContain("Marcus");
    expect(screen.getByRole("heading", { name: /^Marcus$/ })).toBeInTheDocument();
    expect(screen.getByText(/showing marcus adebayo, strength, 2 of 8/i)).toBeInTheDocument();
  });

  it("automatically rotates the trainer deck every five seconds", () => {
    vi.useFakeTimers();
    const { unmount } = render(<App />);

    expect(screen.getByText(/showing maya chen, running and endurance, 1 of 8/i)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4_999));
    expect(screen.getByText(/showing maya chen, running and endurance, 1 of 8/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/showing marcus adebayo, strength, 2 of 8/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing aliyah rahman, pilates, 3 of 8/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing rohan kapoor, boxing & combat fitness, 4 of 8/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing leanne brooks, calisthenics, 5 of 8/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing john kim, running and endurance, 6 of 8/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing aleem malik, sport-specific training, 7 of 8/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing yasmin okafor, strength, 8 of 8/i)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText(/showing maya chen, running and endurance, 1 of 8/i)).toBeInTheDocument();

    unmount();
    vi.useRealTimers();
  });
});
