import { randomBytes } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { publicDraftSchema, type Access, type InvitationStatus } from "../../../src/features/marketplace/model.js";
import { active, defaults, enqueue, fail, hash, requirePilot, userRef, type Context } from "./core.js";

export async function access(ctx: Context): Promise<Access> {
  const membership = await ctx.db.runTransaction(async tx => { const member = await active(ctx, tx); tx.set(userRef(ctx), { active: true, email: ctx.actor.email }, { merge: true }); return member; });
  const user = (await userRef(ctx).get()).data();
  return { ...ctx.actor, membership, pilotEnabled: ctx.pilotEnabled, preferences: user?.preferences ?? defaults };
}
export async function invitationStatus(ctx: Context, trainerId: string): Promise<InvitationStatus> {
  const p = (await ctx.db.collection("webTrainerPilot").doc(trainerId).get()).data();
  if (!p) return { status: "none" };
  return { status: p.status === "pending" && p.expiresAt <= ctx.now.toISOString() ? "expired" : p.status, email: p.email, expiresAt: p.expiresAt, uid: p.uid ?? null };
}
export async function invite(ctx: Context, trainerId: string, requestId: string) {
  requirePilot(ctx);
  const rawToken = randomBytes(32).toString("hex"); const tokenHash = hash(rawToken);
  const pilotRef = ctx.db.collection("webTrainerPilot").doc(trainerId);
  await ctx.db.runTransaction(async (tx) => {
    const [app, pilot] = await Promise.all([tx.get(ctx.db.collection("webTrainerApplications").doc(trainerId)), tx.get(pilotRef)]);
    const a = app.data(); const old = pilot.data();
    if (old?.lastRequestId === requestId) return;
    if (!a || a.status !== "approved" || !a.publishedVersion || !a.email) throw new HttpsError("failed-precondition", "Approve the web application before inviting this trainer.");
    if (old?.uid) throw new HttpsError("failed-precondition", "This trainer already accepted an invitation. Manage their existing access.");
    const email = a.email.trim().toLowerCase(); const expiresAt = new Date(ctx.now.getTime() + 7 * 86400_000).toISOString();
    if (old?.invitationHash) tx.update(ctx.db.collection("webTrainerInvitations").doc(old.invitationHash), { revokedAt: ctx.now.toISOString() });
    tx.create(ctx.db.collection("webTrainerInvitations").doc(tokenHash), { trainerId, email, expiresAt, usedAt: null, revokedAt: null, createdBy: ctx.actor.uid });
    tx.set(pilotRef, { status: "pending", enabled: false, uid: null, email, expiresAt, invitationHash: tokenHash, lastRequestId: requestId });
    enqueue(ctx, tx, `invite_${tokenHash}`, { kind: "invitation", email, trainerId, invitationHash: tokenHash, link: `${ctx.siteUrl}/trainer/?invite=${rawToken}` });
  });
  return invitationStatus(ctx, trainerId);
}
export async function redeem(ctx: Context, rawToken: string) {
  requirePilot(ctx);
  const invitationRef = ctx.db.collection("webTrainerInvitations").doc(hash(rawToken));
  await ctx.db.runTransaction(async (tx) => {
    const member = await active(ctx, tx);
    const invitation = (await tx.get(invitationRef)).data();
    if (!invitation || invitation.revokedAt || invitation.usedAt || invitation.expiresAt <= ctx.now.toISOString()) throw new HttpsError("failed-precondition", "This invitation has expired or has already been used. Ask Petey for a new invitation.");
    if (invitation.email !== ctx.actor.email.toLowerCase()) fail("Sign in with the email address that received this invitation.");
    const trainerId = invitation.trainerId as string;
    const pilotRef = ctx.db.collection("webTrainerPilot").doc(trainerId);
    const appRef = ctx.db.collection("webTrainerApplications").doc(trainerId);
    const [pilot, app, catalog, client] = await Promise.all([
      tx.get(pilotRef), tx.get(appRef), tx.get(ctx.db.collection("webTrainerCatalog").doc(trainerId)), tx.get(ctx.db.collection("webClientProfiles").doc(ctx.actor.uid)),
    ]);
    if (member || client.exists || pilot.data()?.uid || pilot.data()?.invitationHash !== invitationRef.id) fail("This account cannot claim that trainer profile. Contact Petey for help.");
    const a = app.data(); const c = catalog.data();
    if (!a || a.status !== "approved" || !c?.published) throw new HttpsError("failed-precondition", "This application needs approval before the invitation can be accepted.");
    const draft = publicDraftSchema.parse(Object.fromEntries(Object.entries(a.draft).filter(([key]) => key !== "qualifications")));
    tx.create(ctx.db.collection("webTrainerMemberships").doc(ctx.actor.uid), { trainerId, email: invitation.email, status: "active", acceptedAt: ctx.now.toISOString() });
    tx.set(userRef(ctx), { active: true, email: ctx.actor.email, preferences: defaults }, { merge: true });
    tx.create(ctx.db.collection("webTrainerWorkspaces").doc(trainerId), { published: draft, draft, draftVersion: 0, baseVersion: c.profileVersion, draftPhotoPath: a.publishedPhotoPath, publishedPhotoPath: a.publishedPhotoPath });
    tx.set(ctx.db.collection("webTrainerVerifiedCredentials").doc(trainerId), { verification: a.verification, qualifications: c.profile.qualifications });
    tx.update(invitationRef, { usedAt: ctx.now.toISOString(), usedBy: ctx.actor.uid });
    tx.update(pilotRef, { status: "accepted", enabled: true, uid: ctx.actor.uid });
  });
  return access(ctx);
}
export async function revoke(ctx: Context, trainerId: string) {
  await ctx.db.runTransaction(async (tx) => {
    const ref = ctx.db.collection("webTrainerPilot").doc(trainerId); const old = (await tx.get(ref)).data();
    if (!old) return;
    tx.update(ref, { status: "revoked", enabled: false });
    if (old.invitationHash) tx.update(ctx.db.collection("webTrainerInvitations").doc(old.invitationHash), { revokedAt: ctx.now.toISOString() });
    if (old.uid) {
      tx.update(ctx.db.collection("webTrainerMemberships").doc(old.uid), { status: "revoked", revokedAt: ctx.now.toISOString() });
      tx.set(userRef(ctx, old.uid), { active: false }, { merge: true });
    }
  });
  return invitationStatus(ctx, trainerId);
}
