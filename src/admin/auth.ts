import { getApps, initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  onIdTokenChanged,
  reauthenticateWithPopup,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export type ReviewSession = { uid: string; email: string; authTime: number };
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

let contextPromise: ReturnType<typeof createContext> | undefined;
let reviewAppCheck: AppCheck | undefined;
async function createContext() {
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim();
  if (!Object.values(firebaseConfig).every(Boolean) || !siteKey) {
    throw new Error("Trainer review is not configured for this environment.");
  }
  const app = getApps().find((candidate) => candidate.name === "petey-trainer-review")
    ?? initializeApp(firebaseConfig, "petey-trainer-review");
  const debugToken = import.meta.env.DEV ? import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim() : undefined;
  if (debugToken) {
    (globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }
  reviewAppCheck ??= initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  const auth = getAuth(app);
  await setPersistence(auth, browserSessionPersistence);
  return { auth, appCheck: reviewAppCheck, functions: getFunctions(app, "europe-west2") };
}

const context = () => contextPromise ??= createContext().catch((error) => {
  contextPromise = undefined;
  throw error;
});

export const observeReviewSession = async (
  change: (session: ReviewSession | null) => void,
  error: (error: unknown) => void,
) => {
  const { auth } = await context();
  let generation = 0;
  let disposed = false;
  const unsubscribe = onIdTokenChanged(auth, async (user) => {
    const currentGeneration = ++generation;
    try {
      if (disposed) return;
      if (!user) return change(null);
      const token = await user.getIdTokenResult();
      if (disposed || generation !== currentGeneration) return;
      const authTime = Date.parse(token.authTime);
      if (!Number.isFinite(authTime)) throw new Error("Your review session needs to be renewed. Sign in again to continue.");
      change({ uid: user.uid, email: user.email ?? "", authTime });
    } catch (failure) { if (!disposed && generation === currentGeneration) error(failure); }
  }, (failure) => { if (!disposed) error(failure); });
  return () => { disposed = true; generation += 1; unsubscribe(); };
};

export const signInReviewer = async (reauthenticate = false) => {
  const { auth } = await context();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  if (reauthenticate && auth.currentUser) {
    await reauthenticateWithPopup(auth.currentUser, provider);
    await auth.currentUser.getIdToken(true);
  } else {
    await signInWithPopup(auth, provider);
  }
};

export const signOutReviewer = async () => signOut((await context()).auth);

export async function callReviewFunction<Request, Response>(name: string, request: Request): Promise<Response> {
  const { auth, functions, appCheck } = await context();
  if (!auth.currentUser) throw new Error("Sign in to review trainer applications.");
  await getToken(appCheck, false);
  const result = await httpsCallable<Request, Response>(functions, name, { timeout: 60_000 })(request);
  return result.data;
}

export function reviewErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code.toLowerCase().startsWith("appcheck/")) return "This browser could not complete the security check. Check your connection and allow this site's security challenge, then try again. Your unsaved changes are kept.";
  if (code.endsWith("permission-denied")) return "This account does not have active reviewer access. Contact the site owner or sign in with your reviewer account.";
  if (code.endsWith("unauthenticated") || code === "auth/requires-recent-login") return "Your review session needs to be renewed. Sign in again to continue.";
  if (code.endsWith("aborted")) return "This application changed since you opened it. Reload the latest version before saving or deciding.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled. You can try again when ready.";
  if (code === "auth/popup-blocked") return "Allow the Google sign-in pop-up for this site, then try again.";
  if (code.endsWith("unavailable") || code.endsWith("deadline-exceeded")) return "The review service could not be reached. Your unsaved changes are still here. Try again.";
  if ((code.endsWith("failed-precondition") || code.endsWith("invalid-argument")) && error && typeof error === "object" && "details" in error) {
    const details = error.details as { issues?: unknown; fields?: unknown } | null;
    if (Array.isArray(details?.issues)) {
      const issues = details.issues.filter((issue): issue is string => typeof issue === "string").slice(0, 20);
      if (issues.length) return issues.join(" ");
    }
    if (Array.isArray(details?.fields)) {
      const fields = details.fields.filter((field): field is { path: string; message: string } => field && typeof field.path === "string" && typeof field.message === "string").slice(0, 20);
      if (fields.length) return fields.map((field) => `${field.path}: ${field.message}`).join(" ");
    }
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
