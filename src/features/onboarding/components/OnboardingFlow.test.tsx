import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const api = vi.hoisted(() => ({
  clearLocalConversationV4: vi.fn(),
  clearDraftCapability: vi.fn(),
  confirmWebOnboardingDraftV3: vi.fn(),
  createLocalConversationV4: vi.fn(),
  createIdempotencyKey: vi.fn(() => "turn-key"),
  deleteWebOnboardingDraftV3: vi.fn(),
  finalizeWebOnboardingV4: vi.fn(),
  getWebOnboardingDraftV3: vi.fn(),
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

const reviewSnapshot = (overrides: Partial<OnboardingDraftSnapshotV3> = {}) => createSnapshot({
  version: 3,
  status: "review",
  profileMarkdown: reviewMarkdown,
  quickReplies: [],
  userTurns: 5,
  ...overrides,
});

const onMagicLinkRequested = vi.fn();

function Harness() {
  const [profileMarkdown, setProfileMarkdown] = useState("");
  const [identity, setIdentity] = useState<IdentityAnswers>(INITIAL_IDENTITY_ANSWERS);
  return (
    <>
      <OnboardingFlow
        identity={identity}
        onExit={vi.fn()}
        onIdentityChange={setIdentity}
        onMagicLinkRequested={onMagicLinkRequested}
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
    api.readDraftCapability.mockReturnValue(null);
    api.readLocalConversationV4.mockReturnValue(null);
    api.createLocalConversationV4.mockImplementation(() => createSession());
  });

  it("opens with the requested welcome, examples, and compact conversation progress", async () => {
    render(<Harness />);

    expect(await screen.findByText("Hi, welcome to Petey!")).toBeInTheDocument();
    expect(screen.getByText("To get you matched with the best personal trainer for you, tell us a bit about what you're hoping to achieve.")).toBeInTheDocument();
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

  it("finalizes once and opens secure details over the chat without showing the generated brief", async () => {
    api.runWebOnboardingTurnV4.mockImplementation(() => streamedTurn({
      reply: "That gives me everything I need. Secure final details are next.",
      readyForReview: true,
      quickReplies: [],
    }));
    api.finalizeWebOnboardingV4.mockResolvedValue({
      ...capability,
      snapshot: reviewSnapshot(),
      timings: { rateLimitMs: 5, modelMs: 100, writeMs: 20, totalMs: 125 },
    });
    render(<Harness />);

    await sendAnswer("Weekends work");

    const dialog = await screen.findByRole("dialog", { name: /secure final details/i });
    expect(api.finalizeWebOnboardingV4).toHaveBeenCalledTimes(1);
    expect(api.finalizeWebOnboardingV4).toHaveBeenCalledWith(expect.objectContaining({
      consentVersion: "2026-08-31",
      idempotencyKey: "turn-key",
      messages: expect.arrayContaining([expect.objectContaining({ text: "Weekends work" })]),
    }));
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Hi, welcome to Petey!")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /training brief preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /your training brief/i })).not.toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(/warm and friendly/i);
    expect(screen.queryByRole("textbox", { name: /your answer/i })).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /conversation progress/i, hidden: true })).toHaveAttribute("aria-valuenow", "100");
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

    const retry = await screen.findByRole("button", { name: /try preparing again/i });
    expect(screen.getByText("Hi, welcome to Petey!")).toBeInTheDocument();
    fireEvent.click(retry);

    expect(await screen.findByRole("dialog", { name: /secure final details/i })).toBeInTheDocument();
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

  it("opens secure details immediately for a restored completed conversation", async () => {
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({ snapshot: reviewSnapshot() });
    render(<Harness />);
    expect(await screen.findByRole("dialog", { name: /secure final details/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/full name/i)).toHaveFocus());
    expect(screen.queryByRole("button", { name: /edit brief/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /editable markdown brief/i })).not.toBeInTheDocument();
    expect(api.runWebOnboardingTurnV4).not.toHaveBeenCalled();
    expect(api.finalizeWebOnboardingV4).not.toHaveBeenCalled();
  });

  it("confirms the Markdown profile with identity kept separate", async () => {
    const review = reviewSnapshot();
    api.readDraftCapability.mockReturnValue(capability);
    api.getWebOnboardingDraftV3.mockResolvedValue({ snapshot: review });
    api.confirmWebOnboardingDraftV3.mockResolvedValue({
      snapshot: { ...review, version: 4, status: "confirmed" },
    });
    render(<Harness />);

    expect(await screen.findByRole("dialog", { name: /secure final details/i })).toBeInTheDocument();
    expect(screen.getByText(/private details stay separate/i)).toBeInTheDocument();
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
