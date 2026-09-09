import { HttpsError } from "firebase-functions/v2/https";
import { MATCH_DEALBREAKER_LABELS, type MatchDealbreakers } from "../../../src/features/onboarding/model/onboardingContract.js";
import type { Dashboard, EnquiryDetail, InboxItem, InboxPage, LeadTracking, Message, MessagePage, SharedSummary, Unlock } from "../../../src/features/marketplace/model.js";
import { active, contactable, defaults, eligible, emptyTracking, enqueue, fail, hash, inboxRef, leadRef, matchFor, ownedEnquiry, pairId, preview, requirePilot, trainer, userRef, type Context, type Enquiry, type InboxRecord } from "./core.js";

const safeDifferences = (values: MatchDealbreakers) => Object.entries(values).flatMap(([key, value]) =>
  value === "not_met" || value === "unconfirmed" ? [`${MATCH_DEALBREAKER_LABELS[key as keyof MatchDealbreakers]} ${value === "not_met" ? "differs from your preferences" : "needs confirming"}.`] : []);
export async function prepare(ctx: Context, trainerId: string, summarize: (brief: string) => Promise<SharedSummary>) {
  requirePilot(ctx); await active(ctx);
  const { candidate } = await eligible(ctx, trainerId);
  const { profile, match } = await matchFor(ctx, trainerId);
  const existing = await ctx.db.collection("webEnquiries").doc(pairId(ctx.actor.uid, trainerId)).get();
  if (existing.exists) return { existingEnquiryId: existing.id };
  if (match.profileVersion !== candidate.profileVersion) throw new HttpsError("failed-precondition", "This trainer’s profile changed. Refresh your matches before sending an enquiry.");
  return { summary: await summarize(profile.profileMarkdown), tradeoffs: safeDifferences(match.dealbreakers) };
}
export async function enquire(ctx: Context, trainerId: string, summary: SharedSummary, introduction: string) {
  const id = pairId(ctx.actor.uid, trainerId); const ref = ctx.db.collection("webEnquiries").doc(id);
  await ctx.db.runTransaction(async (tx) => {
    const membership = await active(ctx, tx); if (membership) fail("Trainer accounts cannot send trainee enquiries.");
    if ((await tx.get(ref)).exists) return;
    requirePilot(ctx);
    const { candidate, trainerUid } = await eligible(ctx, trainerId, tx);
    const { profile, match } = await matchFor(ctx, trainerId, tx);
    if (match.profileVersion !== candidate.profileVersion) throw new HttpsError("failed-precondition", "This trainer’s profile changed. Refresh your matches before sending an enquiry.");
    if (trainerUid === ctx.actor.uid) fail();
    const fullName = String(profile.identity?.fullName ?? "").trim();
    if (!fullName || fullName.length > 160) throw new HttpsError("failed-precondition", "Complete your trainee profile before sending an enquiry.");
    const parts = fullName.split(/\s+/); const traineeLabel = `${parts[0]}${parts.length > 1 ? ` ${parts.at(-1)![0]}.` : ""}`;
    const e: Enquiry = { id, traineeId: ctx.actor.uid, trainerUid, trainerId, traineeLabel, trainerName: candidate.trainer.name,
      summary, tradeoffs: safeDifferences(match.dealbreakers), createdAt: ctx.now.toISOString(), latestAt: ctx.now.toISOString(),
      unlockedAt: null, firstReplyAt: null, withdrawnAt: null, blockedBy: [], lastSeq: 0 };
    tx.create(ref, e);
    tx.create(ctx.db.collection("webEnquiryContent").doc(id), { fullName, introduction });
    tx.set(userRef(ctx), { active: true, email: ctx.actor.email }, { merge: true });
    tx.create(inboxRef(ctx, ctx.actor.uid, id), preview(e));
    tx.create(inboxRef(ctx, trainerUid, id), { ...preview(e), outcome: "open" });
    enqueue(ctx, tx, `enquiry_${id}`, { kind: "enquiry", uid: trainerUid, enquiryId: id });
  });
  return { enquiryId: id };
}
export async function detail(ctx: Context, id: string): Promise<EnquiryDetail> {
  const { enquiry: e, role } = await ownedEnquiry(ctx, id);
  const [inbox, tracking, content] = await Promise.all([
    inboxRef(ctx, ctx.actor.uid, id).get(), role === "trainer" ? leadRef(ctx, id).get() : null,
    role === "trainee" || e.unlockedAt ? ctx.db.collection("webEnquiryContent").doc(id).get() : null,
  ]);
  return { ...(inbox.data() as InboxItem), role, tradeoffs: e.tradeoffs, content: content?.exists ? content.data() as EnquiryDetail["content"] : null, tracking: role === "trainer" ? (tracking?.data() as LeadTracking ?? emptyTracking) : null };
}
export async function unlock(ctx: Context, id: string) {
  await ctx.db.runTransaction(async (tx) => {
    const { ref, enquiry: e, role } = await ownedEnquiry(ctx, id, tx); if (role !== "trainer") fail();
    await trainer(ctx, tx);
    if (e.unlockedAt) return;
    contactable(e);
    const other = (await tx.get(userRef(ctx, e.traineeId))).data(); if (other?.active !== true) fail("This trainee is unavailable.");
    // Pilot access survives future price changes and never depends on lead outcome.
    const at = ctx.now.toISOString();
    tx.update(ref, { unlockedAt: at });
    tx.create(ctx.db.collection("webTrainerUnlocks").doc(id), { id, trainerUid: ctx.actor.uid, traineeLabel: e.traineeLabel, amountPence: 0, priceVersion: "free-pilot-v1", unlockedAt: at, receivedAt: e.createdAt });
    for (const uid of [e.traineeId, e.trainerUid]) tx.update(inboxRef(ctx, uid, id), { unlockedAt: at });
  });
  return detail(ctx, id);
}
export async function withdraw(ctx: Context, id: string) {
  await ctx.db.runTransaction(async (tx) => {
    const { ref, enquiry: e, role } = await ownedEnquiry(ctx, id, tx); if (role !== "trainee") fail();
    if (e.unlockedAt) throw new HttpsError("failed-precondition", "This enquiry has been unlocked. You can block further contact instead.");
    if (e.withdrawnAt) return;
    const withdrawnAt = ctx.now.toISOString(); tx.update(ref, { withdrawnAt });
    for (const uid of [e.traineeId, e.trainerUid]) tx.update(inboxRef(ctx, uid, id), { withdrawnAt });
  });
  return detail(ctx, id);
}
export async function messages(ctx: Context, id: string, before?: number): Promise<MessagePage> {
  const { ref, enquiry } = await ownedEnquiry(ctx, id);
  if (!enquiry.unlockedAt) fail("Unlock this enquiry to access the conversation.");
  let query = ref.collection("messages").orderBy("seq", "desc");
  if (before) query = query.startAfter(before);
  const page = await query.limit(51).get();
  return { messages: page.docs.slice(0, 50).map(doc => ({ ...doc.data(), id: doc.id }) as Message).reverse(), hasMore: page.size > 50 };
}
export async function send(ctx: Context, id: string, requestId: string, text: string) {
  return ctx.db.runTransaction(async (tx) => {
    const { ref, enquiry: e, role } = await ownedEnquiry(ctx, id, tx);
    const messageRef = ref.collection("messages").doc(`${ctx.actor.uid}_${requestId}`);
    const existing = await tx.get(messageRef);
    if (existing.exists) {
      if (existing.data()?.text !== text) throw new HttpsError("already-exists", "This send request was already used for a different message.");
      return { ...existing.data(), id: existing.id } as Message;
    }
    contactable(e); if (!e.unlockedAt) fail("The trainer needs to unlock this enquiry before messages can be sent.");
    const recipient = role === "trainer" ? e.traineeId : e.trainerUid;
    const [user, recipientMembership, recipientInbox] = await Promise.all([
      tx.get(userRef(ctx, recipient)), tx.get(ctx.db.collection("webTrainerMemberships").doc(recipient)), tx.get(inboxRef(ctx, recipient, id)),
    ]);
    if (user.data()?.active !== true || recipientMembership.data()?.status === "revoked") fail("This participant is unavailable.");
    const inbox = recipientInbox.data() as InboxRecord;
    const seq = e.lastSeq + 1; const at = ctx.now.toISOString();
    const message: Message = { id: messageRef.id, senderId: ctx.actor.uid, text, seq, sentAt: at };
    const firstReplyAt = e.firstReplyAt ?? (role === "trainer" ? at : null);
    const episode = inbox.episode ?? `${seq}`;
    tx.create(messageRef, message);
    tx.update(ref, { lastSeq: seq, latestAt: at, firstReplyAt });
    tx.update(inboxRef(ctx, ctx.actor.uid, id), { lastSeq: seq, latestAt: at, firstReplyAt });
    tx.update(inboxRef(ctx, recipient, id), { lastSeq: seq, latestAt: at, firstReplyAt, unreadCount: inbox.unreadCount + 1, episode });
    if (!inbox.episode) enqueue(ctx, tx, `message_${hash(`${id}:${recipient}:${episode}`)}`, { kind: "message", uid: recipient, enquiryId: id, episode }, 120_000);
    return message;
  });
}
export async function acknowledge(ctx: Context, id: string, through: number) {
  await ctx.db.runTransaction(async (tx) => {
    const { ref, enquiry: e } = await ownedEnquiry(ctx, id, tx);
    if (!e.unlockedAt) fail();
    const inbox = (await tx.get(inboxRef(ctx, ctx.actor.uid, id))).data() as InboxRecord;
    if (through <= inbox.readSeq) return;
    const readSeq = Math.min(through, e.lastSeq);
    // Count recipient messages after the acknowledgement, not the sequence gap (which includes own sends).
    const remaining = await tx.get(ref.collection("messages").where("seq", ">", readSeq));
    const unreadCount = remaining.docs.filter(doc => doc.data().senderId !== ctx.actor.uid).length;
    tx.update(inboxRef(ctx, ctx.actor.uid, id), { readSeq, unreadCount, ...(unreadCount === 0 ? { episode: null, alertedEpisode: null } : {}) });
  });
  return { acknowledged: true };
}
export async function block(ctx: Context, id: string) {
  await ctx.db.runTransaction(async (tx) => {
    const { ref, enquiry: e } = await ownedEnquiry(ctx, id, tx);
    tx.update(ref, { blockedBy: [...new Set([...e.blockedBy, ctx.actor.uid])] });
    for (const uid of [e.traineeId, e.trainerUid]) tx.update(inboxRef(ctx, uid, id), { blocked: true });
  }); return detail(ctx, id);
}
export async function report(ctx: Context, id: string, reason: string, requestId: string) {
  await ctx.db.runTransaction(async tx => {
    await ownedEnquiry(ctx, id, tx);
    const ref = ctx.db.collection("webMarketplaceReports").doc(hash(`${ctx.actor.uid}:${requestId}`));
    if ((await tx.get(ref)).exists) return;
    tx.create(ref, { enquiryId: id, reporterUid: ctx.actor.uid, reason, createdAt: ctx.now.toISOString(), status: "open" });
  }); return { reported: true };
}
export async function tracking(ctx: Context, id: string, patch: Omit<LeadTracking, "version">, expectedVersion: number) {
  await ctx.db.runTransaction(async (tx) => {
    const { role, enquiry: e } = await ownedEnquiry(ctx, id, tx); if (role !== "trainer") fail();
    const ref = leadRef(ctx, id); const old = (await tx.get(ref)).data() as LeadTracking | undefined;
    if ((old?.version ?? 0) !== expectedVersion) throw new HttpsError("aborted", "These notes changed in another window. Reload before saving; your unsaved notes are preserved.");
    if (!["open", "closed"].includes(patch.outcome) && !e.unlockedAt) throw new HttpsError("failed-precondition", "Unlock this enquiry before updating its outcome.");
    tx.set(ref, { ...patch, version: expectedVersion + 1 });
    tx.update(inboxRef(ctx, ctx.actor.uid, id), { outcome: patch.outcome });
  }); return detail(ctx, id);
}
export async function inbox(ctx: Context, cursor?: string): Promise<InboxPage> {
  await active(ctx);
  let query = userRef(ctx).collection("inbox").orderBy("latestAt", "desc");
  if (cursor) { const last = await inboxRef(ctx, ctx.actor.uid, cursor).get(); if (!last.exists) throw new HttpsError("invalid-argument", "Invalid inbox page."); query = query.startAfter(last); }
  const page = await query.limit(51).get();
  return { items: page.docs.slice(0, 50).map(doc => doc.data() as InboxItem), nextCursor: page.size > 50 ? page.docs[49]!.id : null };
}
export function aggregate(items: InboxItem[], leads: Map<string, LeadTracking>, unlocks: Unlock[], days: 7 | 28, now: Date): Dashboard {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const inCohort = (at: string) => at.slice(0, 10) >= start && at <= now.toISOString();
  const cohort = items.filter(item => inCohort(item.createdAt));
  const unlocked = cohort.filter(item => item.unlockedAt).length;
  const started = cohort.filter(item => item.unlockedAt && leads.get(item.id)?.outcome === "started").length;
  const actionable = items.filter(item => !item.blocked && !item.withdrawnAt && !["closed", "started"].includes(leads.get(item.id)?.outcome ?? "open"));
  const reminders = actionable.flatMap(item => leads.get(item.id)?.followUp ? [{ ...item, followUp: leads.get(item.id)!.followUp! }] : []).sort((a, b) => a.followUp.localeCompare(b.followUp));
  return {
    queues: { new: actionable.filter(item => !item.unlockedAt).length, reply: actionable.filter(item => item.unlockedAt && !item.firstReplyAt).length, followUp: reminders.length },
    cohort: { received: cohort.length, unlocked, started, conversion: unlocked ? started / unlocked : null },
    trend: Array.from({ length: days }, (_, i) => { const date = new Date(end.getTime() - (days - i - 1) * 86400_000).toISOString().slice(0, 10); return { date, received: cohort.filter(item => item.createdAt.startsWith(date)).length, unlocked: unlocks.filter(item => item.unlockedAt.startsWith(date)).length }; }),
    goals: [...new Set(cohort.map(item => item.summary.goalCategory))].map(category => ({ category, count: cohort.filter(item => item.summary.goalCategory === category).length })),
    reminders, unlocks, actualSpendPence: 0,
  };
}
export async function dashboard(ctx: Context, days: 7 | 28) {
  await trainer(ctx);
  const [items, leads, unlocks] = await Promise.all([
    userRef(ctx).collection("inbox").get(), ctx.db.collection("webLeadTracking").doc(ctx.actor.uid).collection("leads").get(),
    ctx.db.collection("webTrainerUnlocks").where("trainerUid", "==", ctx.actor.uid).get(),
  ]);
  return aggregate(items.docs.map(doc => doc.data() as InboxItem), new Map(leads.docs.map(doc => [doc.id, doc.data() as LeadTracking])), unlocks.docs.map(doc => doc.data() as Unlock).sort((a,b) => b.unlockedAt.localeCompare(a.unlockedAt)), days, ctx.now);
}
export async function preferences(ctx: Context, preferences: typeof defaults) {
  await ctx.db.runTransaction(async tx => { await active(ctx, tx); tx.set(userRef(ctx), { preferences }, { merge: true }); });
  return { preferences };
}
