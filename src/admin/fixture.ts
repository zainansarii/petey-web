import type { ApplicationDetail, ApplicationSummary } from "../features/trainerApplications/model";
import type { ReviewApi } from "./api";

export function makeReviewFixture(id = "preview-alex"): ApplicationDetail {
  return {
    application: { id, trainerId: `form-${id}`, name: "Alex Morgan", email: "alex@example.com", status: "pending_review", version: 1, sourceRevision: 1, publishedVersion: null, createdAt: "2026-09-07T09:00:00.000Z", updatedAt: "2026-09-07T09:00:00.000Z", issues: [], photoState: "ready" },
    source: { formId: "preview", responseId: id, submittedAt: "2026-09-07T09:00:00.000Z", observedAt: "2026-09-07T09:01:00.000Z", editUrl: "https://docs.google.com/forms/d/preview/viewform?edit2=preview" },
    originalAnswers: { name: "Alex Morgan", email: "alex@example.com", bio: "I help people build strength with practical, encouraging coaching. Sessions are tailored to your goals and experience.", coachingStyle: "Calm, encouraging, and clear", serviceAreas: "Hackney and Islington. Online coaching across the UK.", availability: "Monday and Wednesday evenings, Saturday mornings.", standardPrice: "65", packagePricing: "Five sessions for £300." },
    draft: { name: "Alex Morgan", bio: "I help people build strength with practical, encouraging coaching. Sessions are tailored to your goals and experience.", specialties: ["Strength", "General fitness"], coachingStyles: ["Calm, encouraging, and clear"], venues: ["Commercial gym", "Online"], area: "Hackney, London", serviceAreaNotes: "Hackney and Islington. Online coaching across the UK.", availability: ["Monday and Wednesday 6–9pm", "Saturday 9am–noon, UK time"], singleSessionPence: 6500, tenPackPence: null, monthlyCoachingPence: null, sessionDurationMinutes: 60, pricingNotes: "Five sessions for £300.", qualifications: ["Level 3 Diploma in Personal Training"], gender: null, experience: "3–5 years", professionalUrl: "https://example.com", acceptingNewClients: true, availableFrom: null },
    verification: { qualification: { checked: false, title: "Level 3 Diploma in Personal Training", provider: "", expiresOn: null, reference: "" }, insurance: { checked: false, provider: "", expiresOn: null, reference: "" }, additionalChecks: [], notes: "" },
    photo: { state: "ready", path: "preview/photo.webp", url: null, error: null, revision: 1 },
    issues: [], history: [], duplicateApplications: [],
  };
}

const records = new Map<string, ApplicationDetail>();
records.set("preview-alex", makeReviewFixture());
const jamie = makeReviewFixture("preview-jamie");
jamie.application.name = jamie.draft.name = "Jamie Patel";
jamie.application.email = "jamie@example.com";
jamie.application.photoState = jamie.photo.state = "error";
jamie.photo.error = "This photo could not be processed. Request a JPEG, PNG or WebP image.";
jamie.issues = jamie.application.issues = ["A valid profile photo is required."];
records.set("preview-jamie", jamie);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const read = (id: string) => {
  const item = records.get(id);
  if (!item) throw new Error("Application not found.");
  return item;
};
const current = (id: string, version: number) => {
  const item = read(id);
  if (item.application.version !== version) throw Object.assign(new Error("This application changed. Reload the latest version."), { code: "functions/aborted" });
  return item;
};

export const fixtureApi: ReviewApi = {
  async access() { return { reviewer: { uid: "preview-reviewer", email: "reviewer@example.com" }, health: { lastSuccessfulSyncAt: "2026-09-07T09:01:00.000Z", lastAttemptAt: "2026-09-07T09:01:00.000Z", errorCount: 1, message: "One profile photo needs attention." } }; },
  async list({ status }) { return { applications: clone([...records.values()].filter((item) => !status || item.application.status === status).map((item) => item.application)), nextCursor: null }; },
  async detail(id) { return clone(read(id)); },
  async save({ applicationId, expectedVersion, draft, verification }) {
    const item = current(applicationId, expectedVersion);
    item.draft = clone(draft); item.verification = clone(verification);
    item.application.name = draft.name;
    item.application.version += 1;
    item.history.unshift({ id: crypto.randomUUID(), action: "draft_saved", reviewerUid: "preview-reviewer", at: new Date().toISOString(), version: item.application.version, reason: null });
    return clone(item);
  },
  async decide({ applicationId, expectedVersion, decision, reason, requestId }) {
    const item = current(applicationId, expectedVersion);
    if (decision === "approve" && (item.photo.state !== "ready" || !item.verification.qualification.checked || !item.verification.insurance.checked || !item.verification.insurance.provider || !item.verification.insurance.expiresOn || item.verification.insurance.expiresOn < new Date().toISOString().slice(0, 10))) {
      throw new Error("Complete qualification and current insurance checks, and resolve the profile photo before approval.");
    }
    const statuses: Record<typeof decision, ApplicationSummary["status"]> = { approve: "approved", needs_changes: "needs_changes", reject: "rejected", suspend: "suspended" };
    item.application.status = statuses[decision];
    item.application.version += 1;
    if (decision === "approve") item.application.publishedVersion = item.application.version;
    item.history.unshift({ id: requestId, action: decision, reviewerUid: "preview-reviewer", at: new Date().toISOString(), version: item.application.version, reason: reason ?? null });
    return clone(item);
  },
};
