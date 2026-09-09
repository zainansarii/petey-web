import { createHmac, randomUUID } from "node:crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { importApplication, requireWebTrainerReviewer, reviewApplication, saveApplication, uploadWebTrainerApplicationPhotoV1, type StoredApplication } from "./webTrainerApplications.js";
import { signedMessage, type FormImport } from "./webTrainerApplicationDomain.js";
import type { CallableRequest } from "firebase-functions/v2/https";

const localEmulator = /^(?:127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "");
describe.skipIf(!localEmulator)("trainer application transactions against Firestore emulator", () => {
  const ids: string[] = [];
  const photoPaths: string[] = [];
  const now = new Date("2026-09-07T12:00:00.000Z");
  const payload = (): FormImport => ({ schemaVersion: 1, formId: "development-form", responseId: randomUUID(), observedAt: now.toISOString(), submittedAt: now.toISOString(), editUrl: "https://docs.google.com/forms/d/e/test/viewform?edit2=private", items: [], answers: { fullName: "Alex Example", email: "alex@example.com", bio: "Strength coaching", specialties: ["Strength"], coachingStyle: "Calm", venues: ["Online"], serviceAreas: "Online only", availability: "Monday evenings", acceptingClients: "Yes, now", sessionPrice: "65", sessionDuration: "60 minutes", qualification: "PT diploma" }, photo: { fileId: "photo-file", modifiedAt: now.toISOString(), size: 10, mimeType: "image/jpeg" } });
  beforeAll(() => { if (!getApps().length) initializeApp({ projectId: "demo-petey-rules" }); });
  afterEach(async () => { for (const path of photoPaths.splice(0)) await getStorage().bucket("demo-petey-rules.firebasestorage.app").file(path).delete({ ignoreNotFound: true }); vi.unstubAllEnvs(); for (const id of ids.splice(0)) { await getFirestore().recursiveDelete(getFirestore().collection("webTrainerApplications").doc(id)); await getFirestore().collection("webTrainerCatalog").doc(id).delete(); } });
  async function prepare(input = payload()) {
    const result = await importApplication(getFirestore(), input, now); ids.push(result.applicationId);
    const ref = getFirestore().collection("webTrainerApplications").doc(result.applicationId);
    return { input, result, ref, read: async () => (await ref.get()).data() as StoredApplication };
  }
  async function verifiedApplication() {
    const context = await prepare(); const app = await context.read();
    const verification = { ...app.verification, qualification: { checked: true, title: "PT diploma", provider: "Awarding body", expiresOn: null, reference: "PRIVATE qualification reference" }, insurance: { checked: true, provider: "PRIVATE insurer", expiresOn: "2027-01-01", reference: "PRIVATE insurance reference" } };
    await context.ref.update({ photo: { state: "ready", path: `web-trainer-applications/${context.result.applicationId}/revisions/1/profile-${"a".repeat(64)}.webp`, error: null, revision: 1 } });
    await saveApplication(getFirestore(), context.result.applicationId, app.version, app.draft, verification, "reviewer", now);
    return context;
  }
  async function photoRequest(id: string, body: Buffer, options: { signature?: string; revision?: string; file?: string } = {}) {
    const secret = "integration-test-secret-never-a-deployed-key";
    vi.stubEnv("WEB_TRAINER_FORM_SECRET", secret);
    vi.stubEnv("WEB_TRAINER_FORM_ID", "development-form");
    vi.stubEnv("WEB_TRAINER_IMPORT_ENABLED", "true");
    vi.stubEnv("GCLOUD_PROJECT", "demo-petey-rules");
    const timestamp = String(Date.now());
    const revision = options.revision ?? "1";
    const file = options.file ?? "photo-file";
    const headers: Record<string, string> = {
      "X-Petey-Timestamp": timestamp, "X-Petey-Application": id,
      "X-Petey-Revision": revision, "X-Petey-File": file,
      "X-Petey-Signature": options.signature ?? createHmac("sha256", secret)
        .update(signedMessage("photo", timestamp, body, id, revision, file)).digest("hex"),
    };
    const output = { status: 200, body: null as unknown };
    const request = { method: "POST", headers: {}, rawBody: body, get: (key: string) => headers[key] };
    const response = { status: (status: number) => { output.status = status; return response; }, json: (body: unknown) => { output.body = body; return response; } };
    await uploadWebTrainerApplicationPhotoV1(request as Parameters<typeof uploadWebTrainerApplicationPhotoV1>[0], response as unknown as Parameters<typeof uploadWebTrainerApplicationPhotoV1>[1]);
    return output;
  }
  it("does not mutate processing state for unsigned, stale-revision or wrong-file photo requests", async () => {
    const context = await prepare(); const before = await context.read();
    const body = Buffer.from("not-a-photo");
    expect((await photoRequest(context.result.applicationId, body, { signature: "invalid" })).status).toBe(403);
    expect((await photoRequest(context.result.applicationId, body, { revision: "2" })).status).toBe(409);
    expect((await photoRequest(context.result.applicationId, body, { file: "another-file" })).status).toBe(409);
    expect(await context.read()).toEqual(before);
  });
  it("records an actionable issue for an authenticated malformed image without changing original answers", async () => {
    const body = Buffer.from("malformed!");
    const input = payload(); input.photo!.size = body.length;
    const context = await prepare(input);
    const result = await photoRequest(context.result.applicationId, body);
    expect(result.status).toBe(500);
    const app = await context.read();
    expect(app.photo.state).toBe("error");
    expect(app.issues).toContain("The profile photo could not be processed. Reconciliation will retry the transfer. If the image is invalid, request a new application with a JPEG, PNG or WebP image under 10 MB; Google Forms cannot replace a submitted upload.");
    expect(app.source.answers).toEqual(input.answers);
    expect(JSON.stringify(result)).not.toContain("malformed!");
  });
  it.skipIf(!/^(?:http:\/\/)?(?:127\.0\.0\.1|localhost):\d+$/.test(process.env.STORAGE_EMULATOR_HOST ?? process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? ""))("recovers a failed photo transfer, sanitises private storage and keeps concurrent retries idempotent", async () => {
      const body = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } })
        .withMetadata({ exif: { IFD0: { Artist: "PRIVATE camera owner" } } }).png().toBuffer();
      const input = payload(); input.photo!.size = body.length; input.photo!.mimeType = "image/png";
      const context = await prepare(input);
      expect((await photoRequest(context.result.applicationId, Buffer.alloc(body.length))).status).toBe(500);
      const failed = await context.read(); expect(failed.photo.state).toBe("error");
      const transfers = await Promise.all([photoRequest(context.result.applicationId, body), photoRequest(context.result.applicationId, body)]);
      for (const result of transfers) expect(result).toMatchObject({ status: 200, body: { ready: true } });
      const ready = await context.read(); photoPaths.push(ready.photo.path!);
      expect(ready.version).toBe(failed.version + 1);
      expect(ready.photo.state).toBe("ready"); expect(ready.photo.error).toBeNull();
      expect(ready.issues).not.toContain(failed.photo.error);
      expect(ready.photo.path).toMatch(new RegExp(`^web-trainer-applications/${context.result.applicationId}/revisions/1/profile-[a-f0-9]{64}\\.webp$`));
      const file = getStorage().bucket("demo-petey-rules.firebasestorage.app").file(ready.photo.path!);
      const [bytes] = await file.download(); const metadata = await sharp(bytes).metadata();
      expect(metadata.format).toBe("webp"); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
      expect((await file.getMetadata())[0]).not.toHaveProperty("metadata.firebaseStorageDownloadTokens");
      expect((await photoRequest(context.result.applicationId, body)).status).toBe(200);
      expect((await context.read()).version).toBe(ready.version);
    });
  it("imports once, preserves immutable raw revisions, and rejects stale sources", async () => {
    const context = await prepare(); const id = context.result.applicationId;
    await importApplication(getFirestore(), { ...context.input, observedAt: "2026-09-07T12:01:00.000Z" }, new Date("2026-09-07T12:01:00.000Z"));
    expect((await context.read()).sourceRevision).toBe(1);
    const changed = { ...context.input, observedAt: "2026-09-07T12:02:00.000Z", answers: { ...context.input.answers, bio: "Updated bio" } };
    await importApplication(getFirestore(), changed, new Date(changed.observedAt));
    const stale = await importApplication(getFirestore(), context.input, now);
    expect(stale.superseded).toBe(true); expect((await context.read()).draft.bio).toBe("Updated bio");
    expect((await context.ref.collection("revisions").doc("1").get()).data()?.source.answers.bio).toBe("Strength coaching");
    expect((await getFirestore().collection("webTrainerCatalog").doc(id).get()).exists).toBe(false);
  });
  it("cannot approve incomplete checks and refuses concurrent stale saves", async () => {
    const context = await prepare(); const app = await context.read();
    await expect(reviewApplication(getFirestore(), { applicationId: context.result.applicationId, expectedVersion: app.version, decision: "approve", requestId: randomUUID() }, "reviewer", now)).rejects.toMatchObject({ code: "failed-precondition" });
    await saveApplication(getFirestore(), context.result.applicationId, app.version, app.draft, app.verification, "reviewer", now);
    await expect(saveApplication(getFirestore(), context.result.applicationId, app.version, app.draft, app.verification, "reviewer", now)).rejects.toMatchObject({ code: "aborted" });
  });
  it("publishes atomically without private fields or undefined values and makes retry repeat-safe", async () => {
    const context = await verifiedApplication(); const app = await context.read();
    const input = { applicationId: context.result.applicationId, expectedVersion: app.version, decision: "approve" as const, requestId: randomUUID() };
    await reviewApplication(getFirestore(), input, "reviewer", now); await reviewApplication(getFirestore(), input, "reviewer", now);
    const published = (await getFirestore().collection("webTrainerCatalog").doc(context.result.applicationId).get()).data()!;
    expect(published.profile.price).toBe(65); expect(published.profile.professionalUrl).toBeUndefined();
    expect(JSON.stringify(published)).not.toMatch(/alex@example|PRIVATE|edit2/);
    expect((await context.read()).publishedVersion).toBe(published.profileVersion);
    expect((await context.ref.collection("history").where("action", "==", "approve").get()).size).toBe(1);
  });
  it("keeps published data on pending edits, suspends immediately and requires explicit reapproval", async () => {
    const context = await verifiedApplication(); let app = await context.read();
    await reviewApplication(getFirestore(), { applicationId: context.result.applicationId, expectedVersion: app.version, decision: "approve", requestId: randomUUID() }, "reviewer", now);
    const catalogRef = getFirestore().collection("webTrainerCatalog").doc(context.result.applicationId);
    const published = (await catalogRef.get()).data()!;
    await importApplication(getFirestore(), { ...context.input, observedAt: "2026-09-07T12:03:00.000Z", answers: { ...context.input.answers, bio: "Pending replacement" } }, new Date("2026-09-07T12:03:00.000Z"));
    app = await context.read(); expect(app.status).toBe("pending_review"); expect(app.publishedVersion).toBe(published.profileVersion);
    expect((await catalogRef.get()).data()?.profile.bio).toBe("Strength coaching");
    await reviewApplication(getFirestore(), { applicationId: context.result.applicationId, expectedVersion: app.version, decision: "suspend", reason: "Check required", requestId: randomUUID() }, "reviewer", now);
    expect((await catalogRef.get()).data()?.published).toBe(false);
    await importApplication(getFirestore(), { ...context.input, observedAt: "2026-09-07T12:04:00.000Z" }, new Date("2026-09-07T12:04:00.000Z"));
    expect((await context.read()).status).toBe("suspended");
  });
  it("requires claim, Google identity, current session, attestations and active reviewer allowlist", async () => {
    const uid = `test-reviewer-${randomUUID()}`; const ref = getFirestore().collection("webTrainerReviewers").doc(uid);
    const request = { app: { appId: "test" }, auth: { uid, token: { webTrainerReviewer: true, email_verified: true, email: "reviewer@example.com", auth_time: now.getTime() / 1000, firebase: { sign_in_provider: "google.com" } } } } as unknown as CallableRequest;
    try {
      await expect(requireWebTrainerReviewer(getFirestore(), request, now.getTime())).rejects.toMatchObject({ code: "permission-denied" });
      await ref.set({ active: true, email: "reviewer@example.com", mfaPolicyAttested: true, individualAccountAttested: true });
      expect((await requireWebTrainerReviewer(getFirestore(), request, now.getTime())).uid).toBe(uid);
      for (const token of [
        { ...request.auth!.token, webTrainerReviewer: false },
        { ...request.auth!.token, email_verified: false },
        { ...request.auth!.token, email: "different@example.com" },
        { ...request.auth!.token, firebase: { sign_in_provider: "password" } },
      ]) await expect(requireWebTrainerReviewer(getFirestore(), { ...request, auth: { uid, token } } as CallableRequest, now.getTime())).rejects.toMatchObject({ code: "permission-denied" });
      await expect(requireWebTrainerReviewer(getFirestore(), { ...request, app: undefined }, now.getTime())).rejects.toMatchObject({ code: "unauthenticated" });
      for (const key of ["mfaPolicyAttested", "individualAccountAttested"]) {
        await ref.update({ [key]: false });
        await expect(requireWebTrainerReviewer(getFirestore(), request, now.getTime())).rejects.toMatchObject({ code: "permission-denied" });
        await ref.update({ [key]: true });
      }

      await expect(requireWebTrainerReviewer(getFirestore(), request, now.getTime() + 3600_000)).rejects.toMatchObject({ code: "unauthenticated" });
      await expect(requireWebTrainerReviewer(getFirestore(), { ...request, auth: undefined }, now.getTime())).rejects.toMatchObject({ code: "unauthenticated" });
      await ref.update({ active: false }); await expect(requireWebTrainerReviewer(getFirestore(), request, now.getTime())).rejects.toMatchObject({ code: "permission-denied" });
    } finally { await ref.delete(); }
  });
});
