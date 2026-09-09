import { randomUUID } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { defaults, type Enquiry, type InboxRecord } from "./core.js";

export interface Mail { to: string; subject: string; text: string }
type Delivery = (mail: Mail, idempotencyKey: string) => Promise<string>;
// Database lease + stable provider key cover overlapping schedulers and uncertain responses.
export async function processNotifications(db: Firestore, send: Delivery, siteUrl: string, now = new Date()) {
  const at = now.toISOString();
  const due = await db.collection("webNotificationQueue").where("status", "==", "pending").where("dueAt", "<=", at).orderBy("dueAt").limit(50).get();
  let sent = 0; let suppressed = 0; let failed = 0;
  for (const doc of due.docs) {
    const lease = randomUUID();
    const claimed = await db.runTransaction(async tx => {
      const q = (await tx.get(doc.ref)).data()!;
      if (q.status !== "pending" || q.dueAt > at || (q.leaseUntil && q.leaseUntil > at)) return null;
      let mail: Mail; let suppress: boolean;
      if (q.kind === "invitation") {
        const [invite, pilot] = await Promise.all([tx.get(db.collection("webTrainerInvitations").doc(q.invitationHash)), tx.get(db.collection("webTrainerPilot").doc(q.trainerId))]);
        const i = invite.data(); suppress = !i || Boolean(i.revokedAt || i.usedAt) || i.expiresAt <= at || pilot.data()?.invitationHash !== q.invitationHash;
        mail = { to: q.email, subject: "Your invitation to Petey for trainers", text: `Your trainer application has been approved. Accept your personal invitation within seven days:\n\n${q.link}\n\nSign in using this email address. Unlocks are free during the pilot.` };
      } else {
        const [user, member, enquiry, inbox] = await Promise.all([
          tx.get(db.collection("webMarketplaceUsers").doc(q.uid)), tx.get(db.collection("webTrainerMemberships").doc(q.uid)),
          tx.get(db.collection("webEnquiries").doc(q.enquiryId)), tx.get(db.collection("webMarketplaceUsers").doc(q.uid).collection("inbox").doc(q.enquiryId)),
        ]);
        const u = user.data(); const e = enquiry.data() as Enquiry | undefined; const i = inbox.data() as InboxRecord | undefined;
        const preferences = u?.preferences ?? defaults;
        suppress = u?.active !== true || member.data()?.status === "revoked" || !u?.email || !e || Boolean(e.withdrawnAt || e.blockedBy.length);
        if (q.kind === "message") suppress ||= !preferences.messages || !i?.unreadCount || i.episode !== q.episode || i.alertedEpisode === q.episode;
        else suppress ||= !preferences.enquiries || Boolean(e?.unlockedAt);
        const trainer = e?.trainerUid === q.uid;
        const link = `${siteUrl}/${trainer ? "trainer" : "messages"}/#${trainer ? "enquiries/" : ""}${q.enquiryId}`;
        mail = { to: u?.email ?? "", subject: q.kind === "message" ? "You have an unread message on Petey" : "You have a new enquiry on Petey", text: `Open your secure Petey inbox to catch up:\n\n${link}\n\nYou can manage activity emails in your Petey inbox settings.` };
      }
      // Resend retains keys for 24h. Never replay an uncertain delivery beyond that window.
      if (q.firstAttemptAt && now.getTime() - Date.parse(q.firstAttemptAt) >= 23 * 3600_000) {
        tx.update(doc.ref, { status: "needs_review", lastError: "Delivery confirmation expired; inspect provider before retrying." }); return null;
      }
      if (q.delivery && q.delivery.to !== mail.to) suppress = true;
      if (suppress) { tx.update(doc.ref, { status: "suppressed", finishedAt: at, link: FieldValue.delete(), delivery: FieldValue.delete() }); suppressed++; return null; }
      const delivery = (q.delivery ?? mail) as Mail;
      tx.update(doc.ref, { delivery, lease, leaseUntil: new Date(now.getTime() + 60_000).toISOString(), firstAttemptAt: q.firstAttemptAt ?? at, attempts: q.attempts + 1 });
      return { q, mail: delivery };
    });
    if (!claimed) continue;
    try {
      const providerId = await send(claimed.mail, `petey-${doc.id}`);
      await db.runTransaction(async tx => {
        const latest = (await tx.get(doc.ref)).data();
        if (latest?.lease !== lease) return;
        let i: InboxRecord | undefined;
        const inboxRef = claimed.q.kind === "message" ? db.collection("webMarketplaceUsers").doc(claimed.q.uid).collection("inbox").doc(claimed.q.enquiryId) : null;
        if (inboxRef) i = (await tx.get(inboxRef)).data() as InboxRecord | undefined;
        tx.update(doc.ref, { status: "sent", providerId, finishedAt: at, link: FieldValue.delete(), delivery: FieldValue.delete(), leaseUntil: FieldValue.delete() });
        if (inboxRef && i?.episode === claimed.q.episode) tx.update(inboxRef, { alertedEpisode: claimed.q.episode });
      }); sent++;
    } catch {
      failed++;
      await db.runTransaction(async tx => {
        const q = (await tx.get(doc.ref)).data(); if (q?.lease !== lease) return;
        tx.update(doc.ref, { leaseUntil: FieldValue.delete(), lastError: "Email delivery failed; retry scheduled.", dueAt: new Date(now.getTime() + Math.min(3600_000, 60_000 * 2 ** Math.min(q.attempts, 6))).toISOString() });
      });
    }
  }
  return { sent, suppressed, failed };
}
export async function resendDelivery(apiKey: string, sender: string, mail: Mail, key: string) {
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ from: sender, to: [mail.to], subject: mail.subject, text: mail.text }), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error("Email provider rejected delivery.");
  const result = await response.json() as { id?: string }; if (!result.id) throw new Error("Missing delivery receipt."); return result.id;
}
