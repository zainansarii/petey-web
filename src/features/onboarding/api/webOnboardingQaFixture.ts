import { DEMO_TRAINER_FIXTURES as TRAINERS } from "../../discovery/data/demoTrainerFixture";
import {
  ONBOARDING_OPENING_MESSAGES,
  type ConfirmWebOnboardingDraftV3Request,
  type ConfirmWebOnboardingDraftV3Response,
  type ConsumeWebOnboardingDraftV3Request,
  type ConsumeWebOnboardingDraftV3Response,
  type CreateWebOnboardingDraftV3Response,
  type DeleteWebOnboardingDraftV3Request,
  type DeleteWebOnboardingDraftV3Response,
  type FinalizeWebOnboardingV4Request,
  type FinalizeWebOnboardingV4Response,
  type FinalizeWebOnboardingDraftV3Request,
  type FinalizeWebOnboardingDraftV3Response,
  type GetWebOnboardingDraftV3Request,
  type GetWebOnboardingDraftV3Response,
  type OnboardingChatMessage,
  type MatchedTrainer,
  type MatchWebOnboardingDraftV1Request,
  type MatchWebOnboardingDraftV1Response,
  type GetWebClientProfileV3Response,
  type OnboardingDraftSnapshotV3,
  type RunWebOnboardingTurnV3Request,
  type RunWebOnboardingTurnV3Response,
  type RunWebOnboardingTurnV4Request,
  type RunWebOnboardingTurnV4Response,
  type RunWebOnboardingTurnV4StreamChunk,
} from "../model/onboarding";

// Fixed protocol snapshots for manual browser QA only. This module is loaded
// solely by Vite development builds and never interprets the user's text.
const capability = {
  draftId: "00000000-0000-4000-8000-000000000003",
  capability: "browser-qa-capability-v3-00000000000000000000",
};
const createdAt = "2026-09-01T12:00:00.000Z";

const completeProfileMarkdown = `# Training brief

## The trainee
Build strength and feel confident for my wedding.

Has recently started training and wants a sustainable routine around a busy job.

## The trainer
Prefers gentle, conversational coaching from someone who can explain progress clearly.

## The sessions
Happy to train at a private studio or outdoors around Battersea.

Tuesday evenings or Saturday mornings. Around £400–£600 per month.`;

const openingMessages = ONBOARDING_OPENING_MESSAGES.map((text, index): OnboardingChatMessage => ({
  id: `fixture-opening-${index}`,
  role: "assistant",
  text,
  createdAt,
  sequence: index + 1,
}));

const initialSnapshot = (): OnboardingDraftSnapshotV3 => ({
  schemaVersion: 3,
  draftId: capability.draftId,
  version: 1,
  status: "collecting",
  profileMarkdown: null,
  messages: openingMessages,
  quickReplies: [
    "I want to build strength",
    "Help train for a marathon",
    "I want to lose weight before my wedding",
  ],
  expiresAt: "2026-09-02T12:00:00.000Z",
  confirmationVersion: null,
  userTurns: 0,
});

let snapshot: OnboardingDraftSnapshotV3 | null = null;

const assertCapability = (request: GetWebOnboardingDraftV3Request) => {
  if (request.draftId !== capability.draftId || request.capability !== capability.capability || !snapshot) {
    throw new Error("The browser QA fixture has expired.");
  }
};

export const createFixtureDraft = async (): Promise<CreateWebOnboardingDraftV3Response> => {
  snapshot = initialSnapshot();
  return { ...capability, snapshot: structuredClone(snapshot) };
};

export const getFixtureDraft = async (
  request: GetWebOnboardingDraftV3Request,
): Promise<GetWebOnboardingDraftV3Response> => {
  assertCapability(request);
  return { snapshot: structuredClone(snapshot!) };
};

export const runFixtureTurn = async (
  request: RunWebOnboardingTurnV3Request,
  abortSignal?: AbortSignal,
): Promise<RunWebOnboardingTurnV3Response> => {
  assertCapability(request);
  if (abortSignal?.aborted) throw new DOMException("The request was cancelled.", "AbortError");
  snapshot = {
    ...snapshot!,
    version: snapshot!.version + 1,
    status: "ready_to_map",
    profileMarkdown: null,
    messages: [
      ...snapshot!.messages,
      { id: "fixture-user", role: "user", text: request.message, createdAt, sequence: 3 },
      {
        id: "fixture-assistant",
        role: "assistant",
        text: "Thanks! We have everything needed now to find your match.",
        createdAt,
        sequence: 4,
      },
    ],
    quickReplies: [],
    userTurns: 5,
  };
  return { snapshot: structuredClone(snapshot) };
};

export const runFixtureTurnV4 = async (
  request: RunWebOnboardingTurnV4Request,
  abortSignal?: AbortSignal,
): Promise<{
  stream: AsyncIterable<RunWebOnboardingTurnV4StreamChunk>;
  data: Promise<RunWebOnboardingTurnV4Response>;
}> => {
  if (abortSignal?.aborted) throw new DOMException("The request was cancelled.", "AbortError");
  // Opt-in, local-only conversation for keyboard, streaming and scroll QA.
  // The default fixture still completes in one turn for handoff checks.
  const chatFixture = new URLSearchParams(window.location.search).get("chatFixture") === "1";
  const turns = [
    { reply: "What would you most like to feel different about your training?", quickReplies: ["More confident in the gym", "Stronger and more consistent", "Ready for my first marathon"] },
    { reply: "What sort of personality would you like your trainer to have?", quickReplies: ["Friendly and understanding", "Focused and challenging", "Calm and patient"] },
    { reply: "How would you like that patience and encouragement to show up in your sessions?", quickReplies: ["Explaining things clearly without rushing", "Checking in on how I feel", "Celebrating small wins with me"] },
    { reply: "What days and times would usually work for training with your trainer?", quickReplies: ["Weekday evenings", "Weekend mornings", "My schedule changes each week"] },
  ];
  const turn = chatFixture ? turns[request.messages.filter(({ role }) => role === "user").length - 1] : undefined;
  if (turn) {
    const result = { ...turn, readyForReview: false };
    return {
      stream: (async function* () {
        for (const word of turn.reply.split(" ")) {
          await new Promise((resolve) => setTimeout(resolve, 45));
          if (abortSignal?.aborted) throw new DOMException("The request was cancelled.", "AbortError");
          yield { type: "reply_delta", text: `${word} ` } as const;
        }
      })(),
      data: new Promise((resolve) => setTimeout(() => resolve({
        result,
        timings: { rateLimitMs: 0, modelFirstChunkMs: 45, firstReplyChunkMs: 45, modelTotalMs: 1_500, totalMs: 1_500 },
      }), 1_500)),
    };
  }
  const reply = "Thanks! We have everything needed now to find your match.";
  const data = Promise.resolve({
    result: { reply, readyForReview: true, quickReplies: [] },
    timings: {
      rateLimitMs: 0,
      modelFirstChunkMs: 12,
      firstReplyChunkMs: 14,
      modelTotalMs: 24,
      totalMs: 25,
    },
  });
  return {
    stream: (async function* streamFixtureReply() {
      if (request.messages.length === 0) throw new Error("The fixture transcript is empty.");
      yield { type: "reply_delta", text: "Thanks! We have everything needed " } as const;
      yield { type: "reply_delta", text: "now to find your match." } as const;
    })(),
    data,
  };
};

export const finalizeFixtureDraft = async (
  request: FinalizeWebOnboardingDraftV3Request,
): Promise<FinalizeWebOnboardingDraftV3Response> => {
  assertCapability(request);
  snapshot = {
    ...snapshot!,
    version: snapshot!.version + 1,
    status: "review",
    profileMarkdown: completeProfileMarkdown,
  };
  return { snapshot: structuredClone(snapshot) };
};

export const finalizeFixtureV4 = async (
  request: FinalizeWebOnboardingV4Request,
): Promise<FinalizeWebOnboardingV4Response> => {
  snapshot = {
    ...initialSnapshot(),
    version: 1,
    status: "review",
    profileMarkdown: completeProfileMarkdown,
    messages: [],
    quickReplies: [],
    userTurns: request.messages.filter(({ role }) => role === "user").length,
  };
  return {
    ...capability,
    snapshot: structuredClone(snapshot),
    timings: { rateLimitMs: 0, modelMs: 20, writeMs: 1, totalMs: 21 },
  };
};

const fixtureMatches = (): MatchedTrainer[] => {
  const closest = new URLSearchParams(window.location.search).has("fixtureClosest");
  const count = Number(new URLSearchParams(window.location.search).get("fixtureMatchCount") ?? 5);
  return TRAINERS.slice(0, Number.isFinite(count) ? Math.max(0, count) : 5).map((trainer, index) => ({
    trainer,
    score: closest ? 65 - index * 4 : 92 - index * 4,
    matchKind: closest ? "closest" : "compatible",
    reason: closest ? "Their strength coaching could suit your goal, but the session price exceeds your maximum." : "Their encouraging coaching and session options fit your training brief.",
    dealbreakers: { budget: closest ? "not_met" : "met", venue: "met", location: "met", availability: closest ? "unconfirmed" : "met", trainerGender: "not_required", otherRequirements: "not_required" },
    tradeoffs: closest ? ["Their conversational style may be more talkative than you prefer."] : [],
  }));
};

export const matchFixtureDraft = async (
  request: MatchWebOnboardingDraftV1Request,
): Promise<MatchWebOnboardingDraftV1Response> => {
  assertCapability(request);
  const matches = fixtureMatches();
  const matching = {
    totalMatches: matches.length,
    matchKind: matches[0]?.matchKind ?? "compatible",
    previews: matches.slice(0, 3).map(({ trainer }) => {
      const { id, name, photo, specialty, area, price, isDemo } = trainer;
      return { id, name, photo, specialty, area, price, isDemo };
    }),
  };
  snapshot = { ...snapshot!, matching };
  return { matching: structuredClone(matching) };
};

export const getFixtureClientProfile = async (): Promise<GetWebClientProfileV3Response> => ({
  profileMarkdown: snapshot?.profileMarkdown ?? null,
  matches: snapshot?.profileMarkdown ? fixtureMatches() : [],
});

export const confirmFixtureDraft = async (
  request: ConfirmWebOnboardingDraftV3Request,
): Promise<ConfirmWebOnboardingDraftV3Response> => {
  assertCapability(request);
  const version = snapshot!.version + 1;
  snapshot = {
    ...snapshot!,
    profileMarkdown: request.profileMarkdown,
    version,
    status: "confirmed",
    confirmationVersion: version,
  };
  return { snapshot: structuredClone(snapshot) };
};

export const consumeFixtureDraft = async (
  request: ConsumeWebOnboardingDraftV3Request,
): Promise<ConsumeWebOnboardingDraftV3Response> => {
  assertCapability(request);
  return { profileMarkdown: snapshot!.profileMarkdown!, matches: fixtureMatches() };
};

export const deleteFixtureDraft = async (
  request: DeleteWebOnboardingDraftV3Request,
): Promise<DeleteWebOnboardingDraftV3Response> => {
  assertCapability(request);
  snapshot = null;
  return { deleted: true };
};
