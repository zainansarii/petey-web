import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { isoDate, reviewDraftSchema, verificationSchema, type ReviewDraft, type Verification } from "../../src/features/trainerApplications/model.js";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const answer = z.union([z.string().max(12_000), z.array(z.string().max(4_000)).max(40)]);
const dateTime = z.string().datetime({ offset: true });
export const formImportSchema = z.object({
  schemaVersion: z.literal(1), formId: z.string().min(1).max(200), responseId: z.string().min(1).max(200),
  observedAt: dateTime, submittedAt: dateTime,
  editUrl: z.string().max(4_000).refine((value) => {
    try { const url = new URL(value); return url.origin === "https://docs.google.com" && url.pathname.startsWith("/forms/") && !url.username && !url.password; } catch { return false; }
  }),
  answers: z.record(z.string().max(80), answer),
  items: z.array(z.object({ itemId: z.string().max(200), title: z.string().max(500), type: z.string().max(80), value: answer }).strict()).max(60),
  photo: z.object({ fileId: z.string().min(1).max(200), modifiedAt: dateTime, size: z.number().int().nonnegative(), mimeType: z.string().max(160) }).strict().nullable(),
}).strict();
export type FormImport = z.infer<typeof formImportSchema>;
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${canonicalJson(val)}`).join(",")}}`;
}
export const applicationIdFor = (formId: string, responseId: string) => `form_${digest(`${formId}\n${responseId}`)}`;
export const contentHashFor = (input: FormImport) => digest(canonicalJson({ answers: input.answers, items: input.items, photo: input.photo }));
export function signedMessage(kind: "import" | "photo" | "sync", timestamp: string, body: Buffer, application = "", revision = "", file = "") {
  return `${timestamp}\n${kind}\n${application}\n${revision}\n${file}\n${digest(body)}`;
}
export function validSignature(secret: string, signature: string, timestamp: string, message: string, now = Date.now()) {
  if (!secret || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300_000 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
const answerText = (answers: FormImport["answers"], key: string) => {
  const value = answers[key]; return typeof value === "string" ? value.trim() : value?.join("\n").trim() ?? "";
};
const answerList = (answers: FormImport["answers"], key: string) => {
  const value = answers[key]; return (Array.isArray(value) ? value : value ? [value] : []).map((part) => part.trim()).filter(Boolean);
};
export function parsePence(value: string): number | null {
  if (!/^(?:\d{1,7})(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [pounds, decimals = ""] = value.trim().split(".");
  const pence = Number(pounds) * 100 + Number(decimals.padEnd(2, "0"));
  return pence <= 10_000_000 ? pence : null;
}
export const photoProblem = (photo: FormImport["photo"]) => !photo ? "The profile photo is missing or unavailable. Check the form owner's Drive access; if no valid photo was submitted, request a new application."
  : photo.size > MAX_PHOTO_BYTES ? "The profile photo exceeds 10 MB. Request a new application with a JPEG, PNG or WebP image under 10 MB."
    : !["image/jpeg", "image/png", "image/webp"].includes(photo.mimeType) ? "This photo format is unsupported. Request a new application with a JPEG, PNG or WebP image."
      : photo.size === 0 ? "The profile photo is empty. Request a new application with a valid profile photo." : null;
export function mapApplication(input: FormImport): { draft: ReviewDraft; verification: Verification; issues: string[]; email: string } {
  const a = input.answers;
  const issues: string[] = [];
  const bounded = (key: string, max = 4_000) => { const value = answerText(a, key); if (value.length > max) issues.push(`${key}: shorten or clarify this answer before publishing.`); return value.slice(0, max); };
  const choices = (key: string) => answerList(a, key).map((value) => value.slice(0, 160)).slice(0, 30);
  const email = answerText(a, "email").toLowerCase();
  if (!z.email().safeParse(email).success) issues.push("Confirm the applicant's contact email.");
  const price = parsePence(answerText(a, "sessionPrice"));
  if (price === null) issues.push("Confirm the standard session price in GBP.");
  const durationAnswer = answerText(a, "sessionDuration");
  const durationMatch = /^(\d{1,4})(?:\s*(?:minutes?|mins?))?$/i.exec(durationAnswer);
  const duration = durationMatch && Number(durationMatch[1]) > 0 && Number(durationMatch[1]) <= 1_440 ? Number(durationMatch[1]) : null;
  if (duration === null) issues.push("Confirm the session duration in minutes.");
  const acceptance = answerText(a, "acceptingClients");
  if (/future/i.test(acceptance)) issues.push("Confirm the date this trainer can start taking clients.");
  let professionalUrl: string | null = bounded("professionalUrl", 2_000) || null;
  if (professionalUrl) { try { const url = new URL(professionalUrl); if (url.protocol !== "https:" || url.username || url.password) throw new Error(); } catch { professionalUrl = null; issues.push("Check the professional website or social link."); } }
  const draft = reviewDraftSchema.parse({
    name: bounded("fullName", 160), bio: bounded("bio"), specialties: choices("specialties"),
    coachingStyles: bounded("coachingStyle") ? [bounded("coachingStyle")] : [], venues: choices("venues"),
    area: bounded("serviceAreas", 160), serviceAreaNotes: bounded("serviceAreas"),
    availability: bounded("availability") ? [bounded("availability")] : [],
    singleSessionPence: price, tenPackPence: null, monthlyCoachingPence: null,
    sessionDurationMinutes: duration, pricingNotes: bounded("packages"),
    qualifications: [bounded("qualification", 160), ...answerList(a, "otherQualifications").map((value) => value.slice(0, 160))].filter(Boolean).slice(0, 30),
    gender: bounded("gender", 160) || null, experience: bounded("experience", 160), professionalUrl,
    acceptingNewClients: /^(?:yes[ ,—–-]*)?now$|^yes,?\s*(?:i am )?(?:accepting new clients|immediately|right now)/i.test(acceptance), availableFrom: null,
  });
  const verification = verificationSchema.parse({
    qualification: { checked: false, title: bounded("qualification", 160), provider: "", expiresOn: null, reference: "" },
    insurance: { checked: false, provider: "", expiresOn: null, reference: "" }, additionalChecks: [], notes: "",
  });
  return { draft, verification, issues: [...new Set(issues)], email };
}
export function approvalIssues(draft: ReviewDraft, verification: Verification, photoReady: boolean, now = new Date()): string[] {
  const issues: string[] = [];
  for (const [key, label] of [["name", "Name"], ["bio", "Bio"], ["area", "Training area"]] as const) if (!draft[key]) issues.push(`${label} is required.`);
  for (const [key, label] of [["specialties", "Specialisms"], ["coachingStyles", "Coaching style"], ["venues", "Training formats"], ["availability", "Availability"], ["qualifications", "Qualifications"]] as const) if (!draft[key].length) issues.push(`${label} is required.`);
  if (draft.singleSessionPence === null || draft.singleSessionPence > 10_000_000) issues.push("Confirm a valid standard session price.");
  if (draft.sessionDurationMinutes === null) issues.push("Confirm session duration.");
  for (const key of ["coachingStyles", "availability"] as const) {
    if (draft[key].filter((value) => value.length > 160).join("\n").length > 4_000) issues.push(`Shorten ${key} notes to 4,000 characters.`);
    if (draft[key].some((value) => !value.trim())) issues.push(`Remove blank ${key} entries.`);
  }
  if ([...draft.specialties, ...draft.venues, ...draft.qualifications].some((value) => !value.trim())) issues.push("Remove blank profile list entries.");
  if (!photoReady) issues.push("A valid profile photo is required.");
  const today = now.toISOString().slice(0, 10);
  if (!verification.qualification.checked || !verification.qualification.title || !verification.qualification.provider || !verification.qualification.reference) issues.push("Record the completed PT qualification check, awarding body and reference.");
  if (!verification.insurance.checked || !verification.insurance.provider || !verification.insurance.expiresOn || !verification.insurance.reference) issues.push("Record the completed insurance check, provider, expiry and reference.");
  const dates = [verification.insurance.expiresOn, verification.qualification.expiresOn, ...verification.additionalChecks.map((check) => check.expiresOn)].filter((value): value is string => value !== null);
  if (dates.some((value) => !isoDate.safeParse(value).success || value < today)) issues.push("Verification has expired. Complete a current check.");
  if (verification.additionalChecks.some((check) => !check.checked || !check.title || !check.reference)) issues.push("Complete or remove unfinished additional checks.");
  return issues;
}
export const verificationExpiry = (verification: Verification) => [verification.insurance.expiresOn!, verification.qualification.expiresOn, ...verification.additionalChecks.map((check) => check.expiresOn)].filter((value): value is string => Boolean(value)).sort()[0]!;
