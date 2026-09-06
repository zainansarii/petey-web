import { FieldValue, Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureWebMatching,
  matchingProfileHash,
  readSavedMatching,
  webMatchedProfiles,
  webMatchPreviews,
  type SavedMatching,
} from "./webMatching.js";
import { loadWebTrainerCatalog, type CatalogTrainer } from "./webTrainerCatalog.js";

vi.mock("./webTrainerCatalog.js", () => ({
  loadWebTrainerCatalog: vi.fn(),
  resolveWebTrainerPhoto: vi.fn(async (trainer) => ({ ...trainer, photo: "https://example.com/signed-photo.webp" })),
  trainerPreview: vi.fn((trainer) => ({ id: trainer.id, name: trainer.name, photo: trainer.photo })),
}));

const markdown = "# Training preferences\nRemote strength coaching on weekday evenings, up to £70 per session.";
const catalogTrainer = (id = "trainer-one", profileVersion = 3): CatalogTrainer => ({
  profileVersion,
  trainer: {
    id,
    name: "Trainer One",
    photo: `onboarding/${id}/profile/photo.webp`,
    specialty: "Strength",
    specialties: ["Strength"],
    area: "Islington · N1",
    price: 65,
    tenPackPrice: 590,
    monthlyPrice: 340,
    coachingStyles: ["Calm"],
    venues: ["Remote"],
    qualifications: ["Level 3 Personal Training"],
    availability: ["Weekday evenings"],
    bio: "Practical strength coaching.",
  },
});
const savedMatching = (ids = ["trainer-one"]): SavedMatching => ({
  version: 2,
  matchKind: "compatible",
  profileHash: matchingProfileHash(markdown),
  catalogHash: matchingProfileHash(JSON.stringify(ids.map((id) => catalogTrainer(id)))),
  matches: ids.map((trainerId) => ({ trainerId, score: 85, reason: "A good coaching fit.", profileVersion: 3, dealbreakers: { budget: "met", venue: "met", location: "not_required", availability: "met", trainerGender: "not_required", otherRequirements: "not_required" }, tradeoffs: [] })),
  evaluatedCount: ids.length,
  model: "test-model",
});
const modelResponse = () => JSON.stringify({ evaluations: [{
  trainerId: "trainer-one", compatible: true, score: 85, reason: "Calm remote strength coaching within your budget.",
  hardConstraints: { budget: "met", venue: "met", location: "not_required", availability: "met", trainerGender: "not_required", otherRequirements: "not_required" },
  tradeoffs: [],
}] });

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
};

// A serial transaction harness stages writes until commit, preserving Timestamp
// and FieldValue instances. Catalog/provider I/O is mocked separately.
function transactionDatabase(initial: Record<string, unknown>) {
  let data: Record<string, unknown> | undefined = { ...initial };
  let queue = Promise.resolve<unknown>(undefined);
  const ref = { path: "webOnboardingDrafts/test-draft" } as DocumentReference;
  const runTransaction = vi.fn((callback: (transaction: unknown) => Promise<unknown>) => {
    const task = queue.then(async () => {
      const updates: Record<string, unknown>[] = [];
      const value = await callback({
        get: async () => ({ data: () => data ? { ...data } : undefined }),
        update: (_ref: unknown, patch: Record<string, unknown>) => { updates.push(patch); },
      });
      for (const patch of updates) {
        if (!data) throw new Error("The document was deleted.");
        for (const [key, value] of Object.entries(patch)) {
          if (value instanceof FieldValue && value.isEqual(FieldValue.delete())) delete data[key];
          else data[key] = value;
        }
      }
      return value;
    });
    queue = task.catch(() => undefined);
    return task;
  });
  return {
    db: { runTransaction } as unknown as Firestore,
    ref,
    read: () => data,
    update: (patch: Record<string, unknown>) => { data = { ...data, ...patch }; },
    delete: () => { data = undefined; },
  };
}

const initialDraft = () => ({
  status: "review", profileMarkdown: markdown, expiresAt: Timestamp.fromMillis(Date.now() + 60_000),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadWebTrainerCatalog).mockResolvedValue([catalogTrainer()]);
});

describe("saved matching validation", () => {
  it("accepts a complete result only for the exact brief that was evaluated", () => {
    const saved = savedMatching();
    expect(readSavedMatching(saved, markdown)).toEqual(saved);
    expect(readSavedMatching(saved, `${markdown}\nDifferent preference`)).toBeNull();
  });

  it.each([
    { version: 1 },
    { evaluatedCount: -1 },
    { evaluatedCount: 501 },
    { profileHash: "wrong" },
    { matches: [{ ...savedMatching().matches[0], score: 69 }] },
    { matches: [{ ...savedMatching().matches[0], profileVersion: 0 }] },
    { matches: [{ ...savedMatching().matches[0], trainerId: "../other" }] },
    { matches: [savedMatching().matches[0], savedMatching().matches[0]] },
  ])("rejects corrupt or unsupported saved results: %j", (patch) => {
    expect(readSavedMatching({ ...savedMatching(), ...patch }, markdown)).toBeNull();
  });

  it("rejects a match count larger than the number of trainers evaluated", () => {
    expect(readSavedMatching({ ...savedMatching(), evaluatedCount: 0 }, markdown)).toBeNull();
  });

  it("accepts a completed zero-match run without treating it as a cache miss", () => {
    const saved = savedMatching([]);
    expect(readSavedMatching(saved, markdown)).toEqual(saved);
  });
});

describe("matching lease and atomic completion", () => {
  it("recomputes the previous algorithm's empty result and persists closest-option caveats", async () => {
    const harness = transactionDatabase({ ...initialDraft(), matching: { ...savedMatching(), version: 1, matches: [] } });
    const generateContent = vi.fn(async () => {
      const result = JSON.parse(modelResponse());
      Object.assign(result.evaluations[0], { score: 62, compatible: false, tradeoffs: ["More talkative than preferred."] });
      result.evaluations[0].hardConstraints.budget = "not_met";
      return JSON.stringify(result);
    });
    const saved = await ensureWebMatching({ ...harness, profileMarkdown: markdown, model: "test-model", generateContent });
    expect(saved).toMatchObject({ version: 2, matchKind: "closest", matches: [{ trainerId: "trainer-one", score: 62, dealbreakers: { budget: "not_met" }, tradeoffs: ["More talkative than preferred."] }] });
    expect(readSavedMatching(saved, markdown)).toEqual(saved);
    expect((await webMatchPreviews(harness.db, saved)).matchKind).toBe("closest");
    expect(await webMatchedProfiles(harness.db, saved, "client-one")).toMatchObject([{ matchKind: "closest", dealbreakers: { budget: "not_met" }, tradeoffs: ["More talkative than preferred."] }]);
    expect(await ensureWebMatching({ ...harness, profileMarkdown: markdown, model: "test-model", generateContent })).toEqual(saved);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("reuses a saved match result after verifying the catalogue without calling the provider", async () => {
    const saved = savedMatching();
    const harness = transactionDatabase({ ...initialDraft(), matching: saved });
    const generateContent = vi.fn();
    expect(await ensureWebMatching({ ...harness, profileMarkdown: markdown, model: "test-model", generateContent })).toEqual(saved);
    expect(generateContent).not.toHaveBeenCalled();
    expect(loadWebTrainerCatalog).toHaveBeenCalledTimes(1);
  });

  it.each(["profile version", "matching facts", "new trainer"])(
    "reevaluates cached decisions when the catalogue changes: %s",
    async (change) => {
      const saved = savedMatching();
      const harness = transactionDatabase({ ...initialDraft(), matching: saved });
      const changed = catalogTrainer();
      if (change === "profile version") changed.profileVersion = 4;
      if (change === "matching facts") changed.trainer.price = 75;
      const catalog = change === "new trainer" ? [changed, catalogTrainer("trainer-two")] : [changed];
      vi.mocked(loadWebTrainerCatalog).mockResolvedValue(catalog);
      const generateContent = vi.fn(async () => {
        const result = JSON.parse(modelResponse());
        if (change === "new trainer") result.evaluations.push({ ...result.evaluations[0], trainerId: "trainer-two" });
        return JSON.stringify(result);
      });
      const result = await ensureWebMatching({ ...harness, profileMarkdown: markdown, model: "test-model", generateContent });
      expect(generateContent).toHaveBeenCalledTimes(1);
      expect(result.catalogHash).not.toBe(saved.catalogHash);
      expect(result.evaluatedCount).toBe(catalog.length);
      expect(result.matches[0]?.profileVersion).toBe(changed.profileVersion);
    },
  );

  it("invalidates old results when all previously eligible trainers are withdrawn", async () => {
    const harness = transactionDatabase({ ...initialDraft(), matching: savedMatching() });
    vi.mocked(loadWebTrainerCatalog).mockResolvedValue([]);
    const generateContent = vi.fn();
    const result = await ensureWebMatching({ ...harness, profileMarkdown: markdown, model: "test-model", generateContent });
    expect(result).toMatchObject({ evaluatedCount: 0, matches: [] });
    expect(generateContent).not.toHaveBeenCalled();
    expect(harness.read()?.matching).toMatchObject({ evaluatedCount: 0, matches: [] });
  });

  it("prevents a simultaneous second request from starting another model run", async () => {
    const harness = transactionDatabase(initialDraft());
    const entered = deferred<void>();
    const provider = deferred<string>();
    const generateContent = vi.fn(async () => { entered.resolve(); return provider.promise; });
    const args = { ...harness, profileMarkdown: markdown, model: "test-model", generateContent };
    const firstRun = ensureWebMatching(args);
    await entered.promise;

    await expect(ensureWebMatching(args)).rejects.toMatchObject({ code: "aborted" });
    expect(generateContent).toHaveBeenCalledTimes(1);
    provider.resolve(modelResponse());
    expect((await firstRun).matches).toHaveLength(1);
    expect(harness.read()?.matchingLease).toBeUndefined();
    expect(harness.read()?.matching).toMatchObject({ evaluatedCount: 1 });
  });

  it("removes its lease after provider failure and allows a successful retry without leaking provider text", async () => {
    const harness = transactionDatabase(initialDraft());
    const failure = new Error("Private client brief accidentally included in provider error");
    const generateContent = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(modelResponse());
    const args = { ...harness, profileMarkdown: markdown, model: "test-model", generateContent };
    await expect(ensureWebMatching(args)).rejects.toMatchObject({
      code: "unavailable",
      message: expect.not.stringContaining("Private client brief"),
    });
    expect(harness.read()?.matchingLease).toBeUndefined();
    expect(harness.read()?.matching).toBeUndefined();
    expect((await ensureWebMatching(args)).matches).toHaveLength(1);
  });

  it.each(["brief changed", "consumed", "expired", "deleted"])(
    "does not commit results when the draft becomes %s during the model call",
    async (change) => {
      const harness = transactionDatabase(initialDraft());
      const generateContent = vi.fn(async () => {
        if (change === "brief changed") harness.update({ profileMarkdown: "A different preference brief" });
        if (change === "consumed") harness.update({ status: "consumed" });
        if (change === "expired") harness.update({ expiresAt: Timestamp.fromMillis(Date.now() - 1) });
        if (change === "deleted") harness.delete();
        return modelResponse();
      });
      await expect(ensureWebMatching({ ...harness, profileMarkdown: markdown, model: "test-model", generateContent }))
        .rejects.toMatchObject({ code: "aborted" });
      expect(harness.read()?.matching).toBeUndefined();
      expect(harness.read()?.matchingLease).toBeUndefined();
    },
  );

  it("does not erase a newer worker's lease after losing ownership", async () => {
    const harness = transactionDatabase(initialDraft());
    const replacementLease = { id: "replacement-worker", expiresAt: Timestamp.fromMillis(Date.now() + 60_000) };
    const generateContent = vi.fn(async () => {
      harness.update({ matchingLease: replacementLease });
      return modelResponse();
    });
    await expect(ensureWebMatching({ ...harness, profileMarkdown: markdown, model: "test-model", generateContent }))
      .rejects.toMatchObject({ code: "aborted" });
    expect(harness.read()?.matchingLease).toEqual(replacementLease);
    expect(harness.read()?.matching).toBeUndefined();
  });

  it("replaces an expired lease and completes an empty catalogue without a model call", async () => {
    const harness = transactionDatabase({
      ...initialDraft(), matchingLease: { id: "old-worker", expiresAt: Timestamp.fromMillis(Date.now() - 1) },
    });
    vi.mocked(loadWebTrainerCatalog).mockResolvedValue([]);
    const generateContent = vi.fn();
    const result = await ensureWebMatching({ ...harness, profileMarkdown: markdown, model: "test-model", generateContent });
    expect(result).toMatchObject({ matches: [], evaluatedCount: 0 });
    expect(generateContent).not.toHaveBeenCalled();
    expect(harness.read()?.matchingLease).toBeUndefined();
  });
});

describe("serving saved matches", () => {
  it("counts all available matches while revealing at most three preview cards in ranked order", async () => {
    const ids = ["first", "second", "third", "fourth", "fifth"];
    vi.mocked(loadWebTrainerCatalog).mockResolvedValue(ids.map((id) => catalogTrainer(id)).reverse());
    const db = {} as Firestore;
    const result = await webMatchPreviews(db, savedMatching(ids));
    expect(result.totalMatches).toBe(5);
    expect(result.previews.map(({ id }) => id)).toEqual(ids.slice(0, 3));
    expect(loadWebTrainerCatalog).toHaveBeenCalledWith(db, ids, undefined);
  });

  it("rechecks publication, version and user-specific blocks before returning full profiles", async () => {
    const ids = ["approved", "withdrawn", "changed"];
    vi.mocked(loadWebTrainerCatalog).mockResolvedValue([catalogTrainer("approved"), catalogTrainer("changed", 4)]);
    const db = {} as Firestore;
    const result = await webMatchedProfiles(db, savedMatching(ids), "client-uid");
    expect(result.map(({ trainer }) => trainer.id)).toEqual(["approved"]);
    expect(result[0]).toMatchObject({ score: 85, reason: "A good coaching fit." });
    expect(loadWebTrainerCatalog).toHaveBeenCalledWith(db, ids, "client-uid");
  });
});
