import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTrainerMatchingRequest } from "./trainerMatching.js";
import { WEB_TRAINER_CATALOG_ENABLED, loadWebTrainerCatalog } from "./webTrainerCatalog.js";
import { ensureWebMatching, matchingProfileHash, webMatchedProfiles, webMatchPreviews, type SavedMatching } from "./webMatching.js";

vi.mock("./webTrainerCatalog.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./webTrainerCatalog.js")>();
  return { ...actual, resolveWebTrainerPhoto: vi.fn(async (trainer) => ({ ...trainer, photo: "https://example.com/expiring-photo.webp" })) };
});

const id = `form_${"c".repeat(64)}`;
const photo = `web-trainer-applications/${id}/revisions/1/profile-${"d".repeat(64)}.webp`;
const markdown = "# Training preferences\nOnline strength coaching, weekday evenings, up to £70 per session.";
const constraints = { budget: "met", venue: "met", location: "not_required", availability: "met", trainerGender: "not_required", otherRequirements: "not_required" } as const;

function fixture() {
  const published = {
    source: "google_form", applicationId: id, trainerId: id, published: true,
    approvalStatus: "approved", profileVersion: 3, acceptingNewClients: true,
    availableFrom: null as string | null, verificationExpiresOn: "2027-01-01",
    profile: {
      id, name: "Approved Trainer", photo, specialty: "Strength", specialties: [], area: "Online",
      price: 65, tenPackPrice: null, monthlyPrice: null, coachingStyles: ["Calm"], venues: ["Online"],
      qualifications: ["Level 3 Personal Training"], availability: ["Weekday evenings"],
      bio: "Approved strength coaching.", sessionDurationMinutes: 60,
      pricingNotes: "Five sessions for £300.", serviceAreaNotes: "Online across the UK.",
      professionalUrl: "https://example.com/public-trainer",
      // Even an accidental extra field in a server-owned snapshot is stripped.
      email: "private-contact@example.com", insurance: "private-policy-reference",
    },
  };
  const application = {
    status: "approved", version: 3, publishedVersion: 3, publishedPhotoPath: photo,
    draft: { bio: "private-unreviewed-draft", acceptingNewClients: true },
    email: "private-contact@example.com", verification: { insurance: "private-policy-reference" },
    source: { editUrl: "https://docs.google.com/forms/private-edit-capability", answers: { original: "private-original-answer" } },
  };
  const entries: Record<string, Record<string, unknown>> = {
    [`webTrainerCatalog/${id}`]: published,
    [`webTrainerApplications/${id}`]: application,
  };
  const ref = { path: "webClientProfiles/client-one" } as DocumentReference;
  const client: Record<string, unknown> = { profileMarkdown: markdown };
  const snapshot = (path: string) => ({ id: path.split("/").at(-1)!, exists: Object.hasOwn(entries, path), data: () => entries[path] });
  const db = {
    collection(name: string) {
      const query = {
        doc: (documentId: string) => ({ get: async () => snapshot(`${name}/${documentId}`) }),
        where: () => query,
        limit: (count: number) => ({ get: async () => ({ docs: Object.keys(entries)
          .filter((path) => path.startsWith(`${name}/`) && entries[path]!.published === true)
          .slice(0, count).map(snapshot) }) }),
      };
      return query;
    },
    async runTransaction(callback: (transaction: unknown) => Promise<unknown>) {
      return callback({ get: async () => ({ data: () => client }), update: (_ref: unknown, patch: object) => Object.assign(client, patch) });
    },
  } as unknown as Firestore;
  return { db, ref, client, entries, published, application };
}

async function cachedMatching(data: ReturnType<typeof fixture>): Promise<SavedMatching> {
  const catalog = await loadWebTrainerCatalog(data.db);
  const matching: SavedMatching = {
    version: 2, profileHash: matchingProfileHash(markdown), catalogHash: matchingProfileHash(JSON.stringify(catalog)),
    evaluatedCount: 1, model: "test-model", matchKind: "compatible",
    matches: [{ trainerId: id, profileVersion: 3, score: 90, reason: "Calm strength coaching within budget.", dealbreakers: constraints, tradeoffs: [] }],
  };
  data.client.matching = matching;
  return matching;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-05T12:00:00Z"));
  vi.spyOn(WEB_TRAINER_CATALOG_ENABLED, "value").mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("form catalogue eligibility through matching caches", () => {
  it.each(["unpublished", "suspended", "expired", "unavailable", "future start", "stale version", "blocked"])(
    "rechecks %s before serving previously cached full profiles",
    async (change) => {
      const data = fixture();
      const saved = await cachedMatching(data);
      if (change === "unpublished") data.published.published = false;
      if (change === "suspended") data.application.status = "suspended";
      if (change === "expired") data.published.verificationExpiresOn = "2026-09-04";
      if (change === "unavailable") data.published.acceptingNewClients = false;
      if (change === "future start") data.published.availableFrom = "2026-09-06";
      if (change === "stale version") data.application.publishedVersion = 2;
      if (change === "blocked") data.entries[`blocks/${["client-one", id].sort().join("_")}`] = {};
      expect(await webMatchedProfiles(data.db, saved, "client-one")).toEqual([]);
      if (change !== "blocked") {
        expect(await webMatchPreviews(data.db, saved)).toMatchObject({ totalMatches: 0, previews: [] });
        const generateContent = vi.fn();
        const refreshed = await ensureWebMatching({ ...data, profileMarkdown: markdown, model: "test-model", generateContent });
        expect(refreshed).toMatchObject({ evaluatedCount: 0, matches: [] });
        expect(refreshed.catalogHash).not.toBe(saved.catalogHash);
        expect(generateContent).not.toHaveBeenCalled();
      }
    },
  );

  it("keeps a pending edit out of cached profiles and model inputs without invalidating approved data", async () => {
    const data = fixture();
    const saved = await cachedMatching(data);
    data.application.status = "pending_review";
    data.application.version = 4;
    data.application.draft = { bio: "private-unreviewed-draft", acceptingNewClients: false };
    const generateContent = vi.fn();
    expect(await ensureWebMatching({ ...data, profileMarkdown: markdown, model: "test-model", generateContent })).toEqual(saved);
    expect(generateContent).not.toHaveBeenCalled();
    const profiles = await webMatchedProfiles(data.db, saved, "client-one");
    expect(profiles[0]?.trainer.bio).toBe("Approved strength coaching.");
    const catalog = await loadWebTrainerCatalog(data.db);
    const request = buildTrainerMatchingRequest(markdown, catalog);
    for (const privateText of ["private-unreviewed-draft", "private-contact@example.com", "private-policy-reference", "private-edit-capability", "private-original-answer"]) {
      expect(JSON.stringify(profiles)).not.toContain(privateText);
      expect(request.contents).not.toContain(privateText);
    }
    expect(request.contents).not.toContain("https://example.com/public-trainer");
  });

  it("excludes a trainer withdrawn while a fresh model evaluation is running", async () => {
    const data = fixture();
    const generateContent = vi.fn(async () => {
      data.application.status = "suspended";
      return JSON.stringify({ evaluations: [{ trainerId: id, compatible: true, score: 90, reason: "Good fit before withdrawal.", hardConstraints: constraints, tradeoffs: [] }] });
    });
    const saved = await ensureWebMatching({ ...data, profileMarkdown: markdown, model: "test-model", generateContent });
    expect(saved.matches).toHaveLength(1);
    expect(await webMatchPreviews(data.db, saved)).toMatchObject({ totalMatches: 0, previews: [] });
    expect(await webMatchedProfiles(data.db, saved, "client-one")).toEqual([]);
  });

  it("includes a newly approved form profile when refreshing an earlier empty match cache", async () => {
    const data = fixture();
    const empty: SavedMatching = {
      ...(await cachedMatching(data)), catalogHash: matchingProfileHash("[]"), evaluatedCount: 0, matches: [],
    };
    data.client.matching = empty;
    const generateContent = vi.fn(async () => JSON.stringify({ evaluations: [{ trainerId: id, compatible: true, score: 90, reason: "New approved trainer fits.", hardConstraints: constraints, tradeoffs: [] }] }));
    const refreshed = await ensureWebMatching({ ...data, profileMarkdown: markdown, model: "test-model", generateContent });
    expect(generateContent).toHaveBeenCalledOnce();
    expect(refreshed.matches.map((match) => match.trainerId)).toEqual([id]);
    expect((await webMatchedProfiles(data.db, refreshed, "client-one"))[0]?.trainer.id).toBe(id);
  });
});
