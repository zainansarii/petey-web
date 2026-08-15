const EMAIL_STORAGE_KEY = "petey.web.email-for-sign-in";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const createFirebaseAuth = async () => {
  if (!isFirebaseConfigured) throw new Error("Firebase Web authentication is not configured.");
  const [{ getApp, getApps, initializeApp }, { getAuth }] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]);
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
};

let firebaseAuthPromise: ReturnType<typeof createFirebaseAuth> | null = null;

const getFirebaseAuth = () => {
  if (!isFirebaseConfigured) return createFirebaseAuth();
  firebaseAuthPromise ??= createFirebaseAuth().catch((error) => {
    firebaseAuthPromise = null;
    throw error;
  });
  return firebaseAuthPromise;
};

const removeStoredEmail = () => {
  try {
    window.localStorage.removeItem(EMAIL_STORAGE_KEY);
  } catch {
    // Auth remains usable when storage becomes unavailable after the link was sent.
  }
};

export const requestMagicLink = async (email: string): Promise<"sent" | "preview"> => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isFirebaseConfigured) return "preview";

  const [{ sendSignInLinkToEmail }, auth] = await Promise.all([
    import("firebase/auth"),
    getFirebaseAuth(),
  ]);

  const continueUrl = new URL(window.location.href);
  continueUrl.search = "";
  continueUrl.hash = "";
  continueUrl.searchParams.set("finishSignUp", "1");

  try {
    window.localStorage.setItem(EMAIL_STORAGE_KEY, normalizedEmail);
  } catch {
    throw new Error("Allow browser storage so the secure email link can be completed on this device.");
  }

  try {
    await sendSignInLinkToEmail(auth, normalizedEmail, {
      url: continueUrl.toString(),
      handleCodeInApp: true,
    });
  } catch (error) {
    removeStoredEmail();
    throw error;
  }
  return "sent";
};

export type FinishMagicLinkResult = "ignored" | "signed-in" | "missing-email" | "error";

type FinishMagicLinkCache = {
  href: string;
  result: Promise<FinishMagicLinkResult>;
};

let finishMagicLinkCache: FinishMagicLinkCache | null = null;

const finishMagicLinkForUrl = async (href: string): Promise<FinishMagicLinkResult> => {
  if (!isFirebaseConfigured) return "ignored";

  const [{ isSignInWithEmailLink, signInWithEmailLink }, auth] = await Promise.all([
    import("firebase/auth"),
    getFirebaseAuth(),
  ]);
  if (!isSignInWithEmailLink(auth, href)) return "ignored";

  let email: string | null = null;
  try {
    email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
  } catch {
    // Missing storage is handled by the existing request-another-link flow.
  }
  if (!email) return "missing-email";

  try {
    await signInWithEmailLink(auth, email, href);
    removeStoredEmail();
    window.history.replaceState({}, document.title, window.location.pathname);
    return "signed-in";
  } catch {
    return "error";
  }
};

export const finishMagicLink = (): Promise<FinishMagicLinkResult> => {
  const href = window.location.href;
  if (finishMagicLinkCache?.href === href) return finishMagicLinkCache.result;

  const result = finishMagicLinkForUrl(href);
  finishMagicLinkCache = { href, result };
  return result;
};

export const observeFirebaseAuthSession = async (
  onSessionChange: (isSignedIn: boolean) => void,
): Promise<() => void> => {
  if (!isFirebaseConfigured) return () => undefined;

  const [{ onAuthStateChanged }, auth] = await Promise.all([
    import("firebase/auth"),
    getFirebaseAuth(),
  ]);

  return onAuthStateChanged(
    auth,
    (user) => onSessionChange(Boolean(user)),
    () => onSessionChange(false),
  );
};
