import { getStorage } from "firebase-admin/storage";
import { HttpsError } from "firebase-functions/v2/https";
import sharp from "sharp";
import type { CredentialSubmission, ProfileWorkspace, PublicDraft } from "../../../src/features/marketplace/model.js";
import type { Verification } from "../../../src/features/trainerApplications/model.js";
import { approvalIssues, verificationExpiry } from "../webTrainerApplicationDomain.js";
import { publicProfile } from "../webTrainerApplications.js";
import { hash, trainer, type Context } from "./core.js";

const bucket = () => getStorage().bucket(`${process.env.GCLOUD_PROJECT}.firebasestorage.app`);
async function immutableFile(path: string, bytes: Buffer, contentType: string) {
  try { await bucket().file(path).save(bytes, { resumable: false, contentType, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { cacheControl: "private, no-store", contentDisposition: "attachment" } }); }
  catch (error) { if ((error as { code?: number }).code !== 412) throw error; }
}
const photoUrl = async (path: string) => {
  if (process.env.FIRESTORE_EMULATOR_HOST) return path;
  return (await bucket().file(path).getSignedUrl({ action: "read", version: "v4", expires: Date.now() + 2 * 3600_000 }))[0];
};
export async function profile(ctx: Context): Promise<ProfileWorkspace> {
  const member = await trainer(ctx);
  const [w, c] = await Promise.all([ctx.db.collection("webTrainerWorkspaces").doc(member.trainerId).get(), ctx.db.collection("webTrainerCatalog").doc(member.trainerId).get()]);
  const workspace = w.data()!; const catalog = c.data()!;
  return { draft: workspace.draft, published: workspace.published, draftVersion: workspace.draftVersion, baseVersion: workspace.baseVersion, version: catalog.profileVersion,
    photoUrl: await photoUrl(workspace.publishedPhotoPath), draftPhotoUrl: await photoUrl(workspace.draftPhotoPath), qualifications: catalog.profile.qualifications, verificationExpiresOn: catalog.verificationExpiresOn };
}
export async function saveDraft(ctx: Context, draft: PublicDraft, expectedDraftVersion: number, baseVersion: number) {
  await ctx.db.runTransaction(async tx => {
    const member = await trainer(ctx, tx); const ref = ctx.db.collection("webTrainerWorkspaces").doc(member.trainerId);
    const [workspace, catalog] = await Promise.all([tx.get(ref), tx.get(ctx.db.collection("webTrainerCatalog").doc(member.trainerId))]);
    const w = workspace.data()!;
    if (w.draftVersion !== expectedDraftVersion || ![w.baseVersion, catalog.data()!.profileVersion].includes(baseVersion)) throw new HttpsError("aborted", "Your saved draft changed in another window. Your local edits have been kept; compare them with the latest version.");
    tx.update(ref, { draft, draftVersion: expectedDraftVersion + 1, baseVersion, updatedAt: ctx.now.toISOString() });
  }); return profile(ctx);
}
export async function publish(ctx: Context, expectedVersion: number, expectedDraftVersion: number) {
  await ctx.db.runTransaction(async tx => {
    const member = await trainer(ctx, tx); const id = member.trainerId;
    const wRef = ctx.db.collection("webTrainerWorkspaces").doc(id), cRef = ctx.db.collection("webTrainerCatalog").doc(id), aRef = ctx.db.collection("webTrainerApplications").doc(id);
    const [wSnap, cSnap, aSnap] = await Promise.all([tx.get(wRef), tx.get(cRef), tx.get(aRef)]);
    const w = wSnap.data()!, c = cSnap.data()!, a = aSnap.data()!;
    if (c.profileVersion !== expectedVersion || w.baseVersion !== expectedVersion || w.draftVersion !== expectedDraftVersion) throw new HttpsError("aborted", "The published profile changed. Your draft is safe. Compare it with the latest profile before publishing.");
    const draft = { ...w.draft, ...Object.fromEntries(["specialties", "coachingStyles", "venues", "availability"].map(key => [key, w.draft[key].filter((item: string) => item.trim())])), qualifications: c.profile.qualifications };
    // Public edits cannot alter the credential approval state. Validate public completeness separately.
    if (!draft.name || !draft.bio || !draft.specialties.length || !draft.area || !draft.venues.length || draft.singleSessionPence === null) throw new HttpsError("invalid-argument", "Add a name, bio, specialism, area, training setting and session price before publishing.");
    const nextVersion = expectedVersion + 1;
    const next = publicProfile(id, draft, w.draftPhotoPath);
    tx.update(cRef, { profile: next, profileVersion: nextVersion, acceptingNewClients: draft.acceptingNewClients, availableFrom: draft.availableFrom, gender: draft.gender, updatedAt: ctx.now.toISOString() });
    tx.update(aRef, { publishedVersion: nextVersion, publishedPhotoPath: w.draftPhotoPath, version: a.version + 1, updatedAt: ctx.now.toISOString() });
    tx.update(wRef, { published: w.draft, publishedPhotoPath: w.draftPhotoPath, baseVersion: nextVersion, updatedAt: ctx.now.toISOString() });
  }); return profile(ctx);
}
export async function capacity(ctx: Context, accepting: boolean, expectedVersion: number) {
  await ctx.db.runTransaction(async tx => {
    const member = await trainer(ctx, tx); const id = member.trainerId;
    const wRef = ctx.db.collection("webTrainerWorkspaces").doc(id), cRef = ctx.db.collection("webTrainerCatalog").doc(id), aRef = ctx.db.collection("webTrainerApplications").doc(id);
    const [w, c, a] = await Promise.all([tx.get(wRef), tx.get(cRef), tx.get(aRef)]);
    if (c.data()!.profileVersion !== expectedVersion) throw new HttpsError("aborted", "The profile changed. Refresh before changing availability.");
    tx.update(cRef, { acceptingNewClients: accepting, profileVersion: expectedVersion + 1, updatedAt: ctx.now.toISOString() });
    tx.update(aRef, { publishedVersion: expectedVersion + 1, version: a.data()!.version + 1, updatedAt: ctx.now.toISOString() });
    tx.update(wRef, { "published.acceptingNewClients": accepting, "draft.acceptingNewClients": accepting, draftVersion: w.data()!.draftVersion + 1,
      ...(w.data()!.baseVersion === expectedVersion ? { baseVersion: expectedVersion + 1 } : {}) });
  }); return profile(ctx);
}
function decode(base64: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new HttpsError("invalid-argument", "Invalid file encoding.");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 12) throw new HttpsError("invalid-argument", "Choose a file smaller than 5 MB.");
  return bytes;
}
async function processPhoto(bytes: Buffer) {
  const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false, failOn: "warning" });
  const meta = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new HttpsError("invalid-argument", "Use a JPEG, PNG or WebP image.");
  return image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
}
export async function uploadPhoto(ctx: Context, base64: string, expectedDraftVersion: number) {
  const member = await trainer(ctx); const bytes = await processPhoto(decode(base64));
  const path = `web-trainer-applications/${member.trainerId}/revisions/${ctx.now.getTime()}/profile-${hash(bytes)}.webp`;
  await immutableFile(path, bytes, "image/webp");
  await ctx.db.runTransaction(async tx => {
    await trainer(ctx, tx); const ref = ctx.db.collection("webTrainerWorkspaces").doc(member.trainerId); const w = (await tx.get(ref)).data()!;
    if (w.draftVersion !== expectedDraftVersion) throw new HttpsError("aborted", "Your draft changed while the photo uploaded. Try again with the latest draft.");
    tx.update(ref, { draftPhotoPath: path, draftVersion: expectedDraftVersion + 1 });
  }); return profile(ctx);
}
export async function submitCredentials(ctx: Context, input: { kind: "qualification" | "insurance"; title: string; provider: string; expiresOn: string | null; file: { name: string; base64: string }; requestId: string }) {
  const member = await trainer(ctx); const ref = ctx.db.collection("webTrainerCredentialChanges").doc(member.trainerId).collection("submissions").doc(input.requestId);
  if ((await ref.get()).exists) return { submitted: true };
  let bytes: Buffer = decode(input.file.base64); const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
  if (!pdf) bytes = await processPhoto(bytes);
  const path = `web-trainer-credentials/${member.trainerId}/${input.requestId}/${hash(bytes)}.${pdf ? "pdf" : "webp"}`;
  await immutableFile(path, bytes, pdf ? "application/pdf" : "image/webp");
  await ctx.db.runTransaction(async tx => {
    await trainer(ctx, tx); if ((await tx.get(ref)).exists) return;
    tx.create(ref, { id: input.requestId, kind: input.kind, title: input.title, provider: input.provider, expiresOn: input.expiresOn, path, status: "pending", createdAt: ctx.now.toISOString(), submittedBy: ctx.actor.uid });
  }); return { submitted: true };
}
export async function credentialList(ctx: Context, trainerId: string, reviewer = false): Promise<CredentialSubmission[]> {
  if (!reviewer && (await trainer(ctx)).trainerId !== trainerId) throw new HttpsError("permission-denied", "You cannot read these credentials.");
  const records = await ctx.db.collection("webTrainerCredentialChanges").doc(trainerId).collection("submissions").orderBy("createdAt", "desc").limit(100).get();
  return Promise.all(records.docs.map(async doc => { const d = doc.data(); return { id: doc.id, kind: d.kind, title: d.title, provider: d.provider, expiresOn: d.expiresOn, createdAt: d.createdAt, status: d.status, reason: d.reason ?? "", ...(reviewer ? { url: await photoUrl(d.path) } : {}) }; }));
}
export async function reviewCredential(ctx: Context, input: { trainerId: string; submissionId: string; approve: boolean; reason: string; verification: Verification; expectedVersion: number }) {
  await ctx.db.runTransaction(async tx => {
    const id = input.trainerId; const ref = ctx.db.collection("webTrainerCredentialChanges").doc(id).collection("submissions").doc(input.submissionId);
    const aRef = ctx.db.collection("webTrainerApplications").doc(id), cRef = ctx.db.collection("webTrainerCatalog").doc(id), wRef = ctx.db.collection("webTrainerWorkspaces").doc(id);
    const verifiedRef = ctx.db.collection("webTrainerVerifiedCredentials").doc(id);
    const [sub, app, cat, workspace, verified] = await Promise.all([tx.get(ref), tx.get(aRef), tx.get(cRef), tx.get(wRef), tx.get(verifiedRef)]);
    const s = sub.data(); const a = app.data(); const c = cat.data(); const w = workspace.data();
    if (!s || !a || !c || !w) throw new HttpsError("not-found", "This credential submission is unavailable.");
    if (s.status !== "pending") return;
    if (a.version !== input.expectedVersion) throw new HttpsError("aborted", "This application changed. Reload before reviewing the credentials.");
    if (input.approve) {
      if (!verified.exists) throw new HttpsError("failed-precondition", "Review the approved credential baseline before accepting replacements.");
      const verification = { ...verified.data()!.verification, [s.kind]: input.verification[s.kind as keyof Verification] } as Verification;
      const qualifications = s.kind === "qualification" ? [...new Set([...c.profile.qualifications, s.title])] : c.profile.qualifications;
      const draft = { ...w.published, qualifications };
      const issues = approvalIssues(draft, verification, Boolean(w.publishedPhotoPath), ctx.now);
      if (issues.length) throw new HttpsError("failed-precondition", "Complete the replacement credential checks before approval.", { issues });
      const version = c.profileVersion + 1;
      // Suspension is explicit; reviewing evidence never silently restores suspended access.
      const restore = c.suspensionReason === "verification_expired";
      tx.update(cRef, { profile: { ...c.profile, qualifications }, profileVersion: version, verificationExpiresOn: verificationExpiry(verification), updatedAt: ctx.now.toISOString(), ...(restore ? { published: true, approvalStatus: "approved", suspensionReason: null } : {}) });
      tx.update(aRef, { verification, "draft.qualifications": qualifications, publishedVersion: version, version: a.version + 1, updatedAt: ctx.now.toISOString(), ...(restore ? { status: "approved" } : {}) });
      tx.set(verifiedRef, { verification, qualifications });
    }
    tx.update(ref, { status: input.approve ? "approved" : "rejected", reason: input.reason, reviewedBy: ctx.actor.uid, reviewedAt: ctx.now.toISOString() });
  }); return { reviewed: true };
}
