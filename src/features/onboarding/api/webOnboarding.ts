import { getFunctions, httpsCallable } from "firebase/functions";
import {
  ONBOARDING_OPENING_MESSAGES,
  ONBOARDING_OPENING_QUICK_REPLIES,
  profileMarkdownSchema,
  type ConfirmWebOnboardingDraftV3Request,
  type ConfirmWebOnboardingDraftV3Response,
  type ConsumeWebOnboardingDraftV3Request,
  type ConsumeWebOnboardingDraftV3Response,
  type CreateWebOnboardingDraftV3Request,
  type CreateWebOnboardingDraftV3Response,
  type DeleteWebOnboardingDraftV3Request,
  type DeleteWebOnboardingDraftV3Response,
  type DraftCapability,
  type FinalizeWebOnboardingV4Request,
  type FinalizeWebOnboardingV4Response,
  type FinalizeWebOnboardingDraftV3Request,
  type FinalizeWebOnboardingDraftV3Response,
  type GetWebOnboardingDraftV3Request,
  type GetWebOnboardingDraftV3Response,
  type GetWebClientProfileV3Response,
  type OnboardingConversationSessionV4,
  type RunWebOnboardingTurnV4Request,
  type RunWebOnboardingTurnV4Response,
  type RunWebOnboardingTurnV4StreamChunk,
  type RunWebOnboardingTurnV3Request,
  type RunWebOnboardingTurnV3Response,
  type WithdrawWebHealthConsentV3Request,
  type WithdrawWebHealthConsentV3Response,
} from "../model/onboarding";

const CAPABILITY_STORAGE_KEY = "petey.web.onboarding-capability.v3";
const CREATE_KEY_STORAGE_KEY = "petey.web.onboarding-create-key.v3";
const CONVERSATION_STORAGE_KEY = "petey.web.onboarding-conversation.v4";
export const WEB_ONBOARDING_CONSENT_VERSION = "2026-08-31";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

export const isRemoteDraftConfigured =
  Object.values(firebaseConfig).every(Boolean)
  && Boolean(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim());

const browserQaFixtureEnabled = () => import.meta.env.DEV
  && new URLSearchParams(window.location.search).has("onboardingFixture");
const loadBrowserQaFixture = () => import("./webOnboardingQaFixture");
const appCheckDebugToken = import.meta.env.DEV
  ? import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim()
  : undefined;

type CallableAppContext = { app: unknown; appCheck: unknown };

let callableAppPromise: Promise<CallableAppContext> | null = null;
let onboardingPrewarmPromise: Promise<void> | null = null;

const getCallableApp = async () => {
  if (!isRemoteDraftConfigured) {
    throw new Error("The secure AI concierge is not configured for this environment.");
  }
  callableAppPromise ??= (async () => {
    if (appCheckDebugToken) {
      (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string })
        .FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;
    }
    const [
      { getApp, getApps, initializeApp },
      { initializeAppCheck, ReCaptchaEnterpriseProvider },
    ] = await Promise.all([
      import("firebase/app"),
      import("firebase/app-check"),
    ]);
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY.trim()),
      isTokenAutoRefreshEnabled: true,
    });
    return { app, appCheck };
  })().catch((error) => {
    callableAppPromise = null;
    throw error;
  });
  return callableAppPromise;
};

export const prewarmWebOnboarding = (): Promise<void> => {
  if (!isRemoteDraftConfigured || browserQaFixtureEnabled()) return Promise.resolve();
  onboardingPrewarmPromise ??= (async () => {
    const startedAt = performance.now();
    const [{ getToken }, context] = await Promise.all([
      import("firebase/app-check"),
      getCallableApp(),
    ]);
    await getToken(context.appCheck as Parameters<typeof getToken>[0], false);
    console.info("web_onboarding_prewarm_v4", {
      firebaseAndAppCheckMs: Math.round(performance.now() - startedAt),
    });
  })().catch((error) => {
    onboardingPrewarmPromise = null;
    throw error;
  });
  return onboardingPrewarmPromise;
};

const abortError = () => new DOMException("The request was cancelled.", "AbortError");

const callRemote = async <TRequest, TResponse>(
  name: string,
  request: TRequest,
  abortSignal?: AbortSignal,
): Promise<TResponse> => {
  if (abortSignal?.aborted) throw abortError();
  const context = await getCallableApp();
  if (abortSignal?.aborted) throw abortError();
  const functions = getFunctions(context.app as Parameters<typeof getFunctions>[0], "europe-west2");
  const pending = httpsCallable<TRequest, TResponse>(functions, name)(request).then((response) => response.data);
  if (!abortSignal) return pending;
  let rejectOnAbort: (() => void) | null = null;
  const aborted = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(abortError());
    abortSignal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    return await Promise.race([pending, aborted]);
  } finally {
    if (rejectOnAbort) abortSignal.removeEventListener("abort", rejectOnAbort);
  }
};

const isStoredConversationV4 = (value: unknown): value is OnboardingConversationSessionV4 => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OnboardingConversationSessionV4>;
  return candidate.schemaVersion === 4
    && (candidate.status === "collecting" || candidate.status === "ready_to_map")
    && Array.isArray(candidate.messages)
    && candidate.messages.every((message) => (
      message
      && typeof message.id === "string"
      && (message.role === "assistant" || message.role === "user")
      && typeof message.text === "string"
      && typeof message.createdAt === "string"
      && Number.isInteger(message.sequence)
    ))
    && Array.isArray(candidate.quickReplies)
    && candidate.quickReplies.every((reply) => typeof reply === "string")
    && Number.isInteger(candidate.userTurns)
    && typeof candidate.updatedAt === "string";
};

export const createLocalConversationV4 = (): OnboardingConversationSessionV4 => {
  const createdAt = new Date().toISOString();
  return {
    schemaVersion: 4,
    status: "collecting",
    messages: ONBOARDING_OPENING_MESSAGES.map((text, index) => ({
      id: crypto.randomUUID(),
      role: "assistant",
      text,
      createdAt,
      sequence: index + 1,
    })),
    quickReplies: [...ONBOARDING_OPENING_QUICK_REPLIES],
    userTurns: 0,
    updatedAt: createdAt,
  };
};

export const readLocalConversationV4 = (): OnboardingConversationSessionV4 | null => {
  try {
    const raw = window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredConversationV4(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveLocalConversationV4 = (session: OnboardingConversationSessionV4) => {
  try {
    window.sessionStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The live React state remains the source of truth when storage is unavailable.
  }
};

export const clearLocalConversationV4 = () => {
  try {
    window.sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
  } catch {
    // Nothing else is persisted during the conversation.
  }
};

export const createIdempotencyKey = () => crypto.randomUUID();

export const readDraftCapability = (): DraftCapability | null => {
  try {
    const value = window.sessionStorage.getItem(CAPABILITY_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<DraftCapability>;
    return typeof parsed.draftId === "string" && typeof parsed.capability === "string"
      ? { draftId: parsed.draftId, capability: parsed.capability }
      : null;
  } catch {
    return null;
  }
};

const saveDraftCapability = (capability: DraftCapability | null) => {
  try {
    if (capability) window.sessionStorage.setItem(CAPABILITY_STORAGE_KEY, JSON.stringify(capability));
    else window.sessionStorage.removeItem(CAPABILITY_STORAGE_KEY);
  } catch {
    // Capability validation on the server remains authoritative.
  }
};

export const clearDraftCapability = () => saveDraftCapability(null);

const pendingCreateKey = () => {
  try {
    const existing = window.sessionStorage.getItem(CREATE_KEY_STORAGE_KEY);
    if (existing) return existing;
    const created = createIdempotencyKey();
    window.sessionStorage.setItem(CREATE_KEY_STORAGE_KEY, created);
    return created;
  } catch {
    return createIdempotencyKey();
  }
};

export const createWebOnboardingDraftV3 = async (): Promise<CreateWebOnboardingDraftV3Response> => {
  const request: CreateWebOnboardingDraftV3Request = {
    consentVersion: WEB_ONBOARDING_CONSENT_VERSION,
    idempotencyKey: pendingCreateKey(),
  };
  const response = browserQaFixtureEnabled()
    ? await (await loadBrowserQaFixture()).createFixtureDraft()
    : await callRemote<CreateWebOnboardingDraftV3Request, CreateWebOnboardingDraftV3Response>(
        "createWebOnboardingDraftV3",
        request,
      );
  saveDraftCapability({ draftId: response.draftId, capability: response.capability });
  try {
    window.sessionStorage.removeItem(CREATE_KEY_STORAGE_KEY);
  } catch {
    // The capability has already been saved when storage is available.
  }
  return response;
};

export const getWebOnboardingDraftV3 = (request: GetWebOnboardingDraftV3Request) =>
  browserQaFixtureEnabled()
    ? loadBrowserQaFixture().then((fixture) => fixture.getFixtureDraft(request))
    : callRemote<GetWebOnboardingDraftV3Request, GetWebOnboardingDraftV3Response>("getWebOnboardingDraftV3", request);

export const runWebOnboardingTurnV3 = (
  request: RunWebOnboardingTurnV3Request,
  abortSignal?: AbortSignal,
) => browserQaFixtureEnabled()
  ? loadBrowserQaFixture().then((fixture) => fixture.runFixtureTurn(request, abortSignal))
  : callRemote<RunWebOnboardingTurnV3Request, RunWebOnboardingTurnV3Response>(
      "runWebOnboardingTurnV3",
      request,
      abortSignal,
    );

export type WebOnboardingTurnStreamV4 = {
  stream: AsyncIterable<RunWebOnboardingTurnV4StreamChunk>;
  data: Promise<RunWebOnboardingTurnV4Response>;
};

export const runWebOnboardingTurnV4 = async (
  request: RunWebOnboardingTurnV4Request,
  abortSignal?: AbortSignal,
): Promise<WebOnboardingTurnStreamV4> => {
  if (abortSignal?.aborted) throw abortError();
  if (browserQaFixtureEnabled()) {
    return (await loadBrowserQaFixture()).runFixtureTurnV4(request, abortSignal);
  }
  const context = await getCallableApp();
  if (abortSignal?.aborted) throw abortError();
  const functions = getFunctions(context.app as Parameters<typeof getFunctions>[0], "europe-west2");
  const callable = httpsCallable<
    RunWebOnboardingTurnV4Request,
    RunWebOnboardingTurnV4Response,
    RunWebOnboardingTurnV4StreamChunk
  >(functions, "runWebOnboardingTurnV3");
  return callable.stream(request, abortSignal ? { signal: abortSignal } : undefined);
};

export const finalizeWebOnboardingDraftV3 = (
  request: FinalizeWebOnboardingDraftV3Request,
) => browserQaFixtureEnabled()
  ? loadBrowserQaFixture().then((fixture) => fixture.finalizeFixtureDraft(request))
  : callRemote<FinalizeWebOnboardingDraftV3Request, FinalizeWebOnboardingDraftV3Response>(
      "finalizeWebOnboardingDraftV3",
      request,
    );

export const finalizeWebOnboardingV4 = async (
  request: FinalizeWebOnboardingV4Request,
): Promise<FinalizeWebOnboardingV4Response> => {
  const response = browserQaFixtureEnabled()
    ? await (await loadBrowserQaFixture()).finalizeFixtureV4(request)
    : await callRemote<FinalizeWebOnboardingV4Request, FinalizeWebOnboardingV4Response>(
        "finalizeWebOnboardingDraftV3",
        request,
      );
  saveDraftCapability({ draftId: response.draftId, capability: response.capability });
  clearLocalConversationV4();
  return response;
};

export const confirmWebOnboardingDraftV3 = async (
  request: ConfirmWebOnboardingDraftV3Request,
): Promise<ConfirmWebOnboardingDraftV3Response> => {
  const profileMarkdown = profileMarkdownSchema.safeParse(request.profileMarkdown);
  if (!profileMarkdown.success) {
    throw new Error(profileMarkdown.error.issues[0]?.message ?? "Check the matching profile.");
  }
  const validatedRequest = { ...request, profileMarkdown: profileMarkdown.data };
  return browserQaFixtureEnabled()
    ? (await loadBrowserQaFixture()).confirmFixtureDraft(validatedRequest)
    : callRemote("confirmWebOnboardingDraftV3", validatedRequest);
};

export const consumeWebOnboardingDraftV3 = async (
  request?: ConsumeWebOnboardingDraftV3Request,
): Promise<ConsumeWebOnboardingDraftV3Response | null> => {
  const capability = request ?? readDraftCapability();
  if (!capability) return null;
  const response = browserQaFixtureEnabled()
    ? await (await loadBrowserQaFixture()).consumeFixtureDraft(capability)
    : await callRemote<ConsumeWebOnboardingDraftV3Request, ConsumeWebOnboardingDraftV3Response>(
        "consumeWebOnboardingDraftV3",
        capability,
      );
  clearDraftCapability();
  return response;
};

export const getWebClientProfileV3 = () => (
  callRemote<Record<string, never>, GetWebClientProfileV3Response>("getWebClientProfileV3", {})
);

export const deleteWebOnboardingDraftV3 = async (
  request?: DeleteWebOnboardingDraftV3Request,
): Promise<DeleteWebOnboardingDraftV3Response> => {
  const capability = request ?? readDraftCapability();
  if (capability) {
    if (browserQaFixtureEnabled()) await (await loadBrowserQaFixture()).deleteFixtureDraft(capability);
    else {
      await callRemote<DeleteWebOnboardingDraftV3Request, DeleteWebOnboardingDraftV3Response>(
        "deleteWebOnboardingDraftV3",
        capability,
      );
    }
  }
  clearDraftCapability();
  return { deleted: true };
};

export const withdrawWebHealthConsentV3 = (request: WithdrawWebHealthConsentV3Request) =>
  callRemote<WithdrawWebHealthConsentV3Request, WithdrawWebHealthConsentV3Response>(
    "withdrawWebHealthConsentV3",
    request,
  );
