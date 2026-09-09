import { randomUUID } from "node:crypto";
import { getFirestore, type Firestore, type DocumentSnapshot } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { defineBoolean, defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall, onRequest, type CallableRequest, type Request } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import sharp from "sharp";
import { z } from "zod";
import { applicationStatuses, reviewDraftSchema, verificationSchema, type ApplicationDetail, type ApplicationSummary, type FormSyncHealth, type ReviewDraft, type ReviewEvent, type Verification } from "../../src/features/trainerApplications/model.js";
import { trainerSchema, type Trainer } from "../../src/features/discovery/model/trainer.js";
import { applicationIdFor, approvalIssues, canonicalJson, contentHashFor, digest, formImportSchema, mapApplication, MAX_PHOTO_BYTES, photoProblem, signedMessage, validSignature, verificationExpiry, type FormImport } from "./webTrainerApplicationDomain.js";

const REGION = "europe-west2";
const formSecret = defineSecret("WEB_TRAINER_FORM_SECRET");
const formId = defineString("WEB_TRAINER_FORM_ID", { default: "" });
const enabled = defineBoolean("WEB_TRAINER_IMPORT_ENABLED", { default: false });
const runtimeAccount = defineString("WEB_ONBOARDING_SERVICE_ACCOUNT_V3");
const adminOptions = { region: REGION, serviceAccount: runtimeAccount, enforceAppCheck: true };
const importOptions = { region: REGION, serviceAccount: runtimeAccount, secrets: [formSecret], timeoutSeconds: 120, memory: "512MiB" as const, maxInstances: 3, concurrency: 1 };
const appIdSchema = z.string().regex(/^form_[a-f0-9]{64}$/);
const expectedVersion = z.number().int().positive();
type Photo = { state: ApplicationSummary["photoState"]; path: string | null; error: string | null; revision: number };
export interface StoredApplication {
  trainerId: string; name: string; email: string; status: ApplicationSummary["status"];
  version: number; sourceRevision: number; publishedVersion: number | null; publishedPhotoPath: string | null;
  createdAt: string; updatedAt: string; issues: string[]; draft: ReviewDraft; verification: Verification;
  source: FormImport; contentHash: string; photo: Photo;
}
const summary = (id: string, value: StoredApplication): ApplicationSummary => ({ id, trainerId: value.trainerId,
  name: value.name, email: value.email, status: value.status, version: value.version,
  sourceRevision: value.sourceRevision, publishedVersion: value.publishedVersion,
  createdAt: value.createdAt, updatedAt: value.updatedAt, issues: value.issues, photoState: value.photo.state });
const load = (snapshot: DocumentSnapshot) => {
  if (!snapshot.exists) throw new HttpsError("not-found", "Application not found.");
  return snapshot.data() as StoredApplication;
};
const collection = (db: Firestore) => db.collection("webTrainerApplications");
const bucket = () => {
  const project = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new HttpsError("failed-precondition", "Trainer photo storage is not configured.");
  return getStorage().bucket(`${project}.firebasestorage.app`);
};
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpsError("invalid-argument", "Check the submitted fields.", { fields: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
  return result.data;
}
export async function requireWebTrainerReviewer(db: Firestore, request: Pick<CallableRequest, "auth" | "app">, now = Date.now()) {
  const auth = request.auth;
  if (!auth || !request.app) throw new HttpsError("unauthenticated", "Sign in to the reviewer workspace.");
  const token = auth.token;
  if (token.webTrainerReviewer !== true || token.email_verified !== true || token.firebase?.sign_in_provider !== "google.com") throw new HttpsError("permission-denied", "Reviewer access is required.");
  const authTime = Number(token.auth_time) * 1000;
  if (!Number.isFinite(authTime) || authTime > now + 300_000 || now - authTime >= 3_600_000) throw new HttpsError("unauthenticated", "Sign in again to continue reviewing applications.");
  const reviewer = (await db.collection("webTrainerReviewers").doc(auth.uid).get()).data();
  if (reviewer?.active !== true || reviewer.mfaPolicyAttested !== true || reviewer.individualAccountAttested !== true
    || typeof token.email !== "string" || reviewer.email?.toLowerCase() !== token.email.toLowerCase()) throw new HttpsError("permission-denied", "Your reviewer access is unavailable.");
  return { uid: auth.uid, email: token.email };
}
export async function importApplication(db: Firestore, input: FormImport, now = new Date()) {
  if (Date.parse(input.observedAt) > now.getTime() + 300_000) throw new HttpsError("invalid-argument", "Source observation time is invalid.");
  const id = applicationIdFor(input.formId, input.responseId);
  const ref = collection(db).doc(id);
  const contentHash = contentHashFor(input);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const old = snapshot.exists ? snapshot.data() as StoredApplication : null;
    if (old && Date.parse(input.observedAt) < Date.parse(old.source.observedAt)) {
      return { applicationId: id, revision: old.sourceRevision, contentHash: old.contentHash, photoNeeded: false, superseded: true };
    }
    if (old?.contentHash === contentHash) {
      // Advance the observation watermark even for an unchanged response so an old retry cannot undo a later edit/reversion.
      tx.update(ref, { "source.observedAt": input.observedAt, "source.editUrl": input.editUrl });
      return { applicationId: id, revision: old.sourceRevision, contentHash, photoNeeded: old.photo.state !== "ready" && !photoProblem(input.photo) };
    }
    if (old && Date.parse(input.observedAt) === Date.parse(old.source.observedAt)) throw new HttpsError("aborted", "Re-read the latest form response before retrying.");
    const revision = (old?.sourceRevision ?? 0) + 1;
    const mapped = mapApplication(input);
    const problem = photoProblem(input.photo);
    const samePhoto = old && canonicalJson(old.source.photo) === canonicalJson(input.photo) && old.photo.state === "ready";
    const photo: Photo = samePhoto ? old.photo : { state: !input.photo ? "missing" : problem ? "error" : "pending", path: null, error: problem, revision };
    const stored: StoredApplication = {
      trainerId: id, name: mapped.draft.name, email: mapped.email,
      status: old?.status === "suspended" ? "suspended" : "pending_review",
      version: (old?.version ?? 0) + 1, sourceRevision: revision, publishedVersion: old?.publishedVersion ?? null,
      publishedPhotoPath: old?.publishedPhotoPath ?? null, createdAt: old?.createdAt ?? now.toISOString(), updatedAt: now.toISOString(),
      source: input, contentHash, draft: mapped.draft, verification: mapped.verification, photo,
      issues: [...mapped.issues, ...(problem ? [problem] : [])],
    };
    tx.create(ref.collection("revisions").doc(String(revision)), { source: input, contentHash, receivedAt: now.toISOString(), sourceRevision: revision });
    tx.set(ref, stored);
    tx.create(ref.collection("history").doc(`import_${revision}`), { action: "import", reviewerUid: "form-import", at: now.toISOString(), version: stored.version, reason: null });
    return { applicationId: id, revision, contentHash, photoNeeded: photo.state !== "ready" && !problem };
  });
}
async function detail(db: Firestore, id: string): Promise<ApplicationDetail> {
  const value = load(await collection(db).doc(id).get());
  const [events, duplicates] = await Promise.all([
    collection(db).doc(id).collection("history").orderBy("at", "desc").limit(100).get(),
    value.email ? collection(db).where("email", "==", value.email).limit(20).get() : Promise.resolve(null),
  ]);
  let url: string | null = null;
  if (value.photo.state === "ready" && value.photo.path) {
    [url] = await bucket().file(value.photo.path).getSignedUrl({ action: "read", version: "v4", expires: Date.now() + 5 * 60_000 });
  }
  return { application: summary(id, value), source: { formId: value.source.formId, responseId: value.source.responseId, submittedAt: value.source.submittedAt, observedAt: value.source.observedAt, editUrl: value.source.editUrl },
    originalAnswers: value.source.answers, draft: value.draft, verification: value.verification,
    photo: { ...value.photo, url }, issues: value.issues,
    history: events.docs.map((entry) => ({ ...entry.data(), id: entry.id }) as ReviewEvent),
    duplicateApplications: duplicates?.docs.filter((entry) => entry.id !== id).map((entry) => summary(entry.id, entry.data() as StoredApplication)) ?? [] };
}
export async function saveApplication(db: Firestore, id: string, version: number, draft: ReviewDraft, verification: Verification, uid: string, now = new Date()) {
  const ref = collection(db).doc(id);
  const eventId = randomUUID();
  await db.runTransaction(async (tx) => {
    const current = load(await tx.get(ref));
    if (current.version !== version) throw new HttpsError("aborted", "This application changed. Reload it before saving.");
    const next = version + 1;
    tx.update(ref, { draft, verification, name: draft.name, version: next, updatedAt: now.toISOString(), issues: current.photo.error ? [current.photo.error] : [] });
    tx.create(ref.collection("history").doc(eventId), { action: "save_draft", reviewerUid: uid, at: now.toISOString(), version: next, reason: null, draft, verification });
  });
}
export function publicProfile(id: string, draft: ReviewDraft, photoPath: string): Trainer {
  const shortStyles = draft.coachingStyles.filter((value) => value.length <= 160);
  const shortTimes = draft.availability.filter((value) => value.length <= 160);
  return trainerSchema.parse({ id, name: draft.name, photo: photoPath, specialty: draft.specialties[0], specialties: draft.specialties.slice(1),
    area: draft.area, price: draft.singleSessionPence! / 100,
    tenPackPrice: draft.tenPackPence === null ? null : draft.tenPackPence / 100,
    monthlyPrice: draft.monthlyCoachingPence === null ? null : draft.monthlyCoachingPence / 100,
    coachingStyles: shortStyles, availability: shortTimes, venues: draft.venues, qualifications: draft.qualifications, bio: draft.bio,
    sessionDurationMinutes: draft.sessionDurationMinutes, pricingNotes: draft.pricingNotes, serviceAreaNotes: draft.serviceAreaNotes,
    experience: draft.experience, ...(draft.professionalUrl ? { professionalUrl: draft.professionalUrl } : {}),
    availabilityNotes: draft.availability.filter((value) => value.length > 160).join("\n"),
    coachingStyleNotes: draft.coachingStyles.filter((value) => value.length > 160).join("\n"),
  });
}
const reviewSchema = z.object({ applicationId: appIdSchema, expectedVersion, decision: z.enum(["approve", "needs_changes", "reject", "suspend"]), reason: z.string().trim().max(2_000).optional(), requestId: z.uuid() }).strict();
type ReviewInput = z.infer<typeof reviewSchema>;
export async function reviewApplication(db: Firestore, input: ReviewInput, uid: string, now = new Date()) {
  const ref = collection(db).doc(input.applicationId);
  const eventRef = ref.collection("history").doc(input.requestId);
  await db.runTransaction(async (tx) => {
    const [appSnapshot, eventSnapshot] = await Promise.all([tx.get(ref), tx.get(eventRef)]);
    if (eventSnapshot.exists) {
      const old = eventSnapshot.data()!;
      if (old.reviewerUid !== uid || old.requestHash !== digest(canonicalJson(input))) throw new HttpsError("already-exists", "This decision request has already been used.");
      return;
    }
    const app = load(appSnapshot);
    if (app.version !== input.expectedVersion) throw new HttpsError("aborted", "This application changed. Reload it before deciding.");
    if (input.decision !== "approve" && !input.reason?.trim()) throw new HttpsError("invalid-argument", "Add a reason for this decision.");
    const version = app.version + 1;
    const timestamp = now.toISOString();
    const catalogue = db.collection("webTrainerCatalog").doc(app.trainerId);
    if (input.decision === "approve") {
      const issues = approvalIssues(app.draft, app.verification, app.photo.state === "ready" && Boolean(app.photo.path), now);
      if (app.draft.acceptingNewClients && /future/i.test(String(app.source.answers.acceptingClients ?? "")) && !app.draft.availableFrom) issues.push("Confirm the future start date before making this trainer available.");
      if (!z.email().safeParse(app.email).success) issues.push("The applicant needs to correct their contact email in the form.");
      if (issues.length) throw new HttpsError("failed-precondition", "Complete the profile and verification checks before approving.", { issues });
      const profile = publicProfile(app.trainerId, app.draft, app.photo.path!);
      tx.set(catalogue, { source: "google_form", applicationId: input.applicationId, trainerId: app.trainerId,
        published: true, approvalStatus: "approved", profileVersion: version, profile,
        ...(app.draft.gender ? { gender: app.draft.gender } : {}),
        acceptingNewClients: app.draft.acceptingNewClients, availableFrom: app.draft.availableFrom,
        verificationExpiresOn: verificationExpiry(app.verification), approvedAt: timestamp, updatedAt: timestamp });
      tx.update(ref, { status: "approved", version, publishedVersion: version, publishedPhotoPath: app.photo.path, updatedAt: timestamp, issues: [] });
    } else if (input.decision === "suspend") {
      tx.set(catalogue, { published: false, approvalStatus: "suspended", updatedAt: timestamp }, { merge: true });
      tx.update(ref, { status: "suspended", version, updatedAt: timestamp });
    } else {
      tx.update(ref, { status: input.decision === "reject" ? "rejected" : "needs_changes", version, updatedAt: timestamp });
    }
    tx.create(eventRef, { action: input.decision, reviewerUid: uid, at: timestamp, version, reason: input.reason?.trim() || null,
      requestHash: digest(canonicalJson(input)), reviewedSourceRevision: app.sourceRevision,
      ...(input.decision === "approve" ? { approvedDraft: app.draft, verification: app.verification, verifiedAt: timestamp, photoPath: app.photo.path } : {}) });
  });
}
function authenticateImport(req: Request, kind: "import" | "photo" | "sync") {
  if (!enabled.value() || !formId.value()) throw new HttpsError("unavailable", "Form import is disabled.");
  if (req.method !== "POST") throw new HttpsError("invalid-argument", "Use POST.");
  const raw = req.rawBody;
  const limit = kind === "photo" ? MAX_PHOTO_BYTES : 256 * 1024;
  if (!raw || raw.length > limit) throw new HttpsError("invalid-argument", "Request is too large.");
  const timestamp = req.get("X-Petey-Timestamp") ?? "";
  const application = req.get("X-Petey-Application") ?? "";
  const revision = req.get("X-Petey-Revision") ?? "";
  const file = req.get("X-Petey-File") ?? "";
  if (kind !== "photo" && (application || revision || file)) throw new HttpsError("invalid-argument", "Unexpected transfer headers.");
  if (!validSignature(formSecret.value(), req.get("X-Petey-Signature") ?? "", timestamp, signedMessage(kind, timestamp, raw, application, revision, file))) throw new HttpsError("permission-denied", "Invalid form signature.");
  return raw;
}
const httpError = (error: unknown) => {
  if (error instanceof HttpsError) return { status: ({ "permission-denied": 403, "unauthenticated": 401, "invalid-argument": 400, "not-found": 404, "aborted": 409, "already-exists": 409, "failed-precondition": 422, "unavailable": 503 } as Record<string, number>)[error.code] ?? 500, message: error.message };
  return { status: 500, message: "The import could not finish. Retry this form response." };
};
export const importWebTrainerApplicationV1 = onRequest(importOptions, async (req, res) => {
  try {
    const raw = authenticateImport(req, "import");
    const input = parse(formImportSchema, JSON.parse(raw.toString("utf8")));
    if (input.formId !== formId.value()) throw new HttpsError("permission-denied", "This form is not configured for this environment.");
    res.json(await importApplication(getFirestore(), input));
  } catch (error) { const result = httpError(error); res.status(result.status).json({ error: result.message }); }
});
export const uploadWebTrainerApplicationPhotoV1 = onRequest(importOptions, async (req, res) => {
  let id: string | null = null; let revision = 0;
  try {
    const raw = authenticateImport(req, "photo");
    id = parse(appIdSchema, req.get("X-Petey-Application"));
    revision = parse(expectedVersion, Number(req.get("X-Petey-Revision")));
    const ref = collection(getFirestore()).doc(id);
    const app = load(await ref.get());
    if (app.source.formId !== formId.value() || app.sourceRevision !== revision || app.source.photo?.fileId !== req.get("X-Petey-File")) throw new HttpsError("aborted", "This photo belongs to an older application. Re-read the form.");
    if (app.photo.state === "ready") { res.json({ ready: true }); return; }
    if (photoProblem(app.source.photo)) throw new HttpsError("failed-precondition", photoProblem(app.source.photo)!);
    if (raw.length !== app.source.photo?.size) throw new HttpsError("invalid-argument", "The photo size changed. Re-read the form.");
    const image = sharp(raw, { limitInputPixels: 40_000_000, animated: false, failOn: "warning" });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new HttpsError("invalid-argument", "Use a JPEG, PNG or WebP profile photo.");
    const processed = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const path = `web-trainer-applications/${id}/revisions/${revision}/profile-${digest(processed)}.webp`;
    try { await bucket().file(path).save(processed, { resumable: false, contentType: "image/webp", preconditionOpts: { ifGenerationMatch: 0 }, metadata: { cacheControl: "private, max-age=300" } }); }
    catch (error) { if ((error as { code?: number }).code !== 412) throw error; }
    await getFirestore().runTransaction(async (tx) => {
      const latest = load(await tx.get(ref));
      if (latest.sourceRevision !== revision || latest.source.photo?.fileId !== app.source.photo?.fileId) throw new HttpsError("aborted", "The application changed during photo processing.");
      if (latest.photo.state === "ready") {
        if (latest.photo.path !== path) throw new HttpsError("aborted", "A different photo has already finished processing.");
        return;
      }
      tx.update(ref, { photo: { state: "ready", path, error: null, revision }, version: latest.version + 1, updatedAt: new Date().toISOString(), issues: latest.issues.filter((issue) => issue !== latest.photo.error) });
    });
    res.json({ ready: true });
  } catch (error) {
    // Do not let an unsigned/invalid request mutate processing state.
    if (id && revision && !(error instanceof HttpsError && ["aborted", "permission-denied"].includes(error.code))) {
      const ref = collection(getFirestore()).doc(id);
      await getFirestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref); if (!snap.exists) return;
        const current = snap.data() as StoredApplication;
        if (current.sourceRevision !== revision || current.photo.state === "ready") return;
        const message = "The profile photo could not be processed. Reconciliation will retry the transfer. If the image is invalid, request a new application with a JPEG, PNG or WebP image under 10 MB; Google Forms cannot replace a submitted upload.";
        tx.update(ref, { "photo.state": "error", "photo.error": message, issues: [...new Set([...current.issues, message])], updatedAt: new Date().toISOString() });
      }).catch(() => undefined);
    }
    const result = httpError(error); res.status(result.status).json({ error: result.message });
  }
});
export const recordWebTrainerFormSyncV1 = onRequest(importOptions, async (req, res) => {
  try {
    const raw = authenticateImport(req, "sync");
    const input = parse(z.object({ formId: z.string(), success: z.boolean(), errorCount: z.number().int().nonnegative().max(100_000), message: z.string().max(200).optional() }).strict(), JSON.parse(raw.toString("utf8")));
    if (input.formId !== formId.value()) throw new HttpsError("permission-denied", "Form is not configured.");
    const now = new Date().toISOString();
    await getFirestore().collection("webTrainerFormSync").doc(digest(input.formId)).set({ lastAttemptAt: now, errorCount: input.errorCount, message: input.success ? null : "Some form responses need another sync attempt.", ...(input.success ? { lastSuccessfulSyncAt: now } : {}) }, { merge: true });
    res.json({ recorded: true });
  } catch (error) { const result = httpError(error); res.status(result.status).json({ error: result.message }); }
});
export const getWebTrainerReviewAccessV1 = onCall(adminOptions, async (request) => {
  const db = getFirestore(); const reviewer = await requireWebTrainerReviewer(db, request);
  const health = (await db.collection("webTrainerFormSync").doc(digest(formId.value())).get()).data();
  return { reviewer, health: { lastSuccessfulSyncAt: health?.lastSuccessfulSyncAt ?? null, lastAttemptAt: health?.lastAttemptAt ?? null, errorCount: health?.errorCount ?? 0, message: health?.message ?? null } satisfies FormSyncHealth };
});
export const listWebTrainerApplicationsV1 = onCall(adminOptions, async (request) => {
  const db = getFirestore(); await requireWebTrainerReviewer(db, request);
  const input = parse(z.object({ status: z.enum(applicationStatuses).optional(), cursor: z.string().max(500).optional() }).strict(), request.data ?? {});
  let query = input.status ? collection(db).where("status", "==", input.status).orderBy("updatedAt", "desc") : collection(db).orderBy("updatedAt", "desc");
  query = query.orderBy("__name__", "desc");
  if (input.cursor) {
    let cursor: unknown; try { cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString()); } catch { throw new HttpsError("invalid-argument", "Invalid page cursor."); }
    const parsed = parse(z.tuple([z.string().datetime(), appIdSchema]), cursor); query = query.startAfter(...parsed);
  }
  const rows = (await query.limit(26).get()).docs;
  const page = rows.slice(0, 25); const last = page.at(-1);
  return { applications: page.map((entry) => summary(entry.id, entry.data() as StoredApplication)), nextCursor: rows.length > 25 && last ? Buffer.from(JSON.stringify([last.data().updatedAt, last.id])).toString("base64url") : null };
});
export const getWebTrainerApplicationV1 = onCall(adminOptions, async (request) => {
  const db = getFirestore(); await requireWebTrainerReviewer(db, request);
  const input = parse(z.object({ applicationId: appIdSchema }).strict(), request.data); return detail(db, input.applicationId);
});
export const saveWebTrainerApplicationV1 = onCall(adminOptions, async (request) => {
  const db = getFirestore(); const reviewer = await requireWebTrainerReviewer(db, request);
  const input = parse(z.object({ applicationId: appIdSchema, expectedVersion, draft: reviewDraftSchema, verification: verificationSchema }).strict(), request.data);
  await saveApplication(db, input.applicationId, input.expectedVersion, input.draft, input.verification, reviewer.uid); return detail(db, input.applicationId);
});
export const reviewWebTrainerApplicationV1 = onCall(adminOptions, async (request) => {
  const db = getFirestore(); const reviewer = await requireWebTrainerReviewer(db, request);
  const input = parse(reviewSchema, request.data); await reviewApplication(db, input, reviewer.uid); return detail(db, input.applicationId);
});
export const expireWebTrainerVerificationsV1 = onSchedule({ schedule: "every day 00:05", timeZone: "Etc/UTC", region: REGION, serviceAccount: runtimeAccount }, async () => {
  const db = getFirestore(); const today = new Date().toISOString().slice(0, 10);
  const rows = await db.collection("webTrainerCatalog").where("published", "==", true).where("verificationExpiresOn", "<", today).limit(500).get();
  for (const row of rows.docs) await db.runTransaction(async (tx) => {
    const appRef = collection(db).doc(row.id);
    const [currentRow, appSnap] = await Promise.all([tx.get(row.ref), tx.get(appRef)]);
    const published = currentRow.data(); if (!published?.published || published.verificationExpiresOn >= today || !appSnap.exists) return;
    const app = load(appSnap); const now = new Date().toISOString();
    tx.update(row.ref, { published: false, approvalStatus: "suspended", updatedAt: now });
    tx.update(appRef, { status: "suspended", version: app.version + 1, updatedAt: now });
    tx.create(appRef.collection("history").doc(`expiry_${published.profileVersion}`), { action: "suspend", reviewerUid: "verification-expiry", at: now, version: app.version + 1, reason: "Verification expired." });
  });
});
