import { createHash } from "node:crypto";
import { GoogleGenAI, ThinkingLevel, type GenerateContentParameters } from "@google/genai";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { TRAINERS } from "../../third-space-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../../third-space-shared/locations.js";
import type { DemoMessage, ThirdSpaceMatches, ThirdSpaceTurn } from "../../third-space-shared/contract.js";
import { createThirdSpaceService, DemoInputError, DemoModelError, validateTranscript, type GenerateRequest } from "./service.js";
import { withTransientProviderRetry } from "./provider-retry.js";

const app = getApps()[0] ?? initializeApp();
const db = getFirestore(app);
const serviceAccount = defineString("THIRD_SPACE_SERVICE_ACCOUNT");
const chatModel = defineString("THIRD_SPACE_CHAT_MODEL", { default: "gemini-3.5-flash-lite" });
const matchingModel = defineString("THIRD_SPACE_MATCHING_MODEL", { default: "gemini-3.7-flash" });
const options = {
  region: "europe-west2", enforceAppCheck: true, invoker: "private" as const,
  serviceAccount, memory: "512MiB" as const, maxInstances: 4,
};

let ai: GoogleGenAI | undefined;
const generate = async (request: GenerateRequest) => {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error("The model project is not configured.");
  const client = ai ??= new GoogleGenAI({ vertexai: true, project, location: "global" });
  const model = request.kind === "chat" ? chatModel.value() : matchingModel.value();
  const generationRequest: GenerateContentParameters = {
    model, contents: request.contents,
    config: {
      // Bound each attempt and disable nested SDK retries. A two-stage match stays below its 180s callable limit:
      // at most 6 * 25s model attempts + 2 * (2.5s + 5.5s) backoff = 166s, before small handler overhead.
      httpOptions: { timeout: request.kind === "chat" ? 20_000 : 25_000, retryOptions: { attempts: 1 } },
      systemInstruction: request.systemInstruction,
      responseMimeType: "application/json", responseJsonSchema: request.responseJsonSchema,
      temperature: 0.35, maxOutputTokens: request.kind === "ranking" ? 4_000 : 3_000,
      thinkingConfig: model.startsWith("gemini-2.") ? { thinkingBudget: 0 }
        : { thinkingLevel: model.startsWith("gemini-3.7") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL },
    },
  };
  const response = await withTransientProviderRetry(() => client.models.generateContent(generationRequest), {
    onRetry: event => logger.info("third_space_demo_model_retry", { kind: request.kind, ...event }),
  });
  if (!response.text) throw new Error("The model returned no response.");
  return response.text;
};

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
  "ClientError", "ServerError", "GoogleGenAIError", "GoogleGenerativeAIError",
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
