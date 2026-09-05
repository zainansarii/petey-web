import { z } from "zod";
import type { Trainer, TrainerCardPreview } from "../../discovery/model/trainer.js";

export const MAX_PROFILE_MARKDOWN_LENGTH = 12_000;
export const MAX_ONBOARDING_QUICK_REPLIES = 3;
export const MAX_ONBOARDING_QUICK_REPLY_LENGTH = 80;

export type IdentityAnswers = {
  fullName: string;
  dateOfBirth: string;
  email: string;
};

export const INITIAL_IDENTITY_ANSWERS: IdentityAnswers = {
  fullName: "",
  dateOfBirth: "",
  email: "",
};

export const ONBOARDING_OPENING_MESSAGES = [
  "Hi, welcome to Petey!",
  "To get you matched with the best personal trainer for you, tell us a bit about what you're hoping to achieve. The more detailed your responses, the better we'll be able to match you.",
] as const;

export const ONBOARDING_OPENING_QUICK_REPLIES = [
  "I want to build strength",
  "Help train for a marathon",
  "I want to lose weight before my wedding",
] as const;

export const profileMarkdownSchema = z.string()
  .trim()
  .min(20, "The matching profile needs a little more detail.")
  .max(MAX_PROFILE_MARKDOWN_LENGTH, "Keep the matching profile under 12,000 characters.");

export const isValidIsoCalendarDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

export const formatDobInput = (value: string) => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
};

export const isAdultDate = (value: string, today = new Date()) => {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const ukMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const parts = isoMatch
    ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
    : ukMatch
      ? [Number(ukMatch[3]), Number(ukMatch[2]), Number(ukMatch[1])]
      : null;
  if (!parts) return false;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year!, month! - 1, day));
  if (Number.isNaN(date.getTime())) return false;
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) return false;
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - date.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < date.getUTCDate())) age -= 1;
  return age >= 18 && age < 100;
};

export const identityAnswersSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(100),
  dateOfBirth: z.string().refine(isAdultDate, "Enter a valid date of birth. You must be 18 or over."),
  email: z.string().trim().email("Enter a valid email address.").max(320),
}).strict();

export const parseIdentityAnswers = (value: unknown) => identityAnswersSchema.safeParse(value);

export type OnboardingChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: string;
  sequence: number;
};

export type OnboardingDraftStatus = "collecting" | "ready_to_map" | "review" | "confirmed" | "consumed";

export type OnboardingTurnResultV3 = {
  reply: string;
  readyForReview: boolean;
  quickReplies: string[];
};

export type OnboardingConversationSessionV4 = {
  schemaVersion: 4;
  status: "collecting" | "ready_to_map";
  messages: OnboardingChatMessage[];
  quickReplies: string[];
  userTurns: number;
  updatedAt: string;
};

export type OnboardingTurnTimingsV4 = {
  rateLimitMs: number;
  modelFirstChunkMs: number | null;
  firstReplyChunkMs: number | null;
  modelTotalMs: number;
  totalMs: number;
};

export type RunWebOnboardingTurnV4Request = {
  messages: OnboardingChatMessage[];
};

export type RunWebOnboardingTurnV4Response = {
  result: OnboardingTurnResultV3;
  timings: OnboardingTurnTimingsV4;
};

export type RunWebOnboardingTurnV4StreamChunk = {
  type: "reply_delta";
  text: string;
};

export type FinalizeWebOnboardingV4Request = {
  consentVersion: string;
  idempotencyKey: string;
  messages: OnboardingChatMessage[];
};

export type FinalizeWebOnboardingV4Response = DraftCapability & {
  snapshot: OnboardingDraftSnapshotV3;
  timings: {
    rateLimitMs: number;
    modelMs: number;
    writeMs: number;
    totalMs: number;
  };
};

export type MatchPreviewResult = {
  totalMatches: number;
  previews: TrainerCardPreview[];
};

export type MatchedTrainer = { trainer: Trainer; score: number; reason: string };
export type MatchWebOnboardingDraftV1Request = DraftCapability;
export type MatchWebOnboardingDraftV1Response = { matching: MatchPreviewResult };

export type OnboardingDraftSnapshotV3 = {
  schemaVersion: 3;
  draftId: string;
  version: number;
  status: OnboardingDraftStatus;
  profileMarkdown: string | null;
  messages: OnboardingChatMessage[];
  quickReplies: string[];
  expiresAt: string;
  confirmationVersion: number | null;
  matching?: MatchPreviewResult;
  userTurns: number;
};

export type DraftCapability = { draftId: string; capability: string };

export type CreateWebOnboardingDraftV3Request = { consentVersion: string; idempotencyKey: string };
export type CreateWebOnboardingDraftV3Response = DraftCapability & { snapshot: OnboardingDraftSnapshotV3 };
export type GetWebOnboardingDraftV3Request = DraftCapability;
export type GetWebOnboardingDraftV3Response = { snapshot: OnboardingDraftSnapshotV3 };
export type RunWebOnboardingTurnV3Request = DraftCapability & {
  message: string;
  idempotencyKey: string;
  expectedVersion: number;
};
export type RunWebOnboardingTurnV3Response = { snapshot: OnboardingDraftSnapshotV3 };
export type FinalizeWebOnboardingDraftV3Request = DraftCapability & {
  idempotencyKey: string;
  expectedVersion: number;
};
export type FinalizeWebOnboardingDraftV3Response = { snapshot: OnboardingDraftSnapshotV3 };
export type ConfirmWebOnboardingDraftV3Request = DraftCapability & {
  expectedVersion: number;
  profileMarkdown: string;
  identity: IdentityAnswers;
};
export type ConfirmWebOnboardingDraftV3Response = { snapshot: OnboardingDraftSnapshotV3 };
export type ConsumeWebOnboardingDraftV3Request = DraftCapability;
export type ConsumeWebOnboardingDraftV3Response = { profileMarkdown: string; matches: MatchedTrainer[] };
export type GetWebClientProfileV3Response = { profileMarkdown: string | null; matches: MatchedTrainer[] };
export type DeleteWebOnboardingDraftV3Request = DraftCapability;
export type DeleteWebOnboardingDraftV3Response = { deleted: true };
export type WithdrawWebHealthConsentV3Request = { consentVersion: string };
export type WithdrawWebHealthConsentV3Response = { withdrawn: true };

const TURN_PROGRESS = [12, 27, 41, 53, 63, 71, 78, 84, 88, 91, 93, 95, 96] as const;

export const conversationProgress = (status: OnboardingDraftStatus, userTurns: number) => {
  const isComplete = status !== "collecting";
  const boundedTurn = Math.max(0, Math.min(Math.floor(userTurns), TURN_PROGRESS.length - 1));
  return {
    percent: isComplete ? 100 : TURN_PROGRESS[boundedTurn],
    isComplete,
  };
};
