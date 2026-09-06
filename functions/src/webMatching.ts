import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp, type DocumentReference, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { matchDealbreakersSchema, type MatchedTrainer, type MatchPreviewResult } from "../../src/features/onboarding/model/onboardingContract.js";
import { evaluateTrainerMatches, selectTrainerMatches, MATCH_COMPATIBILITY_THRESHOLD, type TrainerMatchingRequest } from "./trainerMatching.js";
import { loadWebTrainerCatalog, resolveWebTrainerPhoto, trainerPreview } from "./webTrainerCatalog.js";

const MATCHING_VERSION = 2;
const LEASE_MS = 5 * 60 * 1_000;
export const matchingProfileHash = (markdown: string) => createHash("sha256").update(markdown).digest("hex");
const savedMatchSchema = z.object({
  trainerId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1).max(500),
  profileVersion: z.number().int().positive(),
  dealbreakers: matchDealbreakersSchema,
  tradeoffs: z.array(z.string().trim().min(1).max(160)).max(3),
});
const savedMatchingSchema = z.object({
  version: z.literal(MATCHING_VERSION),
  profileHash: z.string().length(64),
  catalogHash: z.string().length(64),
  matches: z.array(savedMatchSchema).max(500),
  evaluatedCount: z.number().int().min(0).max(500),
  model: z.string(),
  matchKind: z.enum(["compatible", "closest"]),
}).refine((matching) => matching.matchKind === "closest"
  ? matching.matches.length <= 3
  : matching.matches.every((match) => match.score >= MATCH_COMPATIBILITY_THRESHOLD
    && Object.values(match.dealbreakers).every((status) => status === "met" || status === "not_required")));
export type SavedMatching = z.infer<typeof savedMatchingSchema>;

export function readSavedMatching(value: unknown, profileMarkdown: string): SavedMatching | null {
  const parsed = savedMatchingSchema.safeParse(value);
  if (!parsed.success || parsed.data.profileHash !== matchingProfileHash(profileMarkdown)) return null;
  if (parsed.data.matches.length > parsed.data.evaluatedCount) return null;
  if (new Set(parsed.data.matches.map(({ trainerId }) => trainerId)).size !== parsed.data.matches.length) return null;
  return parsed.data;
}

// The lease prevents duplicate LLM runs across tabs/instances. Completion is
// atomic and tied to the precise brief, and a failed run remains retryable.
export async function ensureWebMatching({
  db, ref, profileMarkdown, model, generateContent,
}: {
  db: Firestore;
  ref: DocumentReference;
  profileMarkdown: string;
  model: string;
  generateContent: (request: TrainerMatchingRequest) => Promise<string>;
}): Promise<SavedMatching> {
  const leaseId = randomUUID();
  const profileHash = matchingProfileHash(profileMarkdown);
  const catalog = await loadWebTrainerCatalog(db);
  const catalogHash = matchingProfileHash(JSON.stringify(catalog));
  const cached = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    if (!data || data.profileMarkdown !== profileMarkdown || data.status === "consumed") {
      throw new HttpsError("aborted", "Your matching details changed. Please try again.");
    }
    if (data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() <= Date.now()) {
      throw new HttpsError("not-found", "This chat has expired. Start a new one.");
    }
    const existing = readSavedMatching(data.matching, profileMarkdown);
    if (existing?.catalogHash === catalogHash) return existing;
    if (data.matchingLease?.expiresAt instanceof Timestamp
      && data.matchingLease.expiresAt.toMillis() > Date.now()) {
      throw new HttpsError("aborted", "Your trainer search is already running. Please try again shortly.");
    }
    transaction.update(ref, { matchingLease: { id: leaseId, profileHash, expiresAt: Timestamp.fromMillis(Date.now() + LEASE_MS) } });
    return null;
  });
  if (cached) return cached;
  try {
    const evaluations = await evaluateTrainerMatches(profileMarkdown, catalog, generateContent);
    const selection = selectTrainerMatches(evaluations);
    const versions = new Map(catalog.map(({ trainer, profileVersion }) => [trainer.id, profileVersion]));
    const matching: SavedMatching = {
      version: MATCHING_VERSION, profileHash, catalogHash, model, evaluatedCount: catalog.length,
      matchKind: selection.matchKind,
      matches: selection.evaluations.map(({ trainerId, score, reason, hardConstraints, tradeoffs }) => ({
        trainerId, score, reason, dealbreakers: hardConstraints, tradeoffs, profileVersion: versions.get(trainerId)!,
      })),
    };
    await db.runTransaction(async (transaction) => {
      const data = (await transaction.get(ref)).data();
      if (!data || data.matchingLease?.id !== leaseId || data.profileMarkdown !== profileMarkdown
        || data.status === "consumed" || (data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() <= Date.now())) {
        throw new HttpsError("aborted", "Your matching details changed. Please try again.");
      }
      transaction.update(ref, { matching: { ...matching, completedAt: Timestamp.now() }, matchingLease: FieldValue.delete() });
    });
    return matching;
  } catch (error) {
    await db.runTransaction(async (transaction) => {
      const data = (await transaction.get(ref)).data();
      if (data?.matchingLease?.id === leaseId) transaction.update(ref, { matchingLease: FieldValue.delete() });
    }).catch(() => undefined);
    if (error instanceof HttpsError) throw error;
    // Provider errors can contain brief text. Keep them out of client messages.
    throw new HttpsError("unavailable", "We couldn’t finish finding your trainers. Your details are saved; please try again.");
  }
}

async function availableMatches(db: Firestore, matching: SavedMatching, uid?: string) {
  const catalog = await loadWebTrainerCatalog(db, matching.matches.map(({ trainerId }) => trainerId), uid);
  const byId = new Map(catalog.map((candidate) => [candidate.trainer.id, candidate]));
  return matching.matches.flatMap((match) => {
    const candidate = byId.get(match.trainerId);
    return candidate && candidate.profileVersion === match.profileVersion ? [{ ...match, trainer: candidate.trainer }] : [];
  });
}

export async function webMatchPreviews(db: Firestore, matching: SavedMatching): Promise<MatchPreviewResult> {
  const matches = await availableMatches(db, matching);
  return {
    totalMatches: matches.length,
    matchKind: matching.matchKind,
    previews: await Promise.all(matches.slice(0, 3).map(async ({ trainer }) => trainerPreview(await resolveWebTrainerPhoto(trainer)))),
  };
}

export async function webMatchedProfiles(db: Firestore, matching: SavedMatching, uid: string): Promise<MatchedTrainer[]> {
  const matches = await availableMatches(db, matching, uid);
  return Promise.all(matches.map(async ({ trainer, score, reason, dealbreakers, tradeoffs }) => ({
    trainer: await resolveWebTrainerPhoto(trainer), score, reason, dealbreakers, tradeoffs, matchKind: matching.matchKind,
  })));
}
