import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { marketplaceRequestSchema, type InboxItem, type SharedSummary, type Unlock } from "../../../src/features/marketplace/model.js";
import { publicDraftSchema } from "../../../src/features/marketplace/model.js";
import { matchingProfileHash } from "../webMatching.js";
import { importApplication, reviewApplication, saveApplication, type StoredApplication } from "../webTrainerApplications.js";
import type { FormImport } from "../webTrainerApplicationDomain.js";
import { invite, redeem, revoke, access } from "./access.js";
import { acknowledge, aggregate, block, dashboard, detail, enquire, inbox, messages, preferences, send, tracking, unlock, withdraw } from "./enquiries.js";
import { cleanupMarketplaceAccount } from "../webMarketplace.js";
import { capacity, publish, saveDraft, reviewCredential } from "./profile.js";
import { processNotifications } from "./notifications.js";
import { hash, type Context } from "./core.js";
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({ file: () => ({ getSignedUrl: async () => ["https://example.com/photo.webp"] }) }) }) }));

const summary: SharedSummary = { goals: "Build strength for hiking", area: "North London", settings: "Online", budget: "£70", availability: "Weekday evenings", frequency: "Twice a week", goalCategory: "Strength" };
const now = new Date("2026-09-09T12:00:00Z");
describe("marketplace contracts and cohort semantics", () => {
  it("rejects credential and payment fields in public writes", () => {
    expect(marketplaceRequestSchema.safeParse({ action: "unlock", enquiryId: "id", amountPence: 0 }).success).toBe(false);
    expect(marketplaceRequestSchema.safeParse({ action: "enquire", trainerId: "id", introduction: "Hello trainer", summary: { ...summary, medicalHistory: "private" } }).success).toBe(false);
  });
  it("keeps old action queues outside date filters and uses the received-date cohort denominator", () => {
    const item = (id: string, createdAt: string, unlockedAt: string | null): InboxItem => ({ id, trainerId: "trainer", trainerName: "Alex", traineeLabel: "Sam E.", summary, createdAt, latestAt: createdAt, unlockedAt, firstReplyAt: null, withdrawnAt: null, blocked: false, unreadCount: 0, lastSeq: 0, readSeq: 0 });
    const records = [item("old", "2025-01-01T00:00:00Z", null), item("a", "2026-09-03T00:00:00Z", now.toISOString()), item("b", now.toISOString(), null)];
    const leads = new Map([["a", { notes: "", followUp: "2026-09-10", outcome: "started" as const, version: 1 }], ["old", { notes: "", followUp: "2026-01-01", outcome: "open" as const, version: 1 }]]);
    const data = aggregate(records, leads, [], 7, now);
    expect(data.queues).toEqual({ new: 2, reply: 0, followUp: 1 });
    expect(data.cohort).toEqual({ received: 2, unlocked: 1, started: 1, conversion: 1 });
    expect(aggregate([], new Map(), [], 7, now).cohort.conversion).toBeNull();
  });
});

const emulator = /^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "");
describe.skipIf(!emulator)("web pilot transactions and privacy", () => {
  const db = getFirestore(initializeApp({ projectId: "demo-petey-marketplace" }, `marketplace-${randomUUID()}`));
  const ctx = (uid: string, email = `${uid}@example.com`, date = now): Context => ({ db, actor: { uid, email }, now: date, pilotEnabled: true, siteUrl: "https://example.com/petey-web" });
  const reviewer = ctx("reviewer");
  const makeProfile = (): FormImport => ({ schemaVersion: 1, formId: "pilot-form", responseId: randomUUID(), observedAt: now.toISOString(), submittedAt: now.toISOString(), editUrl: "https://docs.google.com/forms/d/e/test/viewform?edit2=private", items: [], answers: { fullName: "Alex Trainer", email: "trainer@example.com", bio: "Strength coaching", specialties: ["Strength"], coachingStyle: "Calm", venues: ["Online"], serviceAreas: "North London", availability: "Monday evenings", acceptingClients: "Yes, now", sessionPrice: "65", sessionDuration: "60 minutes", qualification: "PT diploma" }, photo: { fileId: "photo-file", modifiedAt: now.toISOString(), size: 10, mimeType: "image/jpeg" } });
  async function seed() {
    const form = makeProfile(); const result = await importApplication(db, form, now); const id = result.applicationId;
    const ref = db.collection("webTrainerApplications").doc(id); let app = (await ref.get()).data() as StoredApplication;
    const verification = { ...app.verification, qualification: { checked: true, title: "PT diploma", provider: "Body", expiresOn: null, reference: "Checked evidence" }, insurance: { checked: true, provider: "Insurer", expiresOn: "2027-12-31", reference: "Checked policy" } };
    await ref.update({ photo: { state: "ready", path: `web-trainer-applications/${id}/revisions/1/profile-${"a".repeat(64)}.webp`, error: null, revision: 1 } });
    await saveApplication(db, id, app.version, app.draft, verification, reviewer.actor.uid, now); app = (await ref.get()).data() as StoredApplication;
    await reviewApplication(db, { applicationId: id, expectedVersion: app.version, decision: "approve", requestId: randomUUID() }, reviewer.actor.uid, now);
    const trainer = ctx(`trainer_${randomUUID()}`, "trainer@example.com"); const client = ctx(`client_${randomUUID()}`);
    return { id, ref, form, trainer, client, verification };
  }
  async function tokenFor(trainerId: string, requestId = randomUUID()) {
    await invite(reviewer, trainerId, requestId); const pilot = (await db.collection("webTrainerPilot").doc(trainerId).get()).data()!;
    const queue = (await db.collection("webNotificationQueue").doc(`invite_${pilot.invitationHash}`).get()).data()!;
    return new URL(queue.link).searchParams.get("invite")!;
  }
  async function matched(s: Awaited<ReturnType<typeof seed>>) {
    const token = await tokenFor(s.id); await redeem(s.trainer, token);
    const markdown = "Goal: strength. Training online. PRIVATE internal note.";
    const catalog = (await db.collection("webTrainerCatalog").doc(s.id).get()).data()!;
    await db.collection("webClientProfiles").doc(s.client.actor.uid).set({ identity: { fullName: "Samantha Example", email: s.client.actor.email }, profileMarkdown: markdown,
      matching: { version: 2, profileHash: matchingProfileHash(markdown), catalogHash: "a".repeat(64), model: "fixture", evaluatedCount: 1, matchKind: "compatible", matches: [{ trainerId: s.id, score: 90, profileVersion: catalog.profileVersion, reason: "Fits", dealbreakers: { budget: "met", venue: "met", location: "met", availability: "met", trainerGender: "not_required", otherRequirements: "not_required" }, tradeoffs: ["PRIVATE matching note"] }] } });
    await access(s.client);
    return s;
  }
  beforeAll(async () => { await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-petey-marketplace/databases/(default)/documents`, { method: "DELETE" }); });
  afterAll(async () => { await db.terminate(); });
  it("rejects wrong email, expired, reused and replaced invitations", async () => {
    const s = await seed(); const first = await tokenFor(s.id);
    await expect(redeem(ctx("intruder"), first)).rejects.toMatchObject({ code: "permission-denied" });
    await expect(redeem({ ...s.trainer, now: new Date(now.getTime() + 7 * 86400_000) }, first)).rejects.toMatchObject({ code: "failed-precondition" });
    const second = await tokenFor(s.id); await expect(redeem(s.trainer, first)).rejects.toMatchObject({ code: "failed-precondition" });
    await redeem(s.trainer, second); await expect(redeem(s.trainer, second)).rejects.toMatchObject({ code: "failed-precondition" });
    expect((await access(s.trainer)).membership?.trainerId).toBe(s.id);
    await revoke(reviewer, s.id); await expect(access(s.trainer)).rejects.toMatchObject({ code: "permission-denied" });
    const unclaimed = await seed(); const revokedToken = await tokenFor(unclaimed.id); await revoke(reviewer, unclaimed.id);
    await expect(redeem(unclaimed.trainer, revokedToken)).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("keeps previews private and makes duplicate sends and unlocks idempotent", async () => {
    const s = await matched(await seed());
    const submissions = await Promise.all([enquire(s.client, s.id, summary, "A PRIVATE introduction"), enquire(s.client, s.id, summary, "A PRIVATE introduction")]);
    const id = submissions[0]!.enquiryId; expect(submissions[1]!.enquiryId).toBe(id);
    const locked = await detail(s.trainer, id); expect(locked.content).toBeNull(); expect(locked.traineeLabel).toBe("Samantha E."); expect(JSON.stringify(locked)).not.toMatch(/PRIVATE|Samantha Example/);
    await expect(detail(ctx("stranger"), id)).rejects.toMatchObject({ code: "permission-denied" });
    await expect(messages(s.trainer, id)).rejects.toMatchObject({ code: "permission-denied" });
    await Promise.all([unlock(s.trainer, id), unlock(s.trainer, id)]);
    expect((await detail(s.trainer, id)).content?.introduction).toBe("A PRIVATE introduction");
    const requestId = randomUUID(); const replies = await Promise.all([send(s.trainer, id, requestId, "Hello Sam"), send(s.trainer, id, requestId, "Hello Sam")]);
    expect(replies[0]!.id).toBe(replies[1]!.id); expect((await messages(s.client, id)).messages).toHaveLength(1);
    expect((await detail(s.client, id)).unreadCount).toBe(1);
    await acknowledge(s.client, id, 1); expect((await detail(s.client, id)).unreadCount).toBe(0);
    await send(s.client, id, randomUUID(), "Thanks!");
    await tracking(s.trainer, id, { notes: "PRIVATE trainer notes", outcome: "closed", followUp: "2026-09-01" }, 0);
    expect(JSON.stringify(await detail(s.client, id))).not.toContain("trainer notes");
    expect((await dashboard(s.trainer, 7)).queues.followUp).toBe(0);
    await tracking(s.trainer, id, { notes: "PRIVATE trainer notes", outcome: "open", followUp: "2026-09-01" }, 1);
    await unlock(s.trainer, id); const ledger = (await db.collection("webTrainerUnlocks").doc(id).get()).data() as Unlock;
    expect(ledger.amountPence).toBe(0); expect((await dashboard(s.trainer, 7)).unlocks).toHaveLength(1);
    await block(s.client, id); await expect(send(s.trainer, id, randomUUID(), "Blocked")).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("withdrawal wins before unlock and unavailable or unmatched trainers cannot receive enquiries", async () => {
    const s = await matched(await seed()); await expect(enquire(ctx("other"), s.id, summary, "Hello there")).rejects.toMatchObject({ code: "permission-denied" });
    const { enquiryId } = await enquire(s.client, s.id, summary, "Hello there"); await withdraw(s.client, enquiryId);
    await expect(unlock(s.trainer, enquiryId)).rejects.toMatchObject({ code: "failed-precondition" });
    const c = (await db.collection("webTrainerCatalog").doc(s.id).get()).data()!;
    await capacity(s.trainer, false, c.profileVersion);
    const client = { ...s.client, actor: { ...s.client.actor, uid: "new_client" } };
    await expect(enquire(client, s.id, summary, "Hello there")).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("previews the latest message, supports older inboxes and keeps locked introductions private", async () => {
    const s = await matched(await seed());
    const { enquiryId: id } = await enquire(s.client, s.id, summary, "PRIVATE introduction");
    expect(JSON.stringify(await inbox(s.client))).not.toContain("PRIVATE");
    expect(JSON.stringify(await inbox(s.trainer))).not.toContain("PRIVATE");
    await unlock(s.trainer, id);
    const firstRequest = randomUUID();
    await send(s.trainer, id, firstRequest, "Hello\n  Sam");
    expect((await inbox(s.client)).items[0]?.latestMessage).toBe("Hello Sam");
    expect((await inbox(s.trainer)).items[0]?.latestMessage).toBe("You: Hello Sam");
    await send(s.client, id, randomUUID(), "Thanks!");
    await send(s.trainer, id, firstRequest, "Hello\n  Sam");
    expect((await inbox(s.client)).items[0]?.latestMessage).toBe("You: Thanks!");
    const row = db.collection("webMarketplaceUsers").doc(s.client.actor.uid).collection("inbox").doc(id);
    await row.update({ latestMessage: FieldValue.delete() });
    expect((await inbox(s.client)).items[0]?.latestMessage).toBe("You: Thanks!");
    await send(s.trainer, id, randomUUID(), "👍".repeat(200));
    expect(Array.from((await inbox(s.client)).items[0]!.latestMessage!)).toHaveLength(181);
  });
  it("publishes public edits, detects conflicts and preserves edits across imports and credential reviews", async () => {
    const s = await matched(await seed()); let a = (await s.ref.get()).data() as StoredApplication;
    const old = publicDraftSchema.parse(Object.fromEntries(Object.entries(a.draft).filter(([key]) => key !== "qualifications"))); expect(publicDraftSchema.safeParse({ ...old, qualifications: [] }).success).toBe(false);
    const c = (await db.collection("webTrainerCatalog").doc(s.id).get()).data()!;
    await saveDraft(s.trainer, { ...old, bio: "Trainer-authored public bio" }, 0, c.profileVersion);
    const published = await publish(s.trainer, c.profileVersion, 1); expect(published.published.bio).toBe("Trainer-authored public bio");
    await expect(publish(s.trainer, c.profileVersion, 1)).rejects.toMatchObject({ code: "aborted" });
    await importApplication(db, { ...s.form, observedAt: "2026-09-09T12:01:00Z", answers: { ...s.form.answers, bio: "Older form bio" } }, new Date("2026-09-09T12:01:00Z"));
    a = (await s.ref.get()).data() as StoredApplication;
    await saveApplication(db, s.id, a.version, a.draft, s.verification, "reviewer", now); a = (await s.ref.get()).data() as StoredApplication;
    await reviewApplication(db, { applicationId: s.id, expectedVersion: a.version, decision: "approve", requestId: randomUUID() }, "reviewer", now);
    expect((await db.collection("webTrainerCatalog").doc(s.id).get()).data()!.profile.bio).toBe("Trainer-authored public bio");
    const submissionId = randomUUID(); await db.collection("webTrainerCredentialChanges").doc(s.id).collection("submissions").doc(submissionId).set({ status: "pending", kind: "insurance", title: "New policy" });
    a = (await s.ref.get()).data() as StoredApplication;
    await reviewCredential(reviewer, { trainerId: s.id, submissionId, approve: true, reason: "Verified", verification: { ...s.verification, insurance: { ...s.verification.insurance, expiresOn: "2028-01-01" } }, expectedVersion: a.version });
    expect((await db.collection("webTrainerCatalog").doc(s.id).get()).data()!.profile.bio).toBe("Trainer-authored public bio");
    expect((await db.collection("webTrainerCatalog").doc(s.id).get()).data()!.verificationExpiresOn).toBe("2028-01-01");
  });
  it("suppresses read/muted alerts and sends only once per unread episode with a stable retry key", async () => {
    const s = await matched(await seed()); const { enquiryId } = await enquire(s.client, s.id, summary, "Hello there"); await unlock(s.trainer, enquiryId);
    await send(s.trainer, enquiryId, randomUUID(), "Hello"); await send(s.trainer, enquiryId, randomUUID(), "Still one unread episode");
    const queue = await db.collection("webNotificationQueue").where("uid", "==", s.client.actor.uid).get(); expect(queue.size).toBe(1);
    const calls: string[] = []; const deliver = vi.fn(async (_mail, key: string) => { calls.push(key); return "receipt"; });
    await processNotifications(db, deliver, "https://example.com", new Date(now.getTime() + 119_000));
    expect(calls).not.toContain(`petey-${queue.docs[0]!.id}`);
    await acknowledge(s.client, enquiryId, 2);
    await processNotifications(db, deliver, "https://example.com", new Date(now.getTime() + 180_000)); expect((await queue.docs[0]!.ref.get()).data()!.status).toBe("suppressed");
    await send({ ...s.trainer, now: new Date(now.getTime() + 200_000) }, enquiryId, randomUUID(), "A new episode");
    const later = new Date(now.getTime() + 400_000); let fail = true; const retrying = vi.fn(async (_mail, key: string) => { calls.push(key); if (fail) { fail = false; throw new Error("uncertain response"); } return "receipt"; });
    await processNotifications(db, retrying, "https://example.com", later);
    await processNotifications(db, retrying, "https://example.com", new Date(later.getTime() + 180_000));
    const key = calls.at(-1)!; expect(calls.filter(value => value === key)).toHaveLength(2);
    await send(s.trainer, enquiryId, randomUUID(), "Same episode again");
    await processNotifications(db, retrying, "https://example.com", new Date(later.getTime() + 400_000)); expect(calls.filter(value => value === key)).toHaveLength(2);
    expect(hash("token")).toHaveLength(64);
  });
  it("honours email preferences without clearing in-app unread indicators", async () => {
    const s = await matched(await seed()); const { enquiryId } = await enquire(s.client, s.id, summary, "Hello there"); await unlock(s.trainer, enquiryId);
    await preferences(s.client, { enquiries: false, messages: false });
    await send(s.trainer, enquiryId, randomUUID(), "A muted alert");
    const queue = (await db.collection("webNotificationQueue").where("uid", "==", s.client.actor.uid).get()).docs[0]!;
    const deliver = vi.fn(async () => "receipt"); await processNotifications(db, deliver, "https://example.com", new Date(now.getTime() + 180_000));
    expect((await queue.ref.get()).data()!.status).toBe("suppressed"); expect((await detail(s.client, enquiryId)).unreadCount).toBe(1);
  });
  it("resumes account deletion after a storage failure without losing cleanup ownership", async () => {
    const s = await matched(await seed()); const { enquiryId } = await enquire(s.client, s.id, summary, "Private introduction"); await unlock(s.trainer, enquiryId);
    await tracking(s.trainer, enquiryId, { notes: "Private notes", outcome: "open", followUp: null }, 0);
    const deleteEvidence = vi.fn().mockRejectedValueOnce(new Error("Storage unavailable")).mockResolvedValue(undefined);
    await expect(cleanupMarketplaceAccount(s.trainer.actor.uid, db, deleteEvidence)).rejects.toThrow("Storage unavailable");
    expect((await db.collection("webTrainerMemberships").doc(s.trainer.actor.uid).get()).data()!.status).toBe("revoked");
    await cleanupMarketplaceAccount(s.trainer.actor.uid, db, deleteEvidence);
    expect(deleteEvidence).toHaveBeenNthCalledWith(2, s.id);
    expect((await db.collection("webEnquiryContent").doc(enquiryId).get()).exists).toBe(false);
    expect((await db.collection("webMarketplaceUsers").doc(s.client.actor.uid).collection("inbox").doc(enquiryId).get()).exists).toBe(false);
    expect((await db.collection("webMarketplaceDeletionJobs").doc(s.trainer.actor.uid).get()).data()!.status).toBe("complete");
    await importApplication(db, { ...s.form, observedAt: "2026-09-09T12:01:00Z" }, new Date("2026-09-09T12:01:00Z"));
    expect((await s.ref.get()).exists).toBe(false);
  });
});
