import { getStorage } from "firebase-admin/storage";
import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { trainerSchema, type Trainer, type TrainerCardPreview } from "../../src/features/discovery/model/trainer.js";
import type { MatchCandidate } from "./trainerMatching.js";
import { projectWebTrainer } from "./webTrainerProjection.js";

export type CatalogTrainer = MatchCandidate & { profileVersion: number };
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => typeof value === "object" && value !== null
  && !Array.isArray(value) ? value as RecordValue : {};

// Mirror the shared mobile publication/evidence gates. Never pass the private
// application, qualification evidence or trainer contact details to the model.
export function approvedWebTrainer(
  id: string,
  publicValue: unknown,
  privateValue: unknown,
  accountValue: unknown,
  now = new Date(),
): CatalogTrainer | null {
  const published = record(publicValue);
  const application = record(privateValue);
  const account = record(accountValue);
  const approved = record(application.approvedProfile);
  if (account.role !== "trainer" || account.status !== "active"
    || published.published !== true || published.approvalStatus !== "approved"
    || application.approvalStatus === "suspended"
    || !Number.isInteger(published.profileVersion)
    || (published.profileVersion as number) <= 0
    || application.approvedProfileVersion !== published.profileVersion
    || approved.credentialsSubmitted === false
    || !approved.insurance || !approved.level3Qualification) return null;
  const qualifications = Array.isArray(approved.otherQualifications) ? approved.otherQualifications : [];
  const dates = [approved.insurance, approved.firstAid, approved.level3Qualification, ...qualifications]
    .map((value) => record(value).expiresOn).filter(Boolean);
  if (dates.some((date) => typeof date !== "string"
    || !(Date.parse(`${date}T23:59:59.999Z`) >= now.getTime()))) return null;
  const parsed = trainerSchema.safeParse(published.webProfile);
  if (!parsed.success || parsed.data.id !== id) return null;
  const trainer = projectWebTrainer(published, parsed.data);
  if (!trainer || trainer.id !== id
    || published.primaryPhotoPath !== approved.primaryPhotoPath) return null;
  const prefix = `onboarding/${id}/profile/`;
  if (!trainer.photo.startsWith(prefix) || !trainer.photo.slice(prefix.length)
    || trainer.photo.slice(prefix.length).includes("/")) return null;
  return {
    trainer,
    profileVersion: published.profileVersion as number,
    ...(typeof published.gender === "string" ? { gender: published.gender } : {}),
    ...(Array.isArray(published.idealClients)
      ? { idealClients: published.idealClients.filter((item): item is string => typeof item === "string") } : {}),
  };
}

export async function loadWebTrainerCatalog(db: Firestore, ids?: readonly string[], uid?: string) {
  if (ids?.length === 0) return [];
  // Fail explicitly if this synchronous MVP outgrows its bound, never claim a
  // partial catalogue is a complete match run. Move to queued shards at scale.
  const snapshots = ids
    ? await Promise.all(ids.map((id) => db.collection("publicTrainers").doc(id).get()))
    : (await db.collection("publicTrainers").where("published", "==", true).limit(501).get()).docs;
  if (snapshots.length > 500) throw new HttpsError("resource-exhausted", "The trainer catalogue needs a larger matching run. Please try again later.");
  const results: CatalogTrainer[] = [];
  for (let offset = 0; offset < snapshots.length; offset += 25) {
    const chunk = await Promise.all(snapshots.slice(offset, offset + 25).map(async (snapshot) => {
      if (!snapshot.exists) return null;
      const [application, account, block] = await Promise.all([
        db.collection("trainerProfiles").doc(snapshot.id).get(),
        db.collection("accounts").doc(snapshot.id).get(),
        uid ? db.collection("blocks").doc([uid, snapshot.id].sort().join("_")).get() : null,
      ]);
      if (block?.exists) return null;
      return approvedWebTrainer(snapshot.id, snapshot.data(), application.data(), account.data());
    }));
    results.push(...chunk.filter((trainer): trainer is CatalogTrainer => trainer !== null));
  }
  return results.sort((a, b) => a.trainer.id.localeCompare(b.trainer.id));
}

export async function resolveWebTrainerPhoto(trainer: Trainer): Promise<Trainer> {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new HttpsError("failed-precondition", "Trainer media is not configured.");
  const [photo] = await getStorage().bucket(`${projectId}.firebasestorage.app`).file(trainer.photo)
    .getSignedUrl({ action: "read", version: "v4", expires: Date.now() + 2 * 60 * 60 * 1_000 });
  return { ...trainer, photo };
}

export const trainerPreview = (trainer: Trainer): TrainerCardPreview => ({
  id: trainer.id, name: trainer.name, photo: trainer.photo,
  specialty: trainer.specialty, area: trainer.area, price: trainer.price,
  ...(trainer.isDemo === undefined ? {} : { isDemo: trainer.isDemo }),
});
