import { createHash } from "node:crypto";
import { generateOpenAIText } from "../../functions/src/openai.js";
import { openaiApiKey, openaiClient } from "../../functions/src/modelRuntime.js";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { TRAINERS } from "../../third-space-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../../third-space-shared/locations.js";
import type { DemoMessage, ThirdSpaceMatches, ThirdSpaceTurn } from "../../third-space-shared/contract.js";
import { createThirdSpaceService, DemoInputError, DemoModelError, validateTranscript, type GenerateRequest } from "./service.js";
import { generateModelResponse } from "./generation.js";

const app = getApps()[0] ?? initializeApp();
const db = getFirestore(app);
const serviceAccount = defineString("THIRD_SPACE_SERVICE_ACCOUNT");
const options = {
  region: "europe-west2", enforceAppCheck: true, invoker: "private" as const,
  serviceAccount, secrets: [openaiApiKey], memory: "512MiB" as const, maxInstances: 4,
};

const generate = (request: GenerateRequest) => generateModelResponse(request, {
  generateText: parameters => generateOpenAIText(openaiClient(), parameters),
  onRetry: event => logger.info("third_space_demo_model_retry", event),
});

const service = createThirdSpaceService(generate, { trainers: TRAINERS, clubs: CLUBS, locations: LONDON_LOCATIONS });

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const modelValidationReasons = new Set([
  "The model response is too long.",
  "The model returned an invalid response.",
  "The conversation is not ready for matching.",
  "The next conversation topic is missing.",
  "A completed conversation cannot ask another question.",
  "The ranking contains unknown or repeated trainer IDs.",
  "A match explanation has unsupported evidence.",
  "A match explanation makes an unsupported practical claim.",
  "The matching brief contains an unknown club.",
]);
const safeErrorNames = new Set([
  "Error", "TypeError", "SyntaxError", "AbortError", "TimeoutError", "ApiError",
  "APIError", "APIConnectionError", "APIConnectionTimeoutError", "APIUserAbortError",
  "BadRequestError", "AuthenticationError", "PermissionDeniedError", "NotFoundError",
  "RateLimitError", "InternalServerError", "UnprocessableEntityError",
]);

function failureTelemetry(error: unknown) {
  if (error instanceof DemoModelError) return {
    failureKind: "model-validation",
    validationReason: modelValidationReasons.has(error.message) ? error.message : "Unclassified model validation failure.",
  };
  const name = error instanceof Error && safeErrorNames.has(error.name) ? error.name : "UnknownError";
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  return {
    failureKind: "provider",
    errorName: name,
    ...(typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? { providerStatus: status } : {}),
  };
}

// Reuse the existing server-only rate-limit collection and its expiry field.
// No conversation, brief, identity or matching result is written to Firestore.
async function enforceRateLimit(request: CallableRequest<unknown>, action: "turn" | "match") {
  const forwarded = request.rawRequest.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0])?.trim()
    || request.rawRequest.ip || "unknown";
  const ref = db.collection("_webOnboardingRateLimitsV3").doc(hash(`third-space-demo:${action}:${ip}`));
  const windowMs = 60 * 60 * 1_000;
  const now = Date.now();
  const limit = action === "turn" ? 120 : 24;
  await db.runTransaction(async transaction => {
    const data = (await transaction.get(ref)).data();
    const withinWindow = data?.windowStartedAt instanceof Timestamp && now - data.windowStartedAt.toMillis() < windowMs;
    const count = withinWindow && typeof data?.count === "number" ? data.count : 0;
    if (count >= limit) throw new HttpsError("resource-exhausted", "Please wait before trying another search.");
    transaction.set(ref, {
      count: count + 1,
      windowStartedAt: withinWindow ? data!.windowStartedAt : Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + windowMs),
    });
  });
}

async function handle<T>(request: CallableRequest<unknown>, action: "turn" | "match", run: (messages: DemoMessage[]) => Promise<T>) {
  if (!request.app) throw new HttpsError("failed-precondition", "App Check is required. Refresh the page and try again.");
  let messages: DemoMessage[];
  try {
    messages = validateTranscript(request.data, action === "turn");
  } catch (error) {
    if (error instanceof DemoInputError) throw new HttpsError("invalid-argument", error.message);
    throw new HttpsError("invalid-argument", "The conversation is invalid.");
  }
  await enforceRateLimit(request, action);
  const started = Date.now();
  try {
    const result = await run(messages);
    logger.info("third_space_demo_request", { action, durationMs: Date.now() - started, messages: messages.length });
    return result;
  } catch (error) {
    // Log only allowlisted static validation messages, allowlisted error class names and numeric HTTP status.
    // Provider messages/bodies, transcripts, briefs and generated text never enter telemetry.
    logger.warn("third_space_demo_request_failed", { action, durationMs: Date.now() - started, ...failureTelemetry(error) });
    throw new HttpsError("unavailable", action === "turn"
      ? "I couldn’t reply just now. Your answer is still here; please try again."
      : "We couldn’t complete your search just now. Your answers are still here; please try again.");
  }
}

export const runThirdSpaceOnboardingTurnV1 = onCall<unknown, Promise<ThirdSpaceTurn>>(
  { ...options, timeoutSeconds: 90 }, request => handle(request, "turn", service.turn),
);
export const matchThirdSpaceTrainersV1 = onCall<unknown, Promise<ThirdSpaceMatches>>(
  { ...options, timeoutSeconds: 180 }, request => handle(request, "match", service.match),
);
