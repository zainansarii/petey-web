import { z } from "zod";

export const applicationStatuses = ["pending_review", "needs_changes", "approved", "rejected", "suspended"] as const;
export type ApplicationStatus = typeof applicationStatuses[number];
const text = z.string().trim().max(4_000);
const short = z.string().trim().max(160);
const lines = z.array(short).max(30);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");
const money = z.number().int().nonnegative().max(100_000_000).nullable();
export const reviewDraftSchema = z.object({
  name: short, bio: text, specialties: lines, coachingStyles: z.array(text).max(30), venues: lines,
  area: short, serviceAreaNotes: text, availability: z.array(text).max(30),
  singleSessionPence: money, tenPackPence: money, monthlyCoachingPence: money,
  sessionDurationMinutes: z.number().int().positive().max(1_440).nullable(),
  pricingNotes: text, qualifications: lines, gender: short.nullable(), experience: short,
  professionalUrl: z.string().trim().max(2_000).nullable().refine((value) => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
  }, "Use an HTTPS professional link."),
  acceptingNewClients: z.boolean(), availableFrom: isoDate.nullable(),
}).strict();
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
const check = z.object({ checked: z.boolean(), title: short, provider: short, expiresOn: isoDate.nullable(), reference: text }).strict();
export const verificationSchema = z.object({
  qualification: check,
  insurance: z.object({ checked: z.boolean(), provider: short, expiresOn: isoDate.nullable(), reference: text }).strict(),
  additionalChecks: z.array(check).max(20), notes: text,
}).strict();
export type Verification = z.infer<typeof verificationSchema>;
export type ReviewDecision = "approve" | "needs_changes" | "reject" | "suspend";
export interface ApplicationSummary {
  id: string; trainerId: string; name: string; email: string; status: ApplicationStatus;
  version: number; sourceRevision: number; publishedVersion: number | null;
  createdAt: string; updatedAt: string; issues: string[]; photoState: "pending" | "ready" | "error" | "missing";
}
export interface ReviewEvent {
  id: string; action: string; reviewerUid: string; at: string; version: number; reason: string | null;
}
export interface ApplicationDetail {
  application: ApplicationSummary;
  source: { formId: string; responseId: string; submittedAt: string; observedAt: string; editUrl: string };
  originalAnswers: Record<string, string | string[]>;
  draft: ReviewDraft; verification: Verification;
  photo: { state: ApplicationSummary["photoState"]; path: string | null; url: string | null; error: string | null; revision: number };
  issues: string[]; history: ReviewEvent[]; duplicateApplications: ApplicationSummary[];
}
export interface FormSyncHealth {
  lastSuccessfulSyncAt: string | null; lastAttemptAt: string | null; errorCount: number; message: string | null;
}
export interface ReviewAccess { reviewer: { uid: string; email: string }; health: FormSyncHealth }
export interface ApplicationPage { applications: ApplicationSummary[]; nextCursor: string | null }
