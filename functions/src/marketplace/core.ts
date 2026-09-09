import { createHash } from "node:crypto";
import { type Firestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { EmailPreferences, InboxItem, LeadTracking, Membership, SharedSummary } from "../../../src/features/marketplace/model.js";
import { approvedFormWebTrainer } from "../webTrainerCatalog.js";
import { readSavedMatching } from "../webMatching.js";

export interface Actor { uid: string; email: string }
export interface Context { db: Firestore; actor: Actor; now: Date; pilotEnabled: boolean; siteUrl: string }
export const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const pairId = (traineeId: string, trainerId: string) => hash(JSON.stringify([traineeId, trainerId]));
export const defaults: EmailPreferences = { enquiries: true, messages: true };
export const emptyTracking: LeadTracking = { notes: "", followUp: null, outcome: "open", version: 0 };
export function fail(message = "You cannot access this conversation."): never { throw new HttpsError("permission-denied", message); }
export const requirePilot = (ctx: Context) => { if (!ctx.pilotEnabled) throw new HttpsError("unavailable", "New invitations and enquiries are paused. Existing conversations remain available."); };
export const userRef = (ctx: Context, uid = ctx.actor.uid) => ctx.db.collection("webMarketplaceUsers").doc(uid);
export const inboxRef = (ctx: Context, uid: string, id: string) => userRef(ctx, uid).collection("inbox").doc(id);
export const leadRef = (ctx: Context, id: string) => ctx.db.collection("webLeadTracking").doc(ctx.actor.uid).collection("leads").doc(id);
export interface Enquiry {
  id: string; traineeId: string; trainerUid: string; trainerId: string; traineeLabel: string; trainerName: string;
  summary: SharedSummary; tradeoffs: string[]; createdAt: string; latestAt: string;
  unlockedAt: string | null; firstReplyAt: string | null; withdrawnAt: string | null;
  blockedBy: string[]; lastSeq: number;
}
export interface InboxRecord extends InboxItem { episode: string | null; alertedEpisode: string | null }
export const preview = (e: Enquiry): InboxRecord => ({
  id: e.id, trainerId: e.trainerId, trainerName: e.trainerName, traineeLabel: e.traineeLabel,
  summary: e.summary, createdAt: e.createdAt, latestAt: e.latestAt, unlockedAt: e.unlockedAt,
  firstReplyAt: e.firstReplyAt, withdrawnAt: e.withdrawnAt, blocked: e.blockedBy.length > 0,
  lastSeq: e.lastSeq, readSeq: 0, unreadCount: 0, episode: null, alertedEpisode: null,
});
export const participant = (ctx: Context, e: Enquiry) => {
  if (ctx.actor.uid !== e.traineeId && ctx.actor.uid !== e.trainerUid) fail();
  return ctx.actor.uid === e.trainerUid ? "trainer" as const : "trainee" as const;
};
// Re-read authority inside every write transaction so revocation cannot race a mutation.
export async function active(ctx: Context, tx?: Transaction): Promise<Membership | null> {
  const read = (path: string) => tx ? tx.get(ctx.db.doc(path)) : ctx.db.doc(path).get();
  const [user, membership] = await Promise.all([read(`webMarketplaceUsers/${ctx.actor.uid}`), read(`webTrainerMemberships/${ctx.actor.uid}`)]);
  if (user.data()?.active === false) fail("Your Petey access is unavailable.");
  const member = membership.exists ? membership.data() as Membership : null;
  if (member?.status === "revoked") fail("Your trainer access has been revoked.");
  return member;
}
export async function trainer(ctx: Context, tx?: Transaction) {
  const membership = await active(ctx, tx);
  if (!membership || membership.status !== "active") fail("An accepted trainer invitation is required.");
  return membership;
}
export async function eligible(ctx: Context, trainerId: string, tx?: Transaction) {
  const read = (path: string) => tx ? tx.get(ctx.db.doc(path)) : ctx.db.doc(path).get();
  const [catalog, application, pilot] = await Promise.all([
    read(`webTrainerCatalog/${trainerId}`), read(`webTrainerApplications/${trainerId}`), read(`webTrainerPilot/${trainerId}`),
  ]);
  const p = pilot.data();
  const candidate = approvedFormWebTrainer(trainerId, catalog.data() ?? {}, application.data() ?? {}, ctx.now);
  if (!candidate || !p?.enabled || !p.uid || p.status !== "accepted") throw new HttpsError("failed-precondition", "This trainer is not currently accepting new enquiries.");
  const [membership, user] = await Promise.all([read(`webTrainerMemberships/${p.uid}`), read(`webMarketplaceUsers/${p.uid}`)]);
  if (membership.data()?.status !== "active" || membership.data()?.trainerId !== trainerId || user.data()?.active !== true) fail("This trainer is unavailable.");
  return { candidate, trainerUid: p.uid as string };
}
export async function matchFor(ctx: Context, trainerId: string, tx?: Transaction) {
  const ref = ctx.db.collection("webClientProfiles").doc(ctx.actor.uid);
  const profile = (tx ? await tx.get(ref) : await ref.get()).data();
  const matching = profile && readSavedMatching(profile.matching, profile.profileMarkdown);
  const match = matching?.matches.find((item) => item.trainerId === trainerId);
  if (!match) fail("Choose a trainer from your saved matches.");
  return { match, profile: profile! };
}
export async function ownedEnquiry(ctx: Context, id: string, tx?: Transaction) {
  await active(ctx, tx);
  const ref = ctx.db.collection("webEnquiries").doc(id);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "This enquiry is unavailable.");
  const enquiry = snap.data() as Enquiry;
  const role = participant(ctx, enquiry);
  return { ref, enquiry, role };
}
export const contactable = (e: Enquiry) => {
  if (e.withdrawnAt || e.blockedBy.length) throw new HttpsError("failed-precondition", "This enquiry no longer accepts messages or unlocks.");
};
export function enqueue(ctx: Context, tx: Transaction, id: string, data: Record<string, unknown>, delay = 0) {
  tx.create(ctx.db.collection("webNotificationQueue").doc(id), {
    ...data, status: "pending", attempts: 0, createdAt: ctx.now.toISOString(), dueAt: new Date(ctx.now.getTime() + delay).toISOString(),
  });
}
