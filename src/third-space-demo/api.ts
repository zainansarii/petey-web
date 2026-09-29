import type { DemoMessage, ThirdSpaceMatches, ThirdSpaceTurn } from "../../third-space-shared/contract";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim();
const fixtureEnabled = () => import.meta.env.DEV
  && new URLSearchParams(window.location.search).get("thirdSpaceFixture") === "1";

async function initializeClient() {
  if (!Object.values(config).every(Boolean) || !siteKey) {
    throw new Error("The AI service is not configured. Please try again later.");
  }
  const [{ getApps, initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider }, { getFunctions }] = await Promise.all([
    import("firebase/app"), import("firebase/app-check"), import("firebase/functions"),
  ]);
  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN) {
    (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
  }
  const app = getApps().find((app) => app.name === "third-space-demo") ?? initializeApp(config, "third-space-demo");
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  return getFunctions(app, "europe-west2");
}

let client: ReturnType<typeof initializeClient> | undefined;
async function call<T>(name: string, messages: DemoMessage[]): Promise<T> {
  client ??= initializeClient().catch((error: unknown) => { client = undefined; throw error; });
  const [{ httpsCallable }, functions] = await Promise.all([import("firebase/functions"), client]);
  return (await httpsCallable<{ messages: DemoMessage[] }, T>(functions, name, { timeout: name === "matchThirdSpaceTrainersV1" ? 190_000 : 100_000 })({ messages })).data;
}

export async function runThirdSpaceTurn(messages: DemoMessage[]): Promise<ThirdSpaceTurn> {
  if (import.meta.env.DEV && fixtureEnabled()) return (await import("./fixture")).fixtureTurn(messages);
  const turn = await call<ThirdSpaceTurn>("runThirdSpaceOnboardingTurnV1", messages);
  if (!turn || typeof turn.reply !== "string" || !turn.reply.trim() || !Array.isArray(turn.quickReplies)
    || typeof turn.readyForMatching !== "boolean") throw new Error("The AI response could not be read. Please retry.");
  return turn;
}

export async function findThirdSpaceMatches(messages: DemoMessage[]): Promise<ThirdSpaceMatches> {
  if (import.meta.env.DEV && fixtureEnabled()) return (await import("./fixture")).fixtureMatches(messages);
  const result = await call<ThirdSpaceMatches>("matchThirdSpaceTrainersV1", messages);
  if (!result || !Array.isArray(result.matches) || !result.brief || !Array.isArray(result.unconfirmed)) {
    throw new Error("The recommendations could not be read. Please retry.");
  }
  return result;
}
