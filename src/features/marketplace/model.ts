import { z } from "zod";
import { isoDate, reviewDraftSchema, verificationSchema } from "../trainerApplications/model.js";

export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const outcomes = ["open", "contacted", "consultation", "started", "closed"] as const;
export type Outcome = typeof outcomes[number];
export const outcomeLabels: Record<Outcome, string> = { open: "Open", contacted: "Contacted", consultation: "Consultation", started: "Started training", closed: "Closed" };
export const goalCategories = ["Strength", "Weight management", "Fitness", "Confidence", "Sport", "Other"] as const;
const short = z.string().trim().max(300);
// This is a trainee-confirmed disclosure, never the internal matching brief.
export const sharedSummarySchema = z.object({
  goals: z.string().trim().min(1).max(1000), area: short, settings: short,
  budget: short, availability: short, frequency: short,
  goalCategory: z.enum(goalCategories),
}).strict();
export type SharedSummary = z.infer<typeof sharedSummarySchema>;
export const publicDraftSchema = reviewDraftSchema.omit({ qualifications: true }).strict();
export type PublicDraft = z.infer<typeof publicDraftSchema>;
export const preferencesSchema = z.object({ enquiries: z.boolean(), messages: z.boolean() }).strict();
export type EmailPreferences = z.infer<typeof preferencesSchema>;
const enquiry = { enquiryId: idSchema };
const version = z.number().int().nonnegative();
const fileSchema = z.object({ name: z.string().trim().min(1).max(120), base64: z.string().min(1).max(7_000_000) }).strict();
export const marketplaceRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("access") }).strict(),
  z.object({ action: z.literal("invite"), trainerId: idSchema, requestId: z.uuid() }).strict(),
  z.object({ action: z.literal("invitationStatus"), trainerId: idSchema }).strict(),
  z.object({ action: z.literal("revoke"), trainerId: idSchema }).strict(),
  z.object({ action: z.literal("redeem"), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ action: z.literal("prepare"), trainerId: idSchema }).strict(),
  z.object({ action: z.literal("availability"), trainerIds: z.array(idSchema).max(500) }).strict(),
  z.object({ action: z.literal("enquire"), trainerId: idSchema, introduction: z.string().trim().min(10).max(4000), summary: sharedSummarySchema }).strict(),
  z.object({ action: z.literal("detail"), ...enquiry }).strict(),
  z.object({ action: z.literal("unlock"), ...enquiry }).strict(),
  z.object({ action: z.literal("withdraw"), ...enquiry }).strict(),
  z.object({ action: z.literal("messages"), ...enquiry, before: z.number().int().positive().optional() }).strict(),
  z.object({ action: z.literal("send"), ...enquiry, requestId: z.uuid(), text: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ action: z.literal("read"), ...enquiry, through: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("block"), ...enquiry }).strict(),
  z.object({ action: z.literal("report"), ...enquiry, reason: z.string().trim().min(10).max(2000), requestId: z.uuid() }).strict(),
  z.object({ action: z.literal("tracking"), ...enquiry, notes: z.string().max(8000), followUp: isoDate.nullable(), outcome: z.enum(outcomes), expectedVersion: version }).strict(),
  z.object({ action: z.literal("inbox"), cursor: idSchema.optional() }).strict(),
  z.object({ action: z.literal("dashboard"), days: z.union([z.literal(7), z.literal(28)]) }).strict(),
  z.object({ action: z.literal("profile") }).strict(),
  z.object({ action: z.literal("draft"), draft: publicDraftSchema, expectedDraftVersion: version, baseVersion: version }).strict(),
  z.object({ action: z.literal("publish"), expectedVersion: version, expectedDraftVersion: version }).strict(),
  z.object({ action: z.literal("capacity"), accepting: z.boolean(), expectedVersion: version }).strict(),
  z.object({ action: z.literal("photo"), file: fileSchema, expectedDraftVersion: version }).strict(),
  z.object({ action: z.literal("credentials"), kind: z.enum(["qualification", "insurance"]), title: z.string().trim().min(1).max(160), provider: z.string().trim().min(1).max(160), expiresOn: isoDate.nullable(), file: fileSchema, requestId: z.uuid() }).strict(),
  z.object({ action: z.literal("credentialList"), trainerId: idSchema }).strict(),
  z.object({ action: z.literal("credentialReview"), trainerId: idSchema, submissionId: idSchema, approve: z.boolean(), reason: z.string().trim().max(2000), verification: verificationSchema, expectedVersion: version }).strict(),
  z.object({ action: z.literal("preferences"), preferences: preferencesSchema }).strict(),
]);
export type MarketplaceRequest = z.infer<typeof marketplaceRequestSchema>;
export interface Membership { trainerId: string; status: "active" | "revoked"; email: string }
export interface Access { uid: string; email: string; membership: Membership | null; pilotEnabled: boolean; preferences: EmailPreferences }
export interface InboxItem {
  id: string; trainerId: string; trainerName: string; traineeLabel: string; createdAt: string; latestAt: string;
  summary: SharedSummary; unlockedAt: string | null; firstReplyAt: string | null;
  withdrawnAt: string | null; blocked: boolean; unreadCount: number; lastSeq: number; readSeq: number;
  outcome?: Outcome;
}
export interface LeadTracking { notes: string; followUp: string | null; outcome: Outcome; version: number }
export interface EnquiryDetail extends InboxItem {
  role: "trainer" | "trainee"; tradeoffs: string[];
  content: { fullName: string; introduction: string } | null; tracking: LeadTracking | null;
}
export interface Message { id: string; senderId: string; text: string; seq: number; sentAt: string }
export interface MessagePage { messages: Message[]; hasMore: boolean }
export interface InboxPage { items: InboxItem[]; nextCursor: string | null }
export interface Unlock { id: string; traineeLabel: string; amountPence: 0; unlockedAt: string; receivedAt: string; priceVersion: "free-pilot-v1" }
export interface Dashboard {
  queues: { new: number; reply: number; followUp: number }; cohort: { received: number; unlocked: number; started: number; conversion: number | null };
  trend: { date: string; received: number; unlocked: number }[];
  goals: { category: string; count: number }[]; reminders: (InboxItem & { followUp: string })[];
  unlocks: Unlock[]; actualSpendPence: 0;
}
export interface ProfileWorkspace {
  draft: PublicDraft; published: PublicDraft; draftVersion: number; baseVersion: number; version: number;
  photoUrl: string; draftPhotoUrl: string; qualifications: string[]; verificationExpiresOn: string | null;
}
export interface InvitationStatus { status: "none" | "pending" | "accepted" | "expired" | "revoked"; email?: string; expiresAt?: string; uid?: string | null }
export interface CredentialSubmission { id: string; kind: "qualification" | "insurance"; title: string; provider: string; expiresOn: string | null; createdAt: string; status: "pending" | "approved" | "rejected"; url?: string; reason?: string }
