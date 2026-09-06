import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  INITIAL_IDENTITY_ANSWERS,
  ONBOARDING_OPENING_MESSAGES,
  ONBOARDING_OPENING_QUICK_REPLIES,
  type DraftCapability,
  type IdentityAnswers,
  type OnboardingConversationSessionV4,
  type OnboardingDraftSnapshotV3,
  type OnboardingTurnResultV3,
} from "../model/onboarding";
import { OnboardingFlow } from "./OnboardingFlow";
import { TRAINERS } from "../../discovery/data/trainers";

const api = vi.hoisted(() => ({
  clearLocalConversationV4: vi.fn(),
  clearDraftCapability: vi.fn(),
  confirmWebOnboardingDraftV3: vi.fn(),
  createLocalConversationV4: vi.fn(),
  createIdempotencyKey: vi.fn(() => "turn-key"),
  deleteWebOnboardingDraftV3: vi.fn(),
  finalizeWebOnboardingV4: vi.fn(),
  getWebOnboardingDraftV3: vi.fn(),
  matchWebOnboardingDraftV1: vi.fn(),
  readLocalConversationV4: vi.fn(),
  readDraftCapability: vi.fn<() => DraftCapability | null>(() => null),
  runWebOnboardingTurnV4: vi.fn(),
  saveLocalConversationV4: vi.fn(),
  WEB_ONBOARDING_CONSENT_VERSION: "2026-08-31",
}));

const auth = vi.hoisted(() => ({
  requestMagicLink: vi.fn(async () => "preview" as const),
}));

vi.mock("../api/webOnboarding", () => api);
vi.mock("../../auth/api/magicLink", () => auth);
vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useReducedMotion: () => true,
}));

const now = "2026-09-01T12:00:00.000Z";
const capability = {
  draftId: "00000000-0000-4000-8000-000000000003",
  capability: "capability-v3-capability-v3-capability",
};
const reviewMarkdown = `# Training brief

## The trainee
Build strength and feel confident before my wedding.

I have trained for a few years and would like an encouraging trainer.

## The trainer
- **Coaching style:** Warm and friendly
- Enjoys conversation during sessions

## The sessions
Online if possible, based around south London.`;

const createSnapshot = (
  overrides: Partial<OnboardingDraftSnapshotV3> = {},
): OnboardingDraftSnapshotV3 => ({
  schemaVersion: 3,
  draftId: capability.draftId,
  version: 1,
  status: "collecting",
  profileMarkdown: null,
  messages: ONBOARDING_OPENING_MESSAGES.map((text, index) => ({
    id: `opening-${index}`,
    role: "assistant" as const,
    text,
    createdAt: now,
    sequence: index + 1,
  })),
  quickReplies: [...ONBOARDING_OPENING_QUICK_REPLIES],
  expiresAt: "2026-09-02T12:00:00.000Z",
  confirmationVersion: null,
  userTurns: 0,
  ...overrides,
});

const createSession = (
  overrides: Partial<OnboardingConversationSessionV4> = {},
): OnboardingConversationSessionV4 => ({
  schemaVersion: 4,
  status: "collecting",
  messages: createSnapshot().messages,
  quickReplies: [...ONBOARDING_OPENING_QUICK_REPLIES],
  userTurns: 0,
  updatedAt: now,
  ...overrides,
});

const streamedTurn = (result: OnboardingTurnResultV3) => Promise.resolve({
  stream: (async function* streamReply() {
    yield { type: "reply_delta" as const, text: result.reply };
  })(),
  data: Promise.resolve({
    result,
    timings: {
      rateLimitMs: 5,
      modelFirstChunkMs: 40,
      firstReplyChunkMs: 45,
      modelTotalMs: 80,
      totalMs: 90,
    },
  }),
});

const openStreamedTurn = (result: OnboardingTurnResultV3, settleData = true) => {
  let nextCall = 0;
  const iterator = {
    next: vi.fn(() => {
      nextCall += 1;
      if (nextCall === 1) {
        return Promise.resolve({
          done: false as const,
          value: { type: "reply_delta" as const, text: result.reply },
        });
      }
      return new Promise<IteratorResult<{ type: "reply_delta"; text: string }>>(() => {});
    }),
    return: vi.fn(async () => ({ done: true as const, value: undefined })),
  };
  return {
    iterator,
    pending: Promise.resolve({
      stream: { [Symbol.asyncIterator]: () => iterator },
      data: settleData
        ? Promise.resolve({
            result,
            timings: {
              rateLimitMs: 5,
              modelFirstChunkMs: 40,
              firstReplyChunkMs: 45,
              modelTotalMs: 80,
              totalMs: 90,
            },
          })
        : new Promise<never>(() => {}),
    }),
  };
};

const reviewSnapshot = (overrides: Partial<OnboardingDraftSnapshotV3> = {}) => createSnapshot({
  version: 3,
  status: "review",
  profileMarkdown: reviewMarkdown,
  quickReplies: [],
  userTurns: 5,
  ...overrides,
});

const onMagicLinkRequested = vi.fn();
const onExit = vi.fn();

function Harness({ onMatchesReady }: { onMatchesReady?: (draft: typeof capability) => Promise<void> } = {}) {
  const [profileMarkdown, setProfileMarkdown] = useState("");
  const [identity, setIdentity] = useState<IdentityAnswers>(INITIAL_IDENTITY_ANSWERS);
  return (
    <>
      <OnboardingFlow
        identity={identity}
        onExit={onExit}
        onIdentityChange={setIdentity}
        onMagicLinkRequested={onMagicLinkRequested}
        onMatchesReady={onMatchesReady}
        onProfileMarkdownChange={setProfileMarkdown}
        profileMarkdown={profileMarkdown}
      />
      <output data-testid="captured-profile">{profileMarkdown}</output>
    </>
  );
}

const sendAnswer = async (answer: string) => {
  const composer = await screen.findByRole("textbox", { name: /your answer/i });
  fireEvent.change(composer, { target: { value: answer } });
  fireEvent.click(screen.getByRole("button", { name: /send answer/i }));
  await waitFor(() => expect(composer).toHaveValue(""));
};

describe("web onboarding V4 local conversation and secure handoff", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    api.createIdempotencyKey.mockReturnValue("turn-key");
    api.matchWebOnboardingDraftV1.mockReset().mockResolvedValue({
      matching: { totalMatches: 5, previews: TRAINERS.slice(0, 3) },
    });
    api.readDraftCapability.mockReturnValue(null);
    api.readLocalConversationV4.mockReturnValue(null);
    api.createLocalConversationV4.mockImplementation(() => createSession());
  });

  it("opens with the requested welcome, examples, and compact conversation progress", async () => {
    render(<Harness />);

    expect(await screen.findByText("Hi, welcome to Petey!")).toBeInTheDocument();
    expect(screen.getByText("To get you matched with the best personal trainer for you, tell us a bit about what you're hoping to achieve. The more detailed your responses, the better we'll be able to match you.")).toBeInTheDocument();
    for (const example of ONBOARDING_OPENING_QUICK_REPLIES) {
      expect(screen.getByRole("button", { name: example })).toBeInTheDocument();
    }
    const progress = screen.getByRole("progressbar", { name: /conversation progress/i });
    expect(progress).toHaveAttribute("aria-valuenow", "12");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(progress).toHaveAttribute("aria-valuetext", "12% complete");
    expect(progress).not.toHaveTextContent("Chat");
    expect(progress).not.toHaveTextContent("Review");
  });

  it("stores no profile document during an ordinary turn", async () => {
    api.runWebOnboardingTurnV4.mockImplementation(() => streamedTurn({
      reply: "That’s a good place to start. What would feeling fitter let you do?",
      readyForReview: false,
      quickReplies: [],
    }));
    render(<Harness />);

    await sendAnswer("I want to feel fitter");

    expect(await screen.findByText(/what would feeling fitter let you do/i)).toBeInTheDocument();
    expect(api.runWebOnboardingTurnV4).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({ role: "user", text: "I want to feel fitter" })]),
    }), expect.any(AbortSignal));
    expect(screen.getByTestId("captured-profile")).toBeEmptyDOMElement();
    expect(api.finalizeWebOnboardingV4).not.toHaveBeenCalled();
    expect(api.saveLocalConversationV4).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 4,
      userTurns: 1,
    }));
    expect(screen.getByRole("progressbar", { name: /conversation progress/i })).toHaveAttribute("aria-valuenow", "27");
  });

  it("moves the chat viewport to the latest message when a new turn starts", async () => {
    api.runWebOnboardingTurnV4.mockImplementation(() => streamedTurn({
      reply: "What would you like to focus on next?",
      readyForReview: false,
      quickReplies: [],
    }));
    render(<Harness />);

    const viewport = document.querySelector<HTMLElement>(".chat-thread__viewport");
    expect(viewport).not.toBeNull();
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1_000 },
    });

    await sendAnswer("I want to build strength");

    await waitFor(() => expect(viewport?.scrollTop).toBe(600));
  });

  it("replaces the opening examples with contextual replies from the same turn", async () => {
    api.runWebOnboardingTurnV4.mockImplementation(() => streamedTurn({
      reply: "What coaching style would help you feel most motivated?",
      readyForReview: false,
      quickReplies: [
        "I want tough love and lots of accountability.",
        "Someone who is warm and friendly.",
      ],
    }));
    render(<Harness />);

    await sendAnswer("I stay motivated with the right person");

    expect(await screen.findByRole("button", { name: "I want tough love and lots of accountability" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Someone who is warm and friendly" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "I want to build strength" })).not.toBeInTheDocument();
  });

  it("advances from a completed result even when the reply stream stays open", async () => {
    const openTurn = openStreamedTurn({
      reply: "Thanks! We have everything needed now to find your match.",
      readyForReview: true,
      quickReplies: [],
    });
    api.runWebOnboardingTurnV4.mockImplementation(() => openTurn.pending);
    api.finalizeWebOnboardingV4.mockResolvedValue({
      ...capability,
      snapshot: reviewSnapshot(),
      timings: { rateLimitMs: 5, modelMs: 100, writeMs: 20, totalMs: 125 },
    });
    render(<Harness />);

    await sendAnswer("Around £50 per session");

    expect(await screen.findByText("Thanks! We have everything needed now to find your match.")).toBeInTheDocument();
    await waitFor(() => expect(api.finalizeWebOnboardingV4).toHaveBeenCalledTimes(1));
    expect(openTurn.iterator.return).toHaveBeenCalledTimes(1);
  });

  it("does not treat completion copy as authoritative while the terminal result stays open", async () => {
    const openTurn = openStreamedTurn({
      reply: "Thanks! We have everything needed now to find your match.",
      readyForReview: true,
      quickReplies: [],
    }, false);
    api.runWebOnboardingTurnV4.mockImplementation(() => openTurn.pending);
    api.finalizeWebOnboardingV4.mockResolvedValue({
      ...capability,
      snapshot: reviewSnapshot(),
      timings: { rateLimitMs: 5, modelMs: 100, writeMs: 20, totalMs: 125 },
    });
    render(<Harness />);

    await sendAnswer("Around £50 per session");

    expect(await screen.findByText("Thanks! We have everything needed now to find your match.")).toBeInTheDocument();
    expect(api.finalizeWebOnboardingV4).not.toHaveBeenCalled();
    expect(screen.getByRole("progressbar", { name: /conversation progress/i })).not.toHaveAttribute("aria-valuenow", "100");
  });

  it("reveals selectable matches before opening the required details modal", async () => {
    api.runWebOnboardingTurnV4.mockImplementation(() => streamedTurn({
      reply: "That gives me everything I need. Secure final details are next.",
      readyForReview: true,
      quickReplies: [],
    }));
    const finalizedDraft = {
      ...capability,
      snapshot: reviewSnapshot(),
      timings: { rateLimitMs: 5, modelMs: 100, writeMs: 20, totalMs: 125 },
    };
    let completeFinalization = () => {};
    api.finalizeWebOnboardingV4.mockImplementation(() => new Promise((resolve) => {
      completeFinalization = () => resolve(finalizedDraft);
    }));
    render(<Harness />);

    await sendAnswer("Weekends work");

    expect(await screen.findByText("Thanks! We have everything needed now to find your match.")).toBeInTheDocument();
    expect(document.querySelector(".chat-composer")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /your answer/i, hidden: true })).toBeDisabled();
    expect(api.finalizeWebOnboardingV4).toHaveBeenCalledTimes(1);

    const matching = await screen.findByRole(
      "status",
      { name: /finding your personal trainer/i },
      { timeout: 3_000 },
    );
    expect(matching.closest(".post-chat-matching")?.querySelector(".twin-orbit")).toBeInTheDocument();
    expect(matching.querySelectorAll(".text-dots__dot")).toHaveLength(3);
    expect(matching).toHaveTextContent("Finding your personal trainer...");
    expect(screen.getByText("Hi, welcome to Petey!")).not.toBeVisible();
    expect(document.querySelector(".chat-thread__viewport")).toHaveAttribute("data-handoff-phase", "matching");
    expect(document.querySelector(".chat-composer")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: /conversation progress/i, hidden: true })).not.toBeInTheDocument();
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(screen.queryByRole("dialog", { name: /create an account/i })).not.toBeInTheDocument();

    await act(async () => completeFinalization());
    await waitFor(() => expect(api.matchWebOnboardingDraftV1).toHaveBeenCalledWith(capability));

    expect(await screen.findByRole("heading", { name: /we found 5 matches/i })).toBeInTheDocument();
    expect(screen.getByText("Hi, welcome to Petey!")).not.toBeVisible();
    const matchButtons = screen.getAllByRole("button", { name: /choose match \d/i });
    expect(matchButtons).toHaveLength(3);
    expect(matchButtons[0]).toHaveAccessibleName(/maya chen: running and endurance, battersea · sw11, from £70/i);
    expect(document.querySelectorAll(".match-preview__profile[aria-hidden='true']")).toHaveLength(3);
    expect(screen.queryByRole("dialog", { name: /create an account/i })).not.toBeInTheDocument();

    fireEvent.click(matchButtons[0]!);

    const dialog = await screen.findByRole(
      "dialog",
      { name: /create an account/i },
      { timeout: 2_000 },
    );
    expect(api.finalizeWebOnboardingV4).toHaveBeenCalledTimes(1);
    expect(api.finalizeWebOnboardingV4).toHaveBeenCalledWith(expect.objectContaining({
      consentVersion: "2026-08-31",
      idempotencyKey: "turn-key",
      messages: expect.arrayContaining([expect.objectContaining({ text: "Weekends work" })]),
    }));
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Add your basic details to access your matches.");
    expect(document.querySelectorAll(".match-preview__card")).toHaveLength(3);
    expect(screen.getByText("Hi, welcome to Petey!")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /training brief preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /your training brief/i })).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/warm and friendly/i);
    expect(screen.queryByRole("textbox", { name: /your answer/i, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: /conversation progress/i, hidden: true })).not.toBeInTheDocument();
  });

  it.each([0, 2])("saves %i retuned matches for an existing account without opening signup", async (count) => {
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({
      snapshot: reviewSnapshot({ matching: { totalMatches: count, previews: TRAINERS.slice(0, count) } }),
    });
    const onMatchesReady = vi.fn(async () => undefined);
    render(<Harness onMatchesReady={onMatchesReady} />);

    await waitFor(() => expect(onMatchesReady).toHaveBeenCalledExactlyOnceWith(capability));
    expect(screen.queryByRole("dialog", { name: /create an account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create an account/i })).not.toBeInTheDocument();
    expect(onMagicLinkRequested).not.toHaveBeenCalled();
  });

  it("retries saving a retune without asking for identity or rerunning matching", async () => {
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({
      snapshot: reviewSnapshot({ matching: { totalMatches: 2, previews: TRAINERS.slice(0, 2) } }),
    });
    const onMatchesReady = vi.fn()
      .mockRejectedValueOnce(new Error("Could not save your updated matches."))
      .mockResolvedValue(undefined);
    render(<Harness onMatchesReady={onMatchesReady} />);

    fireEvent.click(await screen.findByRole("button", { name: /^try again$/i }));
    await waitFor(() => expect(onMatchesReady).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(api.matchWebOnboardingDraftV1).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /create an account/i })).not.toBeInTheDocument();
  });

  it("preserves the transcript and offers a reliable finalization retry", async () => {
    api.readLocalConversationV4.mockReturnValue(createSession({ status: "ready_to_map", userTurns: 7 }));
    api.finalizeWebOnboardingV4
      .mockRejectedValueOnce(new Error("Your conversation is saved — try preparing it again."))
      .mockResolvedValueOnce({
        ...capability,
        snapshot: reviewSnapshot({ version: 1, userTurns: 7 }),
        timings: { rateLimitMs: 5, modelMs: 100, writeMs: 20, totalMs: 125 },
      });
    render(<Harness />);

    const retry = await screen.findByRole(
      "button",
      { name: /^try again$/i },
      { timeout: 3_000 },
    );
    expect(screen.getByText("Hi, welcome to Petey!")).toBeInTheDocument();
    fireEvent.click(retry);

    expect(await screen.findByRole("status", { name: /finding your personal trainer/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /we found 5 matches/i })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /choose match \d/i })[0]!);
    expect(await screen.findByRole(
      "dialog",
      { name: /create an account/i },
      { timeout: 2_000 },
    )).toBeInTheDocument();
    expect(api.finalizeWebOnboardingV4).toHaveBeenCalledTimes(2);
  });

  it("keeps a failed answer visible with an explicit retry action", async () => {
    api.runWebOnboardingTurnV4.mockRejectedValue(new Error("I couldn’t reply just now. Please try again."));
    render(<Harness />);
    await sendAnswer("My answer should stay visible");

    expect(await screen.findByText("My answer should stay visible")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByText(/couldn’t reply just now/i)).toBeInTheDocument();
  });

  it("lets the user choose a match from a restored completed conversation", async () => {
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({ snapshot: reviewSnapshot() });
    render(<Harness />);

    expect(await screen.findByRole("heading", { name: /we found 5 matches/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /create an account/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /choose match \d/i })[0]!);

    expect(await screen.findByRole("dialog", { name: /create an account/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveFocus());
    expect(screen.queryByRole("button", { name: /edit brief/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /editable markdown brief/i })).not.toBeInTheDocument();
    expect(api.runWebOnboardingTurnV4).not.toHaveBeenCalled();
    expect(api.finalizeWebOnboardingV4).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /close secure details/i })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".match-preview__card")).toHaveLength(3);
  });


  it("keeps the finding state until matching returns, and retries without regenerating the brief", async () => {
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({ snapshot: reviewSnapshot() });
    let rejectMatching: (error: Error) => void = () => {};
    api.matchWebOnboardingDraftV1.mockImplementationOnce(() => new Promise((_, reject) => {
      rejectMatching = reject;
    }));
    render(<Harness />);

    expect(await screen.findByRole("status", { name: /finding your personal trainer/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /we found/i })).not.toBeInTheDocument();
    await act(async () => rejectMatching(new Error("Matching is unavailable. Try again.")));
    fireEvent.click(await screen.findByRole("button", { name: /^try again$/i }));

    expect(await screen.findByRole("heading", { name: "We found 5 matches" })).toBeInTheDocument();
    expect(api.matchWebOnboardingDraftV1).toHaveBeenCalledTimes(2);
    expect(api.finalizeWebOnboardingV4).not.toHaveBeenCalled();
  });

  it("shows one matched trainer with singular copy", async () => {
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({ snapshot: reviewSnapshot({
      matching: { totalMatches: 1, previews: [TRAINERS[3]!] },
    }) });
    render(<Harness />);

    expect(await screen.findByRole("heading", { name: "We found 1 match" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /choose match/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /choose match 1, rohan kapoor/i })).toBeInTheDocument();
    expect(api.matchWebOnboardingDraftV1).not.toHaveBeenCalled();
  });

  it("shows closest options without describing them as compatible matches", async () => {
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({ snapshot: reviewSnapshot({
      matching: { totalMatches: 1, previews: [TRAINERS[3]!], matchKind: "closest" },
    }) });
    render(<Harness />);
    expect(await screen.findByRole("heading", { name: "Explore your closest options" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Your closest trainer options" })).toBeInTheDocument();
    expect(screen.queryByText("We found 1 match")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /choose match 1/i }));
    expect(await screen.findByRole("dialog", { name: "Create an account" })).toBeInTheDocument();
  });

  it("lets someone save their account when no trainers are available", async () => {
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({ snapshot: reviewSnapshot({
      matching: { totalMatches: 0, previews: [] },
    }) });
    render(<Harness />);

    expect(await screen.findByRole("heading", { name: "No trainers available yet" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Your trainer matches" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose match/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(await screen.findByRole("dialog", { name: "Create an account" })).toBeInTheDocument();
  });

  it("confirms the Markdown profile with identity kept separate", async () => {
    const review = reviewSnapshot();
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({ snapshot: review });
    api.confirmWebOnboardingDraftV3.mockResolvedValue({
      snapshot: { ...review, version: 4, status: "confirmed" },
    });
    render(<Harness />);

    expect(await screen.findByRole("heading", { name: /we found 5 matches/i })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /choose match \d/i })[0]!);
    expect(await screen.findByRole("dialog", { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByText(/stay separate from your conversation/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Sam Taylor" } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: "01/01/1990" } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: "sam@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm and email my link/i }));

    await waitFor(() => expect(api.confirmWebOnboardingDraftV3).toHaveBeenCalledWith(expect.objectContaining({
      profileMarkdown: reviewMarkdown,
      identity: { fullName: "Sam Taylor", dateOfBirth: "01/01/1990", email: "sam@example.com" },
    })));
    expect(auth.requestMagicLink).toHaveBeenCalledWith("sam@example.com");
  });
});
