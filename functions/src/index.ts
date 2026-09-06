import { createHash, randomUUID } from "node:crypto";
import {
  type Content,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
} from "@google/genai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineString } from "firebase-functions/params";
import {
  HttpsError,
  onCall,
  type CallableRequest,
  type CallableResponse,
} from "firebase-functions/v2/https";
import { z } from "zod";
import {
  MAX_ONBOARDING_QUICK_REPLIES,
  MAX_ONBOARDING_QUICK_REPLY_LENGTH,
  ONBOARDING_OPENING_MESSAGES,
  ONBOARDING_OPENING_QUICK_REPLIES,
  identityAnswersSchema,
  profileMarkdownSchema,
  type ConfirmWebOnboardingDraftV3Request,
  type ConfirmWebOnboardingDraftV3Response,
  type ConsumeWebOnboardingDraftV3Request,
  type ConsumeWebOnboardingDraftV3Response,
  type CreateWebOnboardingDraftV3Request,
  type CreateWebOnboardingDraftV3Response,
  type DeleteWebOnboardingDraftV3Request,
  type DeleteWebOnboardingDraftV3Response,
  type FinalizeWebOnboardingV4Request,
  type FinalizeWebOnboardingV4Response,
  type FinalizeWebOnboardingDraftV3Request,
  type FinalizeWebOnboardingDraftV3Response,
  type GetWebOnboardingDraftV3Request,
  type GetWebOnboardingDraftV3Response,
  type GetWebClientProfileV3Response,
  type IdentityAnswers,
  type OnboardingChatMessage,
  type OnboardingDraftSnapshotV3,
  type OnboardingDraftStatus,
  type OnboardingTurnResultV3,
  type RunWebOnboardingTurnV4Request,
  type RunWebOnboardingTurnV4Response,
  type RunWebOnboardingTurnV4StreamChunk,
  type RunWebOnboardingTurnV3Request,
  type RunWebOnboardingTurnV3Response,
  type WithdrawWebHealthConsentV3Request,
  type WithdrawWebHealthConsentV3Response,
} from "../../src/features/onboarding/model/onboardingContract.js";
import {
  ONBOARDING_CONVERSATION_SYSTEM_PROMPT,
  ONBOARDING_MARKDOWN_PROFILE_SYSTEM_PROMPT,
} from "./onboardingConversationPrompt.js";
import {
  ensureWebMatching, readSavedMatching, webMatchedProfiles, webMatchPreviews,
  type SavedMatching,
} from "./webMatching.js";
import { assertProfileConsumption } from "./webProfileConsumption.js";
import type { TrainerMatchingRequest } from "./trainerMatching.js";
import type { DraftCapability, MatchPreviewResult } from "../../src/features/onboarding/model/onboardingContract.js";

initializeApp();
const db = getFirestore();

const drafts = db.collection("webOnboardingDraftsV3");
const rateLimits = db.collection("_webOnboardingRateLimitsV3");
const consumptions = db.collection("_webOnboardingConsumptionsV3");
const profiles = db.collection("webClientProfiles");
const health = db.collection("webClientHealth");

const geminiModel = defineString("WEB_ONBOARDING_GEMINI_MODEL_V3", { default: "gemini-3.7-flash" });
const chatGeminiModelV4 = defineString("WEB_ONBOARDING_CHAT_MODEL_V4", { default: "gemini-3.5-flash-lite" });
const summaryGeminiModelV4 = defineString("WEB_ONBOARDING_SUMMARY_MODEL_V4", { default: "gemini-3.7-flash" });
const matchingGeminiModel = defineString("WEB_MATCHING_GEMINI_MODEL_V1", { default: "gemini-3.7-flash" });
const runtimeServiceAccount = defineString("WEB_ONBOARDING_SERVICE_ACCOUNT_V3");
const REGION = "europe-west2";
const GEMINI_LOCATION = "global";
const callableOptions = {
  region: REGION,
  enforceAppCheck: true,
  serviceAccount: runtimeServiceAccount,
} as const;
const DRAFT_TTL_MS = 24 * 60 * 60 * 1_000;
const CONSUMPTION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_MESSAGE_LENGTH = 2_000;
const CONSENT_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEVELOPMENT_PROJECT_ID = "petey-dev-getcass";

export const createRateLimitForProjectV3 = (projectId: string | undefined) => (
  projectId === DEVELOPMENT_PROJECT_ID ? 50 : 5
);

export const turnRateLimitForProjectV4 = (projectId: string | undefined) => (
  projectId === DEVELOPMENT_PROJECT_ID ? 300 : 30
);

export const finalizationRateLimitForProjectV4 = (projectId: string | undefined) => (
  projectId === DEVELOPMENT_PROJECT_ID ? 80 : 8
);

type DraftDoc = {
  schemaVersion: 3;
  profileFormat: "markdown-v1";
  capabilityHash: string;
  consentVersion: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;
  version: number;
  status: OnboardingDraftStatus;
  confirmationVersion: number | null;
  profileMarkdown: string | null;
  quickReplies: string[];
  userTurns: number;
  nextSequence: number;
  identity?: IdentityAnswers;
  matching?: SavedMatching;
};

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const uuidFromDigest = (value: string) => {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const draftIdentityForIdempotencyKeyV3 = (idempotencyKey: string) => ({
  draftId: uuidFromDigest(`petey-web-v3-draft-id:${idempotencyKey}`),
  capability: createHash("sha256")
    .update(`petey-web-v3-capability:${idempotencyKey}`)
    .digest("base64url"),
});

const createRequestSchema = z.object({
  consentVersion: z.string().regex(CONSENT_VERSION_PATTERN),
  idempotencyKey: z.string().uuid(),
}).strict();
const capabilityRequestSchema = z.object({
  draftId: z.string().uuid(),
  capability: z.string().min(32).max(128),
}).strict();
const turnRequestSchema = capabilityRequestSchema.extend({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
}).strict();
const chatMessageV4Schema = z.object({
  id: z.string().min(1).max(128),
  role: z.enum(["assistant", "user"]),
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  createdAt: z.string().datetime(),
  sequence: z.number().int().positive(),
}).strict();
const conversationTranscriptV4Schema = z.array(chatMessageV4Schema).min(3).max(40);
const turnRequestV4Schema = z.object({
  messages: conversationTranscriptV4Schema,
}).strict();
const finalizeRequestV4Schema = z.object({
  consentVersion: z.string().regex(CONSENT_VERSION_PATTERN),
  idempotencyKey: z.string().uuid(),
  messages: conversationTranscriptV4Schema,
}).strict();
const finalizeRequestSchema = capabilityRequestSchema.extend({
  idempotencyKey: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
}).strict();
const confirmRequestSchema = capabilityRequestSchema.extend({
  expectedVersion: z.number().int().positive(),
  profileMarkdown: z.string().max(12_000),
  identity: z.unknown(),
}).strict();
const withdrawHealthRequestSchema = z.object({
  consentVersion: z.string().regex(CONSENT_VERSION_PATTERN),
}).strict();

const parseData = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues[0]?.message ?? "The request is invalid.");
  }
  return parsed.data;
};

export const validateAndCanonicalizeConversationTranscriptV4 = (
  messages: readonly OnboardingChatMessage[],
  endingRole: OnboardingChatMessage["role"],
) => {
  if (
    messages[0]?.role !== "assistant"
    || messages[1]?.role !== "assistant"
  ) {
    throw new HttpsError("invalid-argument", "The conversation opening is invalid.");
  }
  if (messages.at(-1)?.role !== endingRole) {
    throw new HttpsError("invalid-argument", `The conversation must end with a ${endingRole} message.`);
  }
  if (messages.reduce((total, message) => total + message.text.length, 0) > 30_000) {
    throw new HttpsError("invalid-argument", "The conversation is too long.");
  }
  messages.forEach((message, index) => {
    if (message.sequence !== index + 1) {
      throw new HttpsError("invalid-argument", "The conversation sequence is invalid.");
    }
    if (index < ONBOARDING_OPENING_MESSAGES.length) return;
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    if (message.role !== expectedRole) {
      throw new HttpsError("invalid-argument", "The conversation order is invalid.");
    }
    if (message.role === "assistant") {
      try {
        normalizeConversationalReply(message.text);
      } catch {
        throw new HttpsError("invalid-argument", "A previous assistant reply is invalid.");
      }
    }
  });
  return messages.map((message, index) => index < ONBOARDING_OPENING_MESSAGES.length
    ? { ...message, text: ONBOARDING_OPENING_MESSAGES[index]! }
    : message);
};

const ensureAppCheck = (request: CallableRequest<unknown>) => {
  if (!request.app) throw new HttpsError("failed-precondition", "App Check is required.");
};

const providerErrorDetails = (error: unknown) => {
  const record = typeof error === "object" && error !== null
    ? error as Record<string, unknown>
    : {};
  return {
    errorType: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown provider error",
    errorStatus: typeof record.status === "number" || typeof record.status === "string"
      ? record.status
      : null,
    errorCode: typeof record.code === "number" || typeof record.code === "string"
      ? record.code
      : null,
  };
};

const requestIpKey = (request: CallableRequest<unknown>) => {
  const forwarded = request.rawRequest.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return hash(ip?.trim() || request.rawRequest.ip || "unknown").slice(0, 24);
};

const enforceRateLimit = async (key: string, limit: number, windowMs: number) => {
  const ref = rateLimits.doc(hash(key));
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as { count?: number; windowStartedAt?: Timestamp } | undefined;
    const startedAt = data?.windowStartedAt?.toMillis() ?? 0;
    const withinWindow = now - startedAt < windowMs;
    const count = withinWindow ? (data?.count ?? 0) : 0;
    if (count >= limit) throw new HttpsError("resource-exhausted", "Please wait a moment before trying again.");
    transaction.set(ref, {
      count: count + 1,
      windowStartedAt: withinWindow ? data!.windowStartedAt : Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + windowMs),
    });
  });
};

const cleanModelText = (value: string) => value
  .trim()
  .replace(/^```(?:json|markdown|md|text)?\s*/i, "")
  .replace(/\s*```$/, "")
  .trim();

export type OnboardingThemeCoverageV4 = {
  trainee: boolean;
  trainer: boolean;
  sessions: boolean;
};

type ConversationalModelTurnV4 = {
  reply: string;
  coverage: OnboardingThemeCoverageV4;
  quickReplies: string[];
};

const themeCoverageV4Schema = z.object({
  trainee: z.boolean(),
  trainer: z.boolean(),
  sessions: z.boolean(),
}).strict();

const conversationalModelEnvelopeSchema = z.object({
  reply: z.string().trim().min(1).max(2_000),
  coverage: themeCoverageV4Schema,
  quickReplies: z.array(z.string().min(1).max(200)).max(MAX_ONBOARDING_QUICK_REPLIES).default([]),
}).strict();

const isSafeQuickReply = (value: string) => (
  value.length <= MAX_ONBOARDING_QUICK_REPLY_LENGTH
  && !value.includes("?")
  && !/[{}[\]`]/.test(value)
  && !/\b(?:json|coverage|quickReplies|response schema)\b/i.test(value)
);

const addPoundSignsToBudgetNumbers = (value: string) => value
  .replace(/\b(?:GBP|pounds?)\s*(\d+(?:[.,]\d{1,2})?)/gi, "£$1")
  .replace(/(?<![£$€\d])(\d+(?:[.,]\d{1,2})?)(?![\d%])/g, "£$1")
  .replace(/£(\d+(?:[.,]\d{1,2})?)\s*(?:pounds?|GBP)\b/gi, "£$1");

const replaceEmDashes = (value: string) => value.replace(/\u2014/g, "-");

const normalizeQuickReplies = (values: string[], reply: string) => {
  if (practicalTopicAskedInV3(reply) === "trainingSettingAnswered") {
    return ["Home", "Online", "Commercial gym", "Private studio"];
  }
  return values.flatMap((value) => {
    const cleaned = replaceEmDashes(value).replace(/\s+/g, " ").trim().replace(/\.+$/, "").trim();
    const normalized = /\bbudget\b/i.test(reply) ? addPoundSignsToBudgetNumbers(cleaned) : cleaned;
    if (!isSafeQuickReply(normalized)) return [];
    return [normalized];
  });
};

const normalizeConversationalReply = (value: string) => {
  let reply = replaceEmDashes(value).replace(/\s+/g, " ").trim();
  if (
    !reply
    || /[{}[\]`]/.test(reply)
    || /\b(?:json|coverage|quickReplies|response schema)\b/i.test(reply)
  ) {
    throw new Error("The model returned metadata instead of a conversational reply.");
  }

  const firstQuestionMark = reply.indexOf("?");
  if (firstQuestionMark >= 0) reply = reply.slice(0, firstQuestionMark + 1);
  const question = firstQuestionIn(reply);
  if (isTrainingFrequencyQuestion(question) && !/\bwith (?:your|a|the) (?:personal )?(?:trainer|coach)\b/i.test(question)) {
    return "How often would you like to train with your trainer?";
  }
  return reply.slice(0, 500);
};

export const parseConversationalModelOutputV3 = (raw: string): ConversationalModelTurnV4 => {
  const cleaned = cleanModelText(raw);
  if (!cleaned) throw new Error("The model returned no usable reply.");
  let parsedJson: unknown;
  let isJson = false;
  try {
    parsedJson = JSON.parse(cleaned) as unknown;
    isJson = true;
  } catch {
    // Raw prose remains a defensive fallback for provider/model drift.
  }

  if (!isJson) {
    return {
      reply: normalizeConversationalReply(cleaned),
      coverage: { trainee: false, trainer: false, sessions: false },
      quickReplies: [],
    };
  }

  const envelope = conversationalModelEnvelopeSchema.safeParse(parsedJson);
  if (!envelope.success) {
    throw new Error("The model returned invalid structured output instead of a reply.");
  }

  const reply = normalizeConversationalReply(envelope.data.reply);
  return {
    reply,
    coverage: envelope.data.coverage,
    quickReplies: reply.includes("?") ? normalizeQuickReplies(envelope.data.quickReplies, reply) : [],
  };
};

export const hasReviewReadinessPhrasingV3 = (reply: string) => [
  /\b(?:i(?:'ve| have)|we(?:'ve| have))(?: now)? (?:got )?(?:everything|all|enough) (?:that )?(?:i|we) need\b/i,
  /\b(?:i(?:'ve| have)|we(?:'ve| have)) everything needed(?: now)? to find your match\b/i,
  /\b(?:i(?:'ve| have)|we(?:'ve| have))(?: now)? (?:got )?enough to (?:prepare|put together|create|draft|generate) (?:your|the) (?:training )?(?:brief|review|notes)\b/i,
  /\b(?:i(?:'m| am)|we(?:'re| are)) ready to (?:prepare|put together|create|draft|generate) (?:your|the) (?:training )?(?:brief|review|notes)\b/i,
  /\b(?:i(?:'ll| will)|we(?:'ll| will)) (?:now )?(?:prepare|put together|create|draft|generate) (?:your|the) (?:training )?(?:brief|review|notes)\b/i,
].some((pattern) => pattern.test(reply));

export type RequiredPracticalTopicsV3 = {
  coachingStyleAnswered: boolean;
  trainerGenderPreferenceAnswered: boolean;
  trainingSettingAnswered: boolean;
  locationAnswered: boolean;
  trainingFrequencyAnswered: boolean;
  availabilityAnswered: boolean;
  budgetAnswered: boolean;
};

type ConversationalMessage = Pick<OnboardingChatMessage, "role" | "text">;
type RequiredPracticalTopic = keyof RequiredPracticalTopicsV3;

const firstQuestionIn = (message: string) => {
  const end = message.indexOf("?");
  return end < 0 ? "" : message.slice(0, end + 1).match(/[^.!?]*\?$/)?.[0] ?? "";
};

const isTrainingFrequencyQuestion = (question: string) => !/\b(?:currently|at the moment|on your own|independently|solo|already)\b/i.test(question) && [
  /\btraining frequency\b/i,
  /\bhow often\b[^?]{0,75}\b(?:train|work ?out|exercise|have sessions?|meet)\b/i,
  /\bhow many\b[^?]{0,65}\b(?:sessions?|workouts?|times?)\b/i,
].some((pattern) => pattern.test(question));

const isOnlineOnlyQuestion = (question: string) => /\b(?:online|remote)[ -]only\b|\bonly (?:be )?(?:online|remote)\b/i.test(question);

const confirmsOnlineOnly = (answer: string) => (
  /^(?:yes|yeah|yep|correct|exactly)\b|\b(?:online|remote) only\b|\bonly(?: want| do| have)? (?:online|remote)\b/i.test(answer.trim())
  && !/\b(?:no|not|except|but|also|maybe|sometimes|in[ -]person|gym|studio)\b/i.test(answer)
);

const practicalTopicAskedInV3 = (message: string): RequiredPracticalTopic | null => {
  const question = firstQuestionIn(message);
  if (!question) return null;

  const coachingStyleAsked = [
    /\b(?:training|coaching) style\b/i,
    /\b(?:trainer|coach)(?:'s)?\b[^?]{0,45}\b(?:approach|personality)\b/i,
    /\bpersonality\b[^?]{0,55}\b(?:trainer|coach)\b/i,
    /\bwhat kind of (?:trainer|coach)\b[^?]{0,55}\b(?:best|prefer|motivat|accountab|support)\w*/i,
  ].some((pattern) => pattern.test(question));
  const trainerGenderPreferenceAsked = [
    /\bgender preference\b/i,
    /\bpreference\b[^?]{0,50}\bgender\b/i,
    /\bgender\b[^?]{0,50}\bpreference\b/i,
    /\b(?:trainer|coach)\b[^?]{0,45}\b(?:man|woman|male|female|non[- ]?binary|any gender)\b/i,
    /\b(?:man|woman|male|female|non[- ]?binary|any gender)\b[^?]{0,45}\b(?:trainer|coach)\b/i,
  ].some((pattern) => pattern.test(question));
  const availabilityAsked = [
    /\bavailability\b/i,
    /\bschedule\b/i,
    /\bwhen (?:are|would|can|could|do) you\b[^?]{0,50}\b(?:available|train|work out|exercise)\b/i,
    /\bwhat (?:days?|times?|times? of day|part of the day)\b/i,
    /\bwhich (?:days?|times?)\b/i,
    /\b(?:days?|times?|mornings?|afternoons?|evenings?|weekends?)\b[^?]{0,35}\b(?:work|suit|fit|best)\b/i,
  ].some((pattern) => pattern.test(question));
  const trainingFrequencyAsked = isTrainingFrequencyQuestion(question)
    && /\bwith (?:your|a|the) (?:personal )?(?:trainer|coach)\b/i.test(question);
  if (isTrainingFrequencyQuestion(question) && !trainingFrequencyAsked) return null;
  const locationAsked = /\b(?:rough area|local area|neighbourhood|neighborhood|town|borough|city|location)\b/i.test(question)
    || /\b(?:what|which) area\b/i.test(question) && !/\barea of (?:fitness|training|your|the)\b/i.test(question)
    || /\bwhere\b[^?]{0,45}\b(?:live|based)\b/i.test(question)
    || isOnlineOnlyQuestion(question);
  const trainingSettingAsked = !locationAsked && (
    /\b(?:setting|venue|session format)\b/i.test(question)
    || /\bwhere\b[^?]{0,65}\b(?:train|work ?out|sessions?)\b/i.test(question)
    || /\b(?:home|online|gym|studio)\b[^?]{0,55}\b(?:prefer|train)\b/i.test(question)
  );
  const budgetAsked = [
    /\bbudget\b/i,
    /\bhow much\b[^?]{0,45}\b(?:spend|pay|afford|comfortable)\b/i,
    /\bwhat\b[^?]{0,45}\b(?:spend|pay|afford)\b/i,
    /\b(?:price|cost|spending)\b[^?]{0,35}\b(?:range|comfortable|session|month)\b/i,
    /\b(?:per session|per month)\b[^?]{0,35}\b(?:comfortable|work|suit)\b/i,
  ].some((pattern) => pattern.test(question));

  const askedTopics: RequiredPracticalTopic[] = [];
  if (coachingStyleAsked) askedTopics.push("coachingStyleAnswered");
  if (trainerGenderPreferenceAsked) askedTopics.push("trainerGenderPreferenceAnswered");
  if (trainingSettingAsked) askedTopics.push("trainingSettingAnswered");
  if (locationAsked) askedTopics.push("locationAnswered");
  if (trainingFrequencyAsked) askedTopics.push("trainingFrequencyAnswered");
  if (availabilityAsked) askedTopics.push("availabilityAnswered");
  if (budgetAsked) askedTopics.push("budgetAnswered");

  // Required matching topics must each be asked in a separate, focused turn.
  return askedTopics.length === 1 ? askedTopics[0]! : null;
};

export const requiredPracticalTopicsForTranscriptV3 = (
  messages: readonly ConversationalMessage[],
): RequiredPracticalTopicsV3 => {
  const answered: RequiredPracticalTopicsV3 = {
    coachingStyleAnswered: false,
    trainerGenderPreferenceAnswered: false,
    trainingSettingAnswered: false,
    locationAnswered: false,
    trainingFrequencyAnswered: false,
    availabilityAnswered: false,
    budgetAnswered: false,
  };
  let pendingTopic: RequiredPracticalTopic | null = null;
  let pendingOnlineOnly = false;
  let roughAreaAnswered = false;

  for (const message of messages) {
    if (message.role === "assistant") {
      pendingTopic = practicalTopicAskedInV3(message.text);
      pendingOnlineOnly = pendingTopic === "locationAnswered" && isOnlineOnlyQuestion(message.text);
      continue;
    }
    if (pendingTopic && message.text.trim()) {
      if (pendingOnlineOnly) {
        // A mixed/negative/uncertain answer still needs a rough-area question.
        answered.locationAnswered = roughAreaAnswered || confirmsOnlineOnly(message.text);
      } else {
        answered[pendingTopic] = true;
        if (pendingTopic === "locationAnswered") roughAreaAnswered = true;
        if (pendingTopic === "trainingSettingAnswered") answered.locationAnswered = roughAreaAnswered;
      }
    }
    pendingTopic = null;
  }

  return answered;
};

export const shouldReadyForReviewV3 = ({
  coverage,
  coachingStyleAnswered = false,
  trainerGenderPreferenceAnswered = false,
  trainingSettingAnswered = false,
  locationAnswered = false,
  trainingFrequencyAnswered = false,
  availabilityAnswered = false,
  budgetAnswered = false,
}: {
  coverage: OnboardingThemeCoverageV4;
  coachingStyleAnswered?: boolean;
  trainerGenderPreferenceAnswered?: boolean;
  trainingSettingAnswered?: boolean;
  locationAnswered?: boolean;
  trainingFrequencyAnswered?: boolean;
  availabilityAnswered?: boolean;
  budgetAnswered?: boolean;
}) => {
  if (
    !coachingStyleAnswered
    || !trainerGenderPreferenceAnswered
    || !trainingSettingAnswered
    || !locationAnswered
    || !trainingFrequencyAnswered
    || !availabilityAnswered
    || !budgetAnswered
  ) return false;
  return coverage.trainee && coverage.trainer && coverage.sessions;
};

const REVIEW_READY_REPLY_V4 = "Thanks! We have everything needed now to find your match.";

const incompleteReviewFollowUpV4 = (
  required: RequiredPracticalTopicsV3,
  coverage: OnboardingThemeCoverageV4,
): Pick<OnboardingTurnResultV3, "reply" | "quickReplies"> => {
  if (!required.coachingStyleAnswered) {
    return {
      reply: "What sort of personality would you like your trainer to have?",
      quickReplies: [
        "Friendly and understanding",
        "Direct and disciplined",
        "Calm and analytical",
      ],
    };
  }
  if (!required.trainerGenderPreferenceAnswered) {
    return {
      reply: "Do you have a trainer gender preference, or no preference?",
      quickReplies: ["I'd prefer a woman", "I'd prefer a man", "No gender preference"],
    };
  }
  if (!required.trainingFrequencyAnswered) {
    return {
      reply: "How often would you like to train with your trainer?",
      quickReplies: ["Twice a week", "Three times a week", "I'm not sure yet"],
    };
  }
  if (!required.trainingSettingAnswered) {
    return {
      reply: "Where would you like to train with your trainer?",
      quickReplies: ["Home", "Online", "Commercial gym", "Private studio"],
    };
  }
  if (!required.locationAnswered) {
    return {
      reply: "What area would you like your sessions in?",
      quickReplies: ["Near London Bridge", "Shoreditch", "Online only"],
    };
  }
  if (!required.availabilityAnswered) {
    return {
      reply: "What days or times do you usually prefer for your availability?",
      quickReplies: ["Weekday evenings", "Weekend mornings", "I'm flexible"],
    };
  }
  if (!required.budgetAnswered) {
    return {
      reply: "What is your budget for these training sessions?",
      quickReplies: ["Around £70 per session", "Up to £300 per month", "I'm not sure yet"],
    };
  }
  if (!coverage.trainee) {
    return {
      reply: "What else should a trainer know about your goal?",
      quickReplies: [
        "Where I'm starting from",
        "The target I'm aiming for",
        "The timeframe I have",
      ],
    };
  }
  if (!coverage.trainer) {
    return {
      reply: "What else matters to you in a trainer?",
      quickReplies: [
        "Someone encouraging and patient",
        "Someone direct who challenges me",
        "Someone who explains the reasoning",
      ],
    };
  }
  return {
    reply: "What else about how your sessions need to work would help us find the right match?",
    quickReplies: [
      "I would like to train at a gym",
      "I need sessions near work",
      "I am flexible about the setting",
    ],
  };
};

export const reconcileConversationTurnV4 = ({
  modelTurn,
  requiredPracticalTopics,
}: {
  modelTurn: ConversationalModelTurnV4;
  requiredPracticalTopics: RequiredPracticalTopicsV3;
}): OnboardingTurnResultV3 => {
  const readyForReview = shouldReadyForReviewV3({
    coverage: modelTurn.coverage,
    ...requiredPracticalTopics,
  });
  if (readyForReview) {
    return { reply: REVIEW_READY_REPLY_V4, readyForReview: true, quickReplies: [] };
  }
  if (!hasReviewReadinessPhrasingV3(modelTurn.reply)) {
    return { reply: modelTurn.reply, readyForReview: false, quickReplies: modelTurn.quickReplies };
  }
  return {
    ...incompleteReviewFollowUpV4(requiredPracticalTopics, modelTurn.coverage),
    readyForReview: false,
  };
};

const providerSafetySettings = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }));

const conversationalResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "coverage", "quickReplies"],
  propertyOrdering: ["reply", "coverage", "quickReplies"],
  properties: {
    reply: {
      type: "string",
      description: "A concise, natural UK English response. Briefly acknowledge considered, personal, or difficult answers when it feels natural, then ask a mostly open-ended question. Do not list alternatives, use scripted coaching language, or repeat the user's answer.",
    },
    coverage: {
      type: "object",
      additionalProperties: false,
      required: ["trainee", "trainer", "sessions"],
      propertyOrdering: ["trainee", "trainer", "sessions"],
      description: "Whether each matching area is sufficiently understood from the conversation.",
      properties: {
        trainee: {
          type: "boolean",
          description: "True only when the transcript contains a distinct assistant question and user answer providing practical, goal-specific matching information after the opening goal.",
        },
        trainer: {
          type: "boolean",
          description: "True only when the transcript contains a distinct answered trainer-relationship follow-up after the opening trainer-fit answer, plus trainer gender. The trainer-fit answer itself cannot count twice.",
        },
        sessions: {
          type: "boolean",
          description: "False until training setting, location (rough area or confirmed online-only), frequency with the trainer, availability, and budget are all confirmed in private turn state.",
        },
      },
    },
    quickReplies: {
      type: "array",
      minItems: 0,
      maxItems: MAX_ONBOARDING_QUICK_REPLIES,
      description: "Two or three meaningfully different answers, never paraphrases of the same idea. For training setting return Home, Online, Commercial gym, Private studio. Empty when there is no question.",
      items: { type: "string" },
    },
  },
} as const;

const conversationThinkingConfigV4 = (model: string) => {
  if (model.startsWith("gemini-2.")) return { thinkingBudget: 0 };
  if (model.startsWith("gemini-3.7")) return { thinkingLevel: ThinkingLevel.LOW };
  return { thinkingLevel: ThinkingLevel.MINIMAL };
};

export const conversationHistoryForGeminiV3 = (messages: OnboardingChatMessage[]): Content[] => {
  const firstUserMessage = messages.findIndex(({ role }) => role === "user");
  if (firstUserMessage < 0) return [];
  return messages.slice(firstUserMessage).map(({ role, text }) => ({
    role: role === "assistant" ? "model" : "user",
    parts: [{ text }],
  }));
};

let cachedGeminiClient: GoogleGenAI | null = null;
let cachedGeminiProject: string | null = null;

const geminiClient = () => {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error("The Gemini project is not configured.");
  if (!cachedGeminiClient || cachedGeminiProject !== project) {
    cachedGeminiClient = new GoogleGenAI({ vertexai: true, project, location: GEMINI_LOCATION });
    cachedGeminiProject = project;
  }
  return cachedGeminiClient;
};

export const extractReplyPrefixFromStructuredStreamV4 = (raw: string) => {
  const property = /"reply"\s*:\s*"/.exec(raw);
  if (!property) return "";
  let result = "";
  for (let index = property.index + property[0].length; index < raw.length; index += 1) {
    const character = raw[index]!;
    if (character === '"') break;
    if (character !== "\\") {
      result += character;
      continue;
    }
    const escape = raw[index + 1];
    if (!escape) break;
    if (escape === "u") {
      const code = raw.slice(index + 2, index + 6);
      if (!/^[0-9a-f]{4}$/i.test(code)) break;
      result += String.fromCharCode(Number.parseInt(code, 16));
      index += 5;
      continue;
    }
    const decoded = ({
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    } as Record<string, string>)[escape];
    if (decoded === undefined) break;
    result += decoded;
    index += 1;
  }
  return result;
};

const runConversationModelV4 = async (
  messages: OnboardingChatMessage[],
  onReplyDelta?: (delta: string) => Promise<void>,
  abortSignal?: AbortSignal,
) => {
  const latestUserMessage = messages.at(-1);
  if (latestUserMessage?.role !== "user") throw new Error("The conversation is missing the latest answer.");
  const history = messages.slice(0, -1);
  const userTurns = messages.filter(({ role }) => role === "user").length;
  const requiredPracticalTopics = requiredPracticalTopicsForTranscriptV3(messages);
  const model = chatGeminiModelV4.value();
  const chat = geminiClient().chats.create({
    model,
    history: conversationHistoryForGeminiV3(history),
    config: {
      systemInstruction: `${ONBOARDING_CONVERSATION_SYSTEM_PROMPT}

Private turn state supplied by the application:
- This is the first answer to the opening goal question: ${userTurns === 1 ? "yes" : "no"}
- General trainer fit has been explicitly asked and answered: ${requiredPracticalTopics.coachingStyleAnswered ? "yes" : "no"}
- Trainer gender preference has been explicitly asked and answered: ${requiredPracticalTopics.trainerGenderPreferenceAnswered ? "yes" : "no"}
- Training setting has been explicitly asked and answered: ${requiredPracticalTopics.trainingSettingAnswered ? "yes" : "no"}
- Location (rough area or confirmed online-only) has been explicitly asked and answered: ${requiredPracticalTopics.locationAnswered ? "yes" : "no"}
- Training frequency with the trainer has been explicitly asked and answered: ${requiredPracticalTopics.trainingFrequencyAnswered ? "yes" : "no"}
- Availability has been explicitly asked and answered: ${requiredPracticalTopics.availabilityAnswered ? "yes" : "no"}
- Budget has been explicitly asked and answered: ${requiredPracticalTopics.budgetAnswered ? "yes" : "no"}
Treat the seven explicit topic flags as authoritative. Assess trainee and trainer depth yourself from the full
conversation according to the system prompt. Keep trainer coverage false while general trainer fit or trainer gender says "no".
Keep sessions coverage false while a required sessions topic says "no". Ask for missing coverage naturally,
and never use the number of messages to decide coverage or completion.
Prompt-led sequencing, with no semantic backend gate:
- If the transcript lacks a distinct answered practical goal follow-up after the opening answer, ask it now.
- If general trainer fit is "yes" but the transcript lacks a distinct answered relationship follow-up after that
  answer, ask it now before trainer gender or any sessions topic. Do not count the trainer-fit answer twice.
- Inspect the transcript yourself and do not repeat either follow-up once it has been answered.`,
      responseMimeType: "application/json",
      responseJsonSchema: conversationalResponseJsonSchema,
      maxOutputTokens: 256,
      thinkingConfig: conversationThinkingConfigV4(model),
      safetySettings: providerSafetySettings,
    },
  });
  const modelStartedAt = Date.now();
  const stream = await chat.sendMessageStream({ message: latestUserMessage.text });
  let raw = "";
  let streamedReply = "";
  let modelFirstChunkMs: number | null = null;
  let firstReplyChunkMs: number | null = null;

  for await (const chunk of stream) {
    if (abortSignal?.aborted) throw new HttpsError("cancelled", "The request was cancelled.");
    if (modelFirstChunkMs === null) modelFirstChunkMs = Date.now() - modelStartedAt;
    raw += chunk.text ?? "";
    const replyPrefix = extractReplyPrefixFromStructuredStreamV4(raw);
    if (replyPrefix.length <= streamedReply.length) continue;
    const delta = replyPrefix.slice(streamedReply.length);
    streamedReply = replyPrefix;
    if (onReplyDelta) {
      await onReplyDelta(delta);
      if (firstReplyChunkMs === null) firstReplyChunkMs = Date.now() - modelStartedAt;
    }
  }

  if (!raw) throw new Error("The model returned no content.");
  return {
    turn: parseConversationalModelOutputV3(raw),
    modelFirstChunkMs,
    firstReplyChunkMs,
    modelTotalMs: Date.now() - modelStartedAt,
    userTurns,
    requiredPracticalTopics,
  };
};

const runConversationModel = async (
  messages: OnboardingChatMessage[],
  userMessage: string,
  userTurns: number,
  requiredPracticalTopics: RequiredPracticalTopicsV3,
) => {
  const chat = geminiClient().chats.create({
    model: geminiModel.value(),
    history: conversationHistoryForGeminiV3(messages),
    config: {
      systemInstruction: `${ONBOARDING_CONVERSATION_SYSTEM_PROMPT}

Private turn state supplied by the application:
- This is the first answer to the opening goal question: ${userTurns === 1 ? "yes" : "no"}
- General trainer fit has been explicitly asked and answered: ${requiredPracticalTopics.coachingStyleAnswered ? "yes" : "no"}
- Trainer gender preference has been explicitly asked and answered: ${requiredPracticalTopics.trainerGenderPreferenceAnswered ? "yes" : "no"}
- Training setting has been explicitly asked and answered: ${requiredPracticalTopics.trainingSettingAnswered ? "yes" : "no"}
- Location (rough area or confirmed online-only) has been explicitly asked and answered: ${requiredPracticalTopics.locationAnswered ? "yes" : "no"}
- Training frequency with the trainer has been explicitly asked and answered: ${requiredPracticalTopics.trainingFrequencyAnswered ? "yes" : "no"}
- Availability has been explicitly asked and answered: ${requiredPracticalTopics.availabilityAnswered ? "yes" : "no"}
- Budget has been explicitly asked and answered: ${requiredPracticalTopics.budgetAnswered ? "yes" : "no"}
Treat the seven explicit topic flags as authoritative. Assess trainee and trainer depth yourself from the full
conversation according to the system prompt. Keep trainer coverage false while general trainer fit or trainer gender says "no".
Keep sessions coverage false while a required sessions topic says "no". Ask for missing coverage naturally,
and never use the number of messages to decide coverage or completion.
Prompt-led sequencing, with no semantic backend gate:
- If the transcript lacks a distinct answered practical goal follow-up after the opening answer, ask it now.
- If general trainer fit is "yes" but the transcript lacks a distinct answered relationship follow-up after that
  answer, ask it now before trainer gender or any sessions topic. Do not count the trainer-fit answer twice.
- Inspect the transcript yourself and do not repeat either follow-up once it has been answered.`,
      responseMimeType: "application/json",
      responseJsonSchema: conversationalResponseJsonSchema,
      maxOutputTokens: 512,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      safetySettings: providerSafetySettings,
    },
  });
  const response = await chat.sendMessage({ message: userMessage });
  if (!response.text) throw new Error("The model returned no content.");
  return parseConversationalModelOutputV3(response.text);
};

export const normalizeProfileMarkdownV3 = (raw: string) => {
  const markdown = cleanModelText(raw);
  if (/^[{[]/.test(markdown)) throw new Error("The model returned structured output instead of Markdown.");
  return profileMarkdownSchema.parse(markdown);
};

const runMarkdownProfileGeneration = async (messages: OnboardingChatMessage[]) => {
  const transcript = messages.map(({ role, text }) => ({ role, text }));
  const response = await geminiClient().models.generateContent({
    model: summaryGeminiModelV4.value(),
    contents: `Create the Markdown training brief from this conversation:\n${JSON.stringify(transcript)}`,
    config: {
      systemInstruction: ONBOARDING_MARKDOWN_PROFILE_SYSTEM_PROMPT,
      responseMimeType: "text/plain",
      maxOutputTokens: 2_000,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      safetySettings: providerSafetySettings,
    },
  });
  if (!response.text) throw new Error("The model returned no profile document.");
  return normalizeProfileMarkdownV3(response.text);
};

const storeMessage = (
  batch: FirebaseFirestore.WriteBatch,
  ref: DocumentReference,
  message: OnboardingChatMessage,
  expiresAt: Timestamp,
) => {
  batch.create(ref.collection("messages").doc(message.id), {
    role: message.role,
    text: message.text,
    sequence: message.sequence,
    createdAt: Timestamp.fromDate(new Date(message.createdAt)),
    expiresAt,
  });
};

const readMessages = async (ref: DocumentReference): Promise<OnboardingChatMessage[]> => {
  const snapshot = await ref.collection("messages").orderBy("sequence", "asc").get();
  return snapshot.docs.flatMap((message) => {
    const data = message.data() as {
      role: "assistant" | "user";
      text: string;
      sequence: number;
      createdAt: Timestamp;
    };
    let text = data.text;
    if (data.role === "assistant" && !ONBOARDING_OPENING_MESSAGES.some((opening) => opening === text)) {
      try {
        text = parseConversationalModelOutputV3(text).reply;
      } catch {
        return [];
      }
    }
    return [{
      id: message.id,
      role: data.role,
      text,
      sequence: data.sequence,
      createdAt: data.createdAt.toDate().toISOString(),
    }];
  });
};

const assertLiveDraft = (doc: DraftDoc) => {
  if (doc.expiresAt.toMillis() <= Date.now()) throw new HttpsError("not-found", "This chat has expired. Start a new one.");
};

const readAuthorizedDraft = async (draftId: string, capability: string) => {
  const ref = drafts.doc(draftId);
  const snapshot = await ref.get();
  const doc = snapshot.data() as DraftDoc | undefined;
  if (!doc || doc.schemaVersion !== 3 || doc.profileFormat !== "markdown-v1") {
    throw new HttpsError("not-found", "This chat uses an older format. Start a new one.");
  }
  if (doc.capabilityHash !== hash(capability)) throw new HttpsError("permission-denied", "This chat capability is invalid.");
  assertLiveDraft(doc);
  return { ref, doc };
};

const snapshotFromDoc = async (
  draftId: string,
  ref: DocumentReference,
  doc: DraftDoc,
): Promise<OnboardingDraftSnapshotV3> => ({
  schemaVersion: 3,
  draftId,
  version: doc.version,
  status: doc.status,
  profileMarkdown: doc.profileMarkdown,
  messages: await readMessages(ref),
  quickReplies: doc.quickReplies,
  expiresAt: doc.expiresAt.toDate().toISOString(),
  confirmationVersion: doc.confirmationVersion,
  userTurns: doc.userTurns,
});

const snapshotForFinalizedConversationV4 = (
  draftId: string,
  doc: DraftDoc,
): OnboardingDraftSnapshotV3 => ({
  schemaVersion: 3,
  draftId,
  version: doc.version,
  status: doc.status,
  profileMarkdown: doc.profileMarkdown,
  messages: [],
  quickReplies: [],
  expiresAt: doc.expiresAt.toDate().toISOString(),
  confirmationVersion: doc.confirmationVersion,
  userTurns: doc.userTurns,
});

export const isTranscriptReadyForFinalizationV4 = (messages: readonly OnboardingChatMessage[]) => {
  const required = requiredPracticalTopicsForTranscriptV3(messages);
  const latestAssistantMessage = [...messages].reverse().find(({ role }) => role === "assistant")?.text ?? "";
  return required.coachingStyleAnswered
    && required.trainerGenderPreferenceAnswered
    && required.trainingSettingAnswered
    && required.locationAnswered
    && required.trainingFrequencyAnswered
    && required.availabilityAnswered
    && required.budgetAnswered
    && latestAssistantMessage === REVIEW_READY_REPLY_V4;
};

export const createWebOnboardingDraftV3 = onCall<CreateWebOnboardingDraftV3Request, Promise<CreateWebOnboardingDraftV3Response>>(
  callableOptions,
  async (request) => {
    ensureAppCheck(request);
    const input = parseData(createRequestSchema, request.data);
    const { draftId, capability } = draftIdentityForIdempotencyKeyV3(input.idempotencyKey);
    const ref = drafts.doc(draftId);
    const existing = await ref.get();
    if (existing.exists) {
      const existingDoc = existing.data() as DraftDoc;
      if (existingDoc.capabilityHash !== hash(capability)) throw new HttpsError("already-exists", "This creation key is already in use.");
      if (existingDoc.schemaVersion !== 3 || existingDoc.profileFormat !== "markdown-v1") {
        throw new HttpsError("failed-precondition", "This chat uses an older format. Start a new one.");
      }
      assertLiveDraft(existingDoc);
      return { draftId, capability, snapshot: await snapshotFromDoc(draftId, ref, existingDoc) };
    }

    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
    await enforceRateLimit(
      `create:${requestIpKey(request)}`,
      createRateLimitForProjectV3(projectId),
      60 * 60 * 1_000,
    );
    const createdAt = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(createdAt.toMillis() + DRAFT_TTL_MS);
    const doc: DraftDoc = {
      schemaVersion: 3,
      profileFormat: "markdown-v1",
      capabilityHash: hash(capability),
      consentVersion: input.consentVersion,
      createdAt,
      updatedAt: createdAt,
      expiresAt,
      version: 1,
      status: "collecting",
      confirmationVersion: null,
      profileMarkdown: null,
      quickReplies: [...ONBOARDING_OPENING_QUICK_REPLIES],
      userTurns: 0,
      nextSequence: ONBOARDING_OPENING_MESSAGES.length + 1,
    };
    const opening = ONBOARDING_OPENING_MESSAGES.map((text, index): OnboardingChatMessage => ({
      id: randomUUID(),
      role: "assistant",
      text,
      createdAt: createdAt.toDate().toISOString(),
      sequence: index + 1,
    }));
    const batch = db.batch();
    batch.create(ref, doc);
    opening.forEach((message) => storeMessage(batch, ref, message, expiresAt));
    try {
      await batch.commit();
    } catch (error) {
      const raced = await ref.get();
      const racedDoc = raced.data() as DraftDoc | undefined;
      if (racedDoc?.capabilityHash === hash(capability)) {
        return { draftId, capability, snapshot: await snapshotFromDoc(draftId, ref, racedDoc) };
      }
      throw error;
    }
    return { draftId, capability, snapshot: await snapshotFromDoc(draftId, ref, doc) };
  },
);

export const getWebOnboardingDraftV3 = onCall<GetWebOnboardingDraftV3Request, Promise<GetWebOnboardingDraftV3Response>>(
  callableOptions,
  async (request) => {
    ensureAppCheck(request);
    const input = parseData(capabilityRequestSchema, request.data);
    const { ref, doc } = await readAuthorizedDraft(input.draftId, input.capability);
    return { snapshot: await snapshotFromDoc(input.draftId, ref, doc) };
  },
);

export const runWebOnboardingTurnV3 = onCall<
  RunWebOnboardingTurnV3Request | RunWebOnboardingTurnV4Request,
  Promise<RunWebOnboardingTurnV3Response | RunWebOnboardingTurnV4Response>,
  RunWebOnboardingTurnV4StreamChunk
>(
  { ...callableOptions, timeoutSeconds: 60, minInstances: 1 },
  async (request, response) => {
    if (Array.isArray((request.data as Partial<RunWebOnboardingTurnV4Request>)?.messages)) {
      return handleWebOnboardingTurnV4(
        request as CallableRequest<RunWebOnboardingTurnV4Request>,
        response,
      );
    }
    ensureAppCheck(request);
    const input = parseData(turnRequestSchema, request.data);
    const { ref, doc } = await readAuthorizedDraft(input.draftId, input.capability);
    const turnRef = ref.collection("idempotentTurnsV3").doc(hash(input.idempotencyKey));
    const requestHash = hash(`${input.expectedVersion}:${input.message}`);
    const prior = await turnRef.get();
    if (prior.exists) {
      if (prior.data()?.requestHash !== requestHash) throw new HttpsError("already-exists", "This turn key was used for different input.");
      const latest = await readAuthorizedDraft(input.draftId, input.capability);
      return { snapshot: await snapshotFromDoc(input.draftId, latest.ref, latest.doc) };
    }
    if (doc.version !== input.expectedVersion) throw new HttpsError("aborted", "The chat changed in another tab. Refresh and try again.");
    if (doc.status !== "collecting") throw new HttpsError("failed-precondition", "This chat is ready for secure final details.");
    await enforceRateLimit(`turn:${input.draftId}`, 30, 60 * 60 * 1_000);
    const messages = await readMessages(ref);
    const userTurns = doc.userTurns + 1;
    const requiredPracticalTopics = requiredPracticalTopicsForTranscriptV3([
      ...messages,
      { role: "user", text: input.message },
    ]);
    const startedAt = Date.now();
    let modelTurn: ConversationalModelTurnV4;
    try {
      modelTurn = await runConversationModel(
        messages,
        input.message,
        userTurns,
        requiredPracticalTopics,
      );
    } catch (error) {
      logger.error("web_onboarding_conversation_failed", {
        draftKey: hash(input.draftId).slice(0, 12),
        latencyMs: Date.now() - startedAt,
        errorType: error instanceof Error ? error.name : "unknown",
      });
      throw new HttpsError("unavailable", "I couldn’t reply just now. Your answer is still here — please try again.");
    }

    const result = reconcileConversationTurnV4({
      modelTurn,
      requiredPracticalTopics,
    });
    const timestamp = Timestamp.now();
    const userMessage: OnboardingChatMessage = {
      id: randomUUID(),
      role: "user",
      text: input.message,
      createdAt: timestamp.toDate().toISOString(),
      sequence: doc.nextSequence,
    };
    const assistantMessage: OnboardingChatMessage = {
      id: randomUUID(),
      role: "assistant",
      text: result.reply,
      createdAt: timestamp.toDate().toISOString(),
      sequence: doc.nextSequence + 1,
    };
    const nextDoc: DraftDoc = {
      ...doc,
      updatedAt: timestamp,
      version: doc.version + 1,
      status: result.readyForReview ? "ready_to_map" : "collecting",
      confirmationVersion: null,
      profileMarkdown: null,
      quickReplies: result.quickReplies,
      userTurns,
      nextSequence: doc.nextSequence + 2,
    };
    delete nextDoc.identity;

    await db.runTransaction(async (transaction) => {
      const [fresh, idempotent] = await Promise.all([transaction.get(ref), transaction.get(turnRef)]);
      if (idempotent.exists) {
        if (idempotent.data()?.requestHash !== requestHash) throw new HttpsError("already-exists", "This turn key was used for different input.");
        return;
      }
      const freshDoc = fresh.data() as DraftDoc | undefined;
      if (!freshDoc || freshDoc.capabilityHash !== hash(input.capability)) throw new HttpsError("permission-denied", "This chat capability is invalid.");
      if (freshDoc.version !== input.expectedVersion) throw new HttpsError("aborted", "The chat changed in another tab. Refresh and try again.");
      transaction.set(ref, nextDoc);
      transaction.create(ref.collection("messages").doc(userMessage.id), {
        role: userMessage.role,
        text: userMessage.text,
        sequence: userMessage.sequence,
        createdAt: timestamp,
        expiresAt: doc.expiresAt,
      });
      transaction.create(ref.collection("messages").doc(assistantMessage.id), {
        role: assistantMessage.role,
        text: assistantMessage.text,
        sequence: assistantMessage.sequence,
        createdAt: timestamp,
        expiresAt: doc.expiresAt,
      });
      transaction.create(turnRef, {
        resultVersion: nextDoc.version,
        requestHash,
        createdAt: timestamp,
        expiresAt: doc.expiresAt,
      });
    });

    logger.info("web_onboarding_conversation_turn", {
      turnCount: userTurns,
      readyForReview: result.readyForReview,
      latencyMs: Date.now() - startedAt,
    });
    const latest = await readAuthorizedDraft(input.draftId, input.capability);
    return { snapshot: await snapshotFromDoc(input.draftId, latest.ref, latest.doc) };
  },
);

export const runWebOnboardingTurnV4 = onCall<
  RunWebOnboardingTurnV4Request,
  Promise<RunWebOnboardingTurnV4Response>,
  RunWebOnboardingTurnV4StreamChunk
>(
  { ...callableOptions, timeoutSeconds: 60, minInstances: 1 },
  handleWebOnboardingTurnV4,
);

async function handleWebOnboardingTurnV4(
  request: CallableRequest<RunWebOnboardingTurnV4Request>,
  response?: CallableResponse<RunWebOnboardingTurnV4StreamChunk>,
): Promise<RunWebOnboardingTurnV4Response> {
    const handlerStartedAt = Date.now();
    ensureAppCheck(request);
    const input = parseData(turnRequestV4Schema, request.data);
    const messages = validateAndCanonicalizeConversationTranscriptV4(input.messages, "user");
    const rateLimitStartedAt = Date.now();
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
    await enforceRateLimit(
      `turn-v4:${requestIpKey(request)}`,
      turnRateLimitForProjectV4(projectId),
      60 * 60 * 1_000,
    );
    const rateLimitMs = Date.now() - rateLimitStartedAt;

    let modelResult: Awaited<ReturnType<typeof runConversationModelV4>>;
    try {
      modelResult = await runConversationModelV4(
        messages,
        undefined,
        response?.signal,
      );
    } catch (error) {
      const details = providerErrorDetails(error);
      logger.error("web_onboarding_conversation_failed_v4", {
        rateLimitMs,
        latencyMs: Date.now() - handlerStartedAt,
        ...details,
      });
      if (error instanceof HttpsError) throw error;
      const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
      if (project === DEVELOPMENT_PROJECT_ID) {
        throw new HttpsError(
          "unavailable",
          `Gemini dev error: ${details.errorStatus ?? details.errorCode ?? "unknown"} ${details.errorMessage}`,
        );
      }
      throw new HttpsError("unavailable", "I couldn’t reply just now. Your answer is still here — please try again.");
    }

    const result = reconcileConversationTurnV4({
      modelTurn: modelResult.turn,
      requiredPracticalTopics: modelResult.requiredPracticalTopics,
    });
    const timings = {
      rateLimitMs,
      modelFirstChunkMs: modelResult.modelFirstChunkMs,
      firstReplyChunkMs: modelResult.firstReplyChunkMs,
      modelTotalMs: modelResult.modelTotalMs,
      totalMs: Date.now() - handlerStartedAt,
    };
    logger.info("web_onboarding_conversation_turn_v4", {
      model: chatGeminiModelV4.value(),
      turnCount: modelResult.userTurns,
      readyForReview: result.readyForReview,
      ...timings,
    });
  return { result, timings };
}

export const finalizeWebOnboardingDraftV3 = onCall<
  FinalizeWebOnboardingDraftV3Request | FinalizeWebOnboardingV4Request,
  Promise<FinalizeWebOnboardingDraftV3Response | FinalizeWebOnboardingV4Response>
>(
  { ...callableOptions, timeoutSeconds: 60 },
  async (request) => {
    if (Array.isArray((request.data as Partial<FinalizeWebOnboardingV4Request>)?.messages)) {
      return handleFinalizeWebOnboardingV4(request as CallableRequest<FinalizeWebOnboardingV4Request>);
    }
    ensureAppCheck(request);
    const input = parseData(finalizeRequestSchema, request.data);
    const { ref, doc } = await readAuthorizedDraft(input.draftId, input.capability);
    const finalizeRef = ref.collection("idempotentFinalizationsV3").doc(hash(input.idempotencyKey));
    const requestHash = hash(String(input.expectedVersion));
    const prior = await finalizeRef.get();
    if (prior.exists) {
      if (prior.data()?.requestHash !== requestHash) throw new HttpsError("already-exists", "This finalization key was used for another version.");
      const latest = await readAuthorizedDraft(input.draftId, input.capability);
      return { snapshot: await snapshotFromDoc(input.draftId, latest.ref, latest.doc) };
    }
    if (doc.version !== input.expectedVersion) throw new HttpsError("aborted", "The chat changed in another tab. Refresh and try again.");
    if (doc.status === "review" && doc.profileMarkdown) {
      return { snapshot: await snapshotFromDoc(input.draftId, ref, doc) };
    }
    if (doc.status !== "ready_to_map") throw new HttpsError("failed-precondition", "Continue the conversation before preparing the matching profile.");

    await enforceRateLimit(`finalize:${input.draftId}`, 8, 60 * 60 * 1_000);
    const messages = await readMessages(ref);
    const startedAt = Date.now();
    let profileMarkdown: string;
    try {
      profileMarkdown = await runMarkdownProfileGeneration(messages);
    } catch (error) {
      logger.error("web_onboarding_finalization_failed", {
        draftKey: hash(input.draftId).slice(0, 12),
        turnCount: doc.userTurns,
        latencyMs: Date.now() - startedAt,
        errorType: error instanceof Error ? error.name : "unknown",
      });
      throw new HttpsError("unavailable", "I couldn’t prepare your details just now. Your conversation is saved — try preparing them again.");
    }

    const timestamp = Timestamp.now();
    const nextDoc: DraftDoc = {
      ...doc,
      updatedAt: timestamp,
      version: doc.version + 1,
      status: "review",
      profileMarkdown,
      quickReplies: [],
    };
    await db.runTransaction(async (transaction) => {
      const [fresh, idempotent] = await Promise.all([transaction.get(ref), transaction.get(finalizeRef)]);
      if (idempotent.exists) return;
      const freshDoc = fresh.data() as DraftDoc | undefined;
      if (!freshDoc || freshDoc.capabilityHash !== hash(input.capability)) throw new HttpsError("permission-denied", "This chat capability is invalid.");
      if (freshDoc.version !== input.expectedVersion || freshDoc.status !== "ready_to_map") {
        throw new HttpsError("aborted", "The chat changed. Prepare the latest version instead.");
      }
      transaction.set(ref, nextDoc);
      transaction.create(finalizeRef, {
        resultVersion: nextDoc.version,
        requestHash,
        createdAt: timestamp,
        expiresAt: doc.expiresAt,
      });
    });
    logger.info("web_onboarding_finalized", {
      turnCount: doc.userTurns,
      profileLength: profileMarkdown.length,
      latencyMs: Date.now() - startedAt,
    });
    const latest = await readAuthorizedDraft(input.draftId, input.capability);
    return { snapshot: await snapshotFromDoc(input.draftId, latest.ref, latest.doc) };
  },
);

export const finalizeWebOnboardingV4 = onCall<FinalizeWebOnboardingV4Request, Promise<FinalizeWebOnboardingV4Response>>(
  { ...callableOptions, timeoutSeconds: 60 },
  handleFinalizeWebOnboardingV4,
);

async function handleFinalizeWebOnboardingV4(
  request: CallableRequest<FinalizeWebOnboardingV4Request>,
): Promise<FinalizeWebOnboardingV4Response> {
    const handlerStartedAt = Date.now();
    ensureAppCheck(request);
    const input = parseData(finalizeRequestV4Schema, request.data);
    const messages = validateAndCanonicalizeConversationTranscriptV4(input.messages, "assistant");
    if (!isTranscriptReadyForFinalizationV4(messages)) {
      throw new HttpsError("failed-precondition", "Continue the conversation before preparing the matching profile.");
    }

    const { draftId, capability } = draftIdentityForIdempotencyKeyV3(input.idempotencyKey);
    const ref = drafts.doc(draftId);
    const existing = await ref.get();
    if (existing.exists) {
      const existingDoc = existing.data() as DraftDoc;
      if (existingDoc.capabilityHash !== hash(capability)) {
        throw new HttpsError("already-exists", "This finalization key is already in use.");
      }
      assertLiveDraft(existingDoc);
      return {
        draftId,
        capability,
        snapshot: snapshotForFinalizedConversationV4(draftId, existingDoc),
        timings: { rateLimitMs: 0, modelMs: 0, writeMs: 0, totalMs: Date.now() - handlerStartedAt },
      };
    }

    const rateLimitStartedAt = Date.now();
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
    await enforceRateLimit(
      `finalize-v4:${requestIpKey(request)}`,
      finalizationRateLimitForProjectV4(projectId),
      60 * 60 * 1_000,
    );
    const rateLimitMs = Date.now() - rateLimitStartedAt;
    const modelStartedAt = Date.now();
    let profileMarkdown: string;
    try {
      profileMarkdown = await runMarkdownProfileGeneration(messages);
    } catch (error) {
      logger.error("web_onboarding_finalization_failed_v4", {
        turnCount: input.messages.filter(({ role }) => role === "user").length,
        rateLimitMs,
        modelMs: Date.now() - modelStartedAt,
        latencyMs: Date.now() - handlerStartedAt,
        ...providerErrorDetails(error),
      });
      throw new HttpsError("unavailable", "I couldn’t prepare your details just now. Your conversation is kept on this device — try again.");
    }
    const modelMs = Date.now() - modelStartedAt;

    const timestamp = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(timestamp.toMillis() + DRAFT_TTL_MS);
    const userTurns = messages.filter(({ role }) => role === "user").length;
    const doc: DraftDoc = {
      schemaVersion: 3,
      profileFormat: "markdown-v1",
      capabilityHash: hash(capability),
      consentVersion: input.consentVersion,
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt,
      version: 1,
      status: "review",
      confirmationVersion: null,
      profileMarkdown,
      quickReplies: [],
      userTurns,
      nextSequence: 1,
    };
    const writeStartedAt = Date.now();
    try {
      await ref.create(doc);
    } catch (error) {
      const raced = await ref.get();
      const racedDoc = raced.data() as DraftDoc | undefined;
      if (racedDoc?.capabilityHash === hash(capability)) {
        return {
          draftId,
          capability,
          snapshot: snapshotForFinalizedConversationV4(draftId, racedDoc),
          timings: {
            rateLimitMs,
            modelMs,
            writeMs: Date.now() - writeStartedAt,
            totalMs: Date.now() - handlerStartedAt,
          },
        };
      }
      throw error;
    }
    const timings = {
      rateLimitMs,
      modelMs,
      writeMs: Date.now() - writeStartedAt,
      totalMs: Date.now() - handlerStartedAt,
    };
    logger.info("web_onboarding_finalized_v4", {
      model: summaryGeminiModelV4.value(),
      turnCount: userTurns,
      profileLength: profileMarkdown.length,
      ...timings,
    });
  return {
    draftId,
    capability,
    snapshot: snapshotForFinalizedConversationV4(draftId, doc),
    timings,
  };
}

const runMatchingModel = async (input: TrainerMatchingRequest) => {
  const response = await geminiClient().models.generateContent({
    model: matchingGeminiModel.value(),
    contents: input.contents,
    config: {
      systemInstruction: input.systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: input.responseJsonSchema,
      maxOutputTokens: 4_096,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      safetySettings: providerSafetySettings,
      httpOptions: { timeout: 60_000 },
    },
  });
  if (!response.text) throw new Error("The model returned no matching decisions.");
  return response.text;
};

const matchingForProfile = (ref: DocumentReference, profileMarkdown: string) => ensureWebMatching({
  db, ref, profileMarkdown, model: matchingGeminiModel.value(), generateContent: runMatchingModel,
});

export const matchWebOnboardingDraftV1 = onCall<DraftCapability, Promise<{ matching: MatchPreviewResult }>>(
  { ...callableOptions, timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    ensureAppCheck(request);
    const input = parseData(capabilityRequestSchema, request.data);
    const { ref, doc } = await readAuthorizedDraft(input.draftId, input.capability);
    if (!["review", "confirmed"].includes(doc.status) || !doc.profileMarkdown) {
      throw new HttpsError("failed-precondition", "Prepare your matching details first.");
    }
    if (!readSavedMatching(doc.matching, doc.profileMarkdown)) {
      await enforceRateLimit(`matching:${input.draftId}`, 8, 60 * 60 * 1_000);
      await enforceRateLimit(`matching-ip:${requestIpKey(request)}`, 30, 60 * 60 * 1_000);
    }
    const matching = await matchingForProfile(ref, doc.profileMarkdown);
    // Re-check the capability/lifecycle after the potentially slow model run.
    await readAuthorizedDraft(input.draftId, input.capability);
    return { matching: await webMatchPreviews(db, matching) };
  },
);

export const confirmWebOnboardingDraftV3 = onCall<ConfirmWebOnboardingDraftV3Request, Promise<ConfirmWebOnboardingDraftV3Response>>(
  { ...callableOptions, timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    ensureAppCheck(request);
    const input = parseData(confirmRequestSchema, request.data);
    const profileMarkdown = profileMarkdownSchema.safeParse(input.profileMarkdown);
    if (!profileMarkdown.success) {
      throw new HttpsError(
        "failed-precondition",
        profileMarkdown.error.issues[0]?.message ?? "Check the matching profile.",
      );
    }
    const identity = identityAnswersSchema.safeParse(input.identity);
    if (!identity.success) throw new HttpsError("invalid-argument", identity.error.issues[0]?.message ?? "Check the private details.");
    const { ref, doc: initialDoc } = await readAuthorizedDraft(input.draftId, input.capability);
    if (!["review", "confirmed"].includes(initialDoc.status)
      || initialDoc.profileMarkdown !== profileMarkdown.data) {
      throw new HttpsError("failed-precondition", "Confirm the current training brief before signing up.");
    }
    // Previously opened clients may still confirm without calling the new
    // preview endpoint. Complete their matching server-side before accepting
    // signup, while keeping the normal new-client path a cached read.
    if (!readSavedMatching(initialDoc.matching, profileMarkdown.data)) {
      await enforceRateLimit(`matching:${input.draftId}`, 8, 60 * 60 * 1_000);
      await enforceRateLimit(`matching-ip:${requestIpKey(request)}`, 30, 60 * 60 * 1_000);
      await matchingForProfile(ref, profileMarkdown.data);
    }
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const doc = snapshot.data() as DraftDoc | undefined;
      if (!doc || doc.capabilityHash !== hash(input.capability)) throw new HttpsError("permission-denied", "This chat capability is invalid.");
      if (doc.version !== input.expectedVersion) throw new HttpsError("aborted", "The matching details changed. Check the latest version.");
      if (!["review", "confirmed"].includes(doc.status) || !doc.profileMarkdown) {
        throw new HttpsError("failed-precondition", "Prepare the matching details before confirming them.");
      }
      assertLiveDraft(doc);
      if (profileMarkdown.data !== doc.profileMarkdown || !readSavedMatching(doc.matching, doc.profileMarkdown)) {
        throw new HttpsError("failed-precondition", "Finish matching the current training brief before signing up.");
      }
      const version = doc.version + 1;
      transaction.set(ref, {
        ...doc,
        updatedAt: Timestamp.now(),
        version,
        status: "confirmed",
        confirmationVersion: version,
        profileMarkdown: profileMarkdown.data,
        identity: {
          fullName: identity.data.fullName.trim(),
          dateOfBirth: identity.data.dateOfBirth,
          email: identity.data.email.trim().toLowerCase(),
        },
      } satisfies DraftDoc);
    });
    logger.info("web_onboarding_confirmed", { turnCount: (await ref.get()).data()?.userTurns ?? null });
    const confirmed = await readAuthorizedDraft(input.draftId, input.capability);
    return { snapshot: await snapshotFromDoc(input.draftId, confirmed.ref, confirmed.doc) };
  },
);

export const consumeWebOnboardingDraftV3 = onCall<ConsumeWebOnboardingDraftV3Request, Promise<ConsumeWebOnboardingDraftV3Response>>(
  { ...callableOptions, timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    ensureAppCheck(request);
    const input = parseData(capabilityRequestSchema, request.data);
    const authenticatedEmail = typeof request.auth?.token.email === "string" ? request.auth.token.email.toLowerCase() : null;
    if (!request.auth || !authenticatedEmail || request.auth.token.email_verified !== true) {
      throw new HttpsError("unauthenticated", "Verify and sign in with the confirmed email first.");
    }
    const uid = request.auth.uid;
    const markerRef = consumptions.doc(input.draftId);
    const marker = await markerRef.get();
    if (marker.exists) {
      const data = marker.data() as {
        uid?: string;
        capabilityHash?: string;
        profileFormat?: string;
        profileMarkdown?: unknown;
        matching?: unknown;
      };
      const profileMarkdown = profileMarkdownSchema.safeParse(data.profileMarkdown);
      if (
        data.uid !== uid
        || data.capabilityHash !== hash(input.capability)
        || data.profileFormat !== "markdown-v1"
        || !profileMarkdown.success
      ) {
        throw new HttpsError("permission-denied", "This consumption capability is invalid.");
      }
      await db.recursiveDelete(drafts.doc(input.draftId));
      const matching = readSavedMatching(data.matching, profileMarkdown.data)
        ?? await matchingForProfile(profiles.doc(uid), profileMarkdown.data);
      return { profileMarkdown: profileMarkdown.data, matches: await webMatchedProfiles(db, matching, uid) };
    }

    const { ref, doc } = await readAuthorizedDraft(input.draftId, input.capability);
    const profileRef = profiles.doc(uid);
    assertProfileConsumption(doc, (await profileRef.get()).data(), authenticatedEmail);
    if (!doc.profileMarkdown) throw new HttpsError("failed-precondition", "Prepare your training brief first.");
    const matching = await matchingForProfile(ref, doc.profileMarkdown);
    const timestamp = Timestamp.now();

    await db.runTransaction(async (transaction) => {
      const [fresh, existingMarker, existingProfile] = await Promise.all([
        transaction.get(ref),
        transaction.get(markerRef),
        transaction.get(profileRef),
      ]);
      if (existingMarker.exists) {
        const markerData = existingMarker.data();
        if (markerData?.uid !== uid || markerData?.capabilityHash !== hash(input.capability)) {
          throw new HttpsError("permission-denied", "This consumption capability is invalid.");
        }
        return;
      }
      const freshDoc = fresh.data() as DraftDoc | undefined;
      if (
        !freshDoc
        || freshDoc.capabilityHash !== hash(input.capability)
        || freshDoc.status !== doc.status
        || !freshDoc.profileMarkdown
      ) {
        throw new HttpsError("failed-precondition", "This confirmed draft is no longer available.");
      }
      if (freshDoc.version !== doc.version || freshDoc.confirmationVersion !== doc.confirmationVersion) {
        throw new HttpsError("aborted", "The confirmed draft changed. Retry with the latest version.");
      }
      const isRetune = assertProfileConsumption(freshDoc, existingProfile.data(), authenticatedEmail);
      assertLiveDraft(freshDoc);
      if (!readSavedMatching(freshDoc.matching, freshDoc.profileMarkdown)) {
        throw new HttpsError("failed-precondition", "Finish finding your trainers before completing signup.");
      }

      const profileUpdate = {
        profileFormat: "markdown-v1",
        profileMarkdown: freshDoc.profileMarkdown,
        source: "web-onboarding-v3",
        matching: freshDoc.matching,
        consentVersion: freshDoc.consentVersion,
        updatedAt: timestamp,
      };
      if (isRetune) {
        // Preserve identity, original signup time, and other account fields.
        transaction.update(profileRef, profileUpdate);
      } else {
        transaction.set(profileRef, {
          ...profileUpdate,
          identity: freshDoc.identity,
          signupCompletedAt: timestamp,
        });
      }
      transaction.set(markerRef, {
        uid,
        capabilityHash: hash(input.capability),
        profileFormat: "markdown-v1",
        profileMarkdown: freshDoc.profileMarkdown,
        matching: freshDoc.matching,
        consumedAt: timestamp,
        expiresAt: Timestamp.fromMillis(Date.now() + CONSUMPTION_TTL_MS),
      });
      transaction.update(ref, { status: "consumed", updatedAt: timestamp });
    });

    await db.recursiveDelete(ref);
    return { profileMarkdown: doc.profileMarkdown, matches: await webMatchedProfiles(db, matching, uid) };
  },
);

export const getWebClientProfileV3 = onCall<Record<string, never>, Promise<GetWebClientProfileV3Response>>(
  { ...callableOptions, timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    ensureAppCheck(request);
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to load your matching profile.");
    const snapshot = await profiles.doc(request.auth.uid).get();
    if (!snapshot.exists) return { profileMarkdown: null, matches: [] };
    const data = snapshot.data();
    if (!data) throw new HttpsError("data-loss", "The stored matching profile is invalid.");
    const profileMarkdown = profileMarkdownSchema.safeParse(data.profileMarkdown);
    if (data.profileFormat !== "markdown-v1" || !profileMarkdown.success) {
      return { profileMarkdown: null, matches: [] };
    }
    if (!readSavedMatching(data.matching, profileMarkdown.data)) {
      await enforceRateLimit(`matching-user:${request.auth.uid}`, 8, 60 * 60 * 1_000);
    }
    const matching = await matchingForProfile(snapshot.ref, profileMarkdown.data);
    return { profileMarkdown: profileMarkdown.data, matches: await webMatchedProfiles(db, matching, request.auth.uid) };
  },
);

export const deleteWebOnboardingDraftV3 = onCall<DeleteWebOnboardingDraftV3Request, Promise<DeleteWebOnboardingDraftV3Response>>(
  callableOptions,
  async (request) => {
    ensureAppCheck(request);
    const input = parseData(capabilityRequestSchema, request.data);
    const { ref } = await readAuthorizedDraft(input.draftId, input.capability);
    await db.recursiveDelete(ref);
    return { deleted: true };
  },
);

export const withdrawWebHealthConsentV3 = onCall<WithdrawWebHealthConsentV3Request, Promise<WithdrawWebHealthConsentV3Response>>(
  callableOptions,
  async (request) => {
    ensureAppCheck(request);
    const input = parseData(withdrawHealthRequestSchema, request.data);
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in before withdrawing health consent.");
    const uid = request.auth.uid;
    const healthRef = health.doc(uid);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(healthRef);
      const current = snapshot.data() as { consentId?: string | null; active?: boolean } | undefined;
      if (!snapshot.exists || !current?.active) return;
      const timestamp = Timestamp.now();
      const withdrawalId = hash(`${uid}:${current.consentId ?? "none"}:${input.consentVersion}:withdrawal-v3`);
      transaction.set(healthRef.collection("consents").doc(withdrawalId), {
        uid,
        consentId: withdrawalId,
        schemaVersion: 3,
        consentVersion: input.consentVersion,
        purpose: "safe-personal-training-matching",
        granted: false,
        supersedesConsentId: current.consentId ?? null,
        withdrawnAt: timestamp,
      });
      transaction.update(healthRef, {
        active: false,
        medicalNote: "",
        rehabilitationGoal: false,
        consentWithdrawnAt: timestamp,
        updatedAt: timestamp,
      });
    });
    return { withdrawn: true };
  },
);
