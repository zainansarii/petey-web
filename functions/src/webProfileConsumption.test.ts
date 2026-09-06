import { createHash } from "node:crypto";
import { Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  beforeTransaction: undefined as (() => void) | undefined,
}));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn() }));
vi.mock("firebase-admin/firestore", async (original) => {
  const sdk = await original<typeof import("firebase-admin/firestore")>();
  const snapshot = (path: string) => ({ exists: store.docs.has(path), data: () => store.docs.get(path) });
  return {
    ...sdk,
    getFirestore: () => ({
      collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}`, get: async () => snapshot(`${name}/${id}`) }) }),
      recursiveDelete: async (ref: DocumentReference) => { store.docs.delete(ref.path); },
      runTransaction: async (run: (tx: unknown) => Promise<void>) => {
        store.beforeTransaction?.();
        const writes: (() => void)[] = [];
        await run({
          get: async (ref: DocumentReference) => snapshot(ref.path),
          set: (ref: DocumentReference, value: Record<string, unknown>) => writes.push(() => { store.docs.set(ref.path, value); }),
          update: (ref: DocumentReference, value: Record<string, unknown>) => writes.push(() => {
            if (!store.docs.has(ref.path)) throw new Error("Missing document");
            store.docs.set(ref.path, { ...store.docs.get(ref.path), ...value });
          }),
        });
        writes.forEach((write) => write());
      },
    }),
  };
});
vi.mock("./webMatching.js", async (original) => ({
  ...await original<typeof import("./webMatching.js")>(),
  ensureWebMatching: async ({ ref }: { ref: DocumentReference }) => store.docs.get(ref.path)?.matching,
  webMatchedProfiles: async (_db: unknown, matching: { matches: unknown[] }) => matching.matches,
}));
import { consumeWebOnboardingDraftV3 } from "./index.js";

const markdown = "# Training brief\n\nUpdated running preferences and weekend sessions.";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const capability = { draftId: "00000000-0000-4000-8000-000000000009", capability: "test-retune-capability-000000000000000000000" };
const draftPath = `webOnboardingDraftsV3/${capability.draftId}`;
const profilePath = "webClientProfiles/client-one";
const markerPath = `_webOnboardingConsumptionsV3/${capability.draftId}`;
const matching = {
  version: 2, matchKind: "compatible", profileHash: digest(markdown), catalogHash: digest("catalog"), evaluatedCount: 2, model: "test-model",
  matches: [{ trainerId: "trainer-one", score: 90, reason: "Running and schedule fit.", profileVersion: 1, dealbreakers: { budget: "not_required", venue: "not_required", location: "not_required", availability: "met", trainerGender: "not_required", otherRequirements: "not_required" }, tradeoffs: [] }],
};
const identity = { fullName: "Existing Client", dateOfBirth: "1990-01-01", email: "client@example.test" };
const request = () => ({
  data: capability,
  app: { appId: "test-app" },
  auth: { uid: "client-one", token: { email: "client@example.test", email_verified: true } },
}) as Parameters<typeof consumeWebOnboardingDraftV3.run>[0];

beforeEach(() => {
  store.docs.clear();
  store.beforeTransaction = undefined;
  store.docs.set(draftPath, {
    schemaVersion: 3, profileFormat: "markdown-v1", capabilityHash: digest(capability.capability),
    status: "review", version: 1, confirmationVersion: null, profileMarkdown: markdown,
    matching, consentVersion: "test-consent", expiresAt: Timestamp.fromMillis(Date.now() + 60000),
  });
  store.docs.set(profilePath, {
    profileFormat: "markdown-v1", profileMarkdown: "# Training brief\n\nOriginal strength preferences.",
    identity, signupCompletedAt: "original-signup", customAccountField: "keep-me",
  });
});

describe("authenticated profile consumption", () => {
  it("saves a retune without signup and preserves existing identity and account metadata", async () => {
    const result = await consumeWebOnboardingDraftV3.run(request());
    expect(result).toEqual({ profileMarkdown: markdown, matches: matching.matches });
    expect(store.docs.get(profilePath)).toMatchObject({ identity, signupCompletedAt: "original-signup", customAccountField: "keep-me", profileMarkdown: markdown, matching });
    expect(store.docs.has(draftPath)).toBe(false);
    expect(store.docs.get(markerPath)?.uid).toBe("client-one");
    await expect(consumeWebOnboardingDraftV3.run(request())).resolves.toEqual(result);
  });

  it("supports legacy completed profiles that did not store identity", async () => {
    delete store.docs.get(profilePath)!.identity;
    await consumeWebOnboardingDraftV3.run(request());
    expect(store.docs.get(profilePath)?.profileMarkdown).toBe(markdown);
    expect(store.docs.get(profilePath)).not.toHaveProperty("identity");
  });

  it("does not let a new account skip confirmation", async () => {
    store.docs.delete(profilePath);
    await expect(consumeWebOnboardingDraftV3.run(request())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(store.docs.has(markerPath)).toBe(false);
    expect(store.docs.has(draftPath)).toBe(true);
  });

  it("still consumes a confirmed first signup", async () => {
    store.docs.delete(profilePath);
    Object.assign(store.docs.get(draftPath)!, { status: "confirmed", identity, confirmationVersion: 1 });
    await consumeWebOnboardingDraftV3.run(request());
    expect(store.docs.get(profilePath)).toMatchObject({ identity, profileMarkdown: markdown });
    expect(store.docs.get(profilePath)?.signupCompletedAt).toBeInstanceOf(Timestamp);
  });

  it.each(["signed-out", "unverified", "wrong-capability", "other-email"])("rejects %s access", async (scenario) => {
    const input = request();
    if (scenario === "signed-out") delete input.auth;
    if (scenario === "unverified") input.auth!.token.email_verified = false;
    if (scenario === "wrong-capability") input.data = { ...capability, capability: "invalid-capability-000000000000000000000000" };
    if (scenario === "other-email") input.auth!.token.email = "other@example.test";
    await expect(consumeWebOnboardingDraftV3.run(input)).rejects.toThrow();
    expect(store.docs.get(profilePath)?.profileMarkdown).not.toBe(markdown);
    expect(store.docs.has(markerPath)).toBe(false);
  });

  it("rechecks the existing account inside the transaction", async () => {
    store.beforeTransaction = () => { store.docs.delete(profilePath); };
    await expect(consumeWebOnboardingDraftV3.run(request())).rejects.toMatchObject({ code: "failed-precondition" });
    expect(store.docs.has(markerPath)).toBe(false);
    expect(store.docs.has(draftPath)).toBe(true);
  });
});
