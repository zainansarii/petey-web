import { getStorage } from "firebase-admin/storage";
import type { Firestore } from "firebase-admin/firestore";
import { defineBoolean } from "firebase-functions/params";
import { HttpsError } from "firebase-functions/v2/https";
import { trainerSchema, type Trainer, type TrainerCardPreview } from "../../src/features/discovery/model/trainer.js";
import type { MatchCandidate } from "./trainerMatching.js";
import { projectWebTrainer } from "./webTrainerProjection.js";

export const WEB_TRAINER_CATALOG_ENABLED = defineBoolean("WEB_TRAINER_CATALOG_ENABLED", { default: false });

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

const calendarDate = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

/** Form applications have separate manual verification. Never weaken the
 * shared/mobile uploaded-evidence or account gates to accommodate this source. */
export function approvedFormWebTrainer(
  id: string, publicValue: unknown, privateValue: unknown, now = new Date(),
): CatalogTrainer | null {
  const published = record(publicValue);
  const application = record(privateValue);
  if (published.source !== "google_form" || published.applicationId !== id || published.trainerId !== id
    || published.published !== true || published.approvalStatus !== "approved"
    || application.status === "suspended"
    || !Number.isSafeInteger(published.profileVersion) || (published.profileVersion as number) <= 0
    || application.publishedVersion !== published.profileVersion
    || published.acceptingNewClients !== true
    || !calendarDate(published.verificationExpiresOn)
    || Date.parse(`${published.verificationExpiresOn}T23:59:59.999Z`) < now.getTime()
    || (published.availableFrom !== null && (!calendarDate(published.availableFrom)
      || Date.parse(`${published.availableFrom}T00:00:00.000Z`) > now.getTime()))) return null;
  const parsed = trainerSchema.safeParse(published.profile);
  if (!parsed.success || parsed.data.id !== id || parsed.data.isDemo === true
    || parsed.data.photo !== application.publishedPhotoPath
    || !parsed.data.photo.startsWith(`web-trainer-applications/${id}/revisions/`)) return null;
  const trainer = parsed.data;
  delete trainer.distanceMiles;
  return {
    trainer,
    profileVersion: published.profileVersion as number,
    ...(typeof published.gender === "string" && published.gender.length <= 160 ? { gender: published.gender } : {}),
  };
}

export async function loadWebTrainerCatalog(
  db: Firestore, ids?: readonly string[], uid?: string,
  includeFormApplications = WEB_TRAINER_CATALOG_ENABLED.value(),
) {
  if (ids?.length === 0) return [];
  const requestedIds = ids ? [...new Set(ids)] : undefined;
  const tooLarge = () => new HttpsError("resource-exhausted", "The trainer catalogue needs a larger matching run. Please try again later.");
  if (requestedIds && requestedIds.length > 500) throw tooLarge();
  const readSource = async (collection: string) => requestedIds
    ? (await Promise.all(requestedIds.map((id) => db.collection(collection).doc(id).get()))).filter((doc) => doc.exists)
    : (await db.collection(collection).where("published", "==", true).limit(501).get()).docs;
  // Apply the same synchronous bound across both sources. Do not silently
  // return a partial catalogue if either source has outgrown the MVP.
  const [legacy, forms] = await Promise.all([
    readSource("publicTrainers"),
    includeFormApplications ? readSource("webTrainerCatalog") : Promise.resolve([]),
  ]);
  if (legacy.length + forms.length > 500) throw tooLarge();
  const snapshots = [
    ...legacy.map((snapshot) => ({ snapshot, form: false })),
    ...forms.map((snapshot) => ({ snapshot, form: true })),
  ];
  const results: CatalogTrainer[] = [];
  for (let offset = 0; offset < snapshots.length; offset += 25) {
    const chunk = await Promise.all(snapshots.slice(offset, offset + 25).map(async ({ snapshot, form }) => {
      const [application, account, block] = await Promise.all([
        db.collection(form ? "webTrainerApplications" : "trainerProfiles").doc(snapshot.id).get(),
        form ? null : db.collection("accounts").doc(snapshot.id).get(),
        uid ? db.collection("blocks").doc([uid, snapshot.id].sort().join("_")).get() : null,
      ]);
      if (block?.exists) return null;
      return form ? approvedFormWebTrainer(snapshot.id, snapshot.data(), application.data())
        : approvedWebTrainer(snapshot.id, snapshot.data(), application.data(), account?.data());
    }));
    results.push(...chunk.filter((trainer): trainer is CatalogTrainer => trainer !== null));
  }
  // Stable form IDs are namespaced, but never allow two candidates with the
  // same identity into matching if historical/manual data violates that rule.
  if (new Set(results.map(({ trainer }) => trainer.id)).size !== results.length) {
    throw new HttpsError("failed-precondition", "The trainer catalogue contains a duplicate identity.");
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
