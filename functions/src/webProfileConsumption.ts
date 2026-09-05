import { HttpsError } from "firebase-functions/v2/https";
import { profileMarkdownSchema } from "../../src/features/onboarding/model/onboardingContract.js";

type ConsumptionDraft = {
  status: string;
  profileMarkdown: string | null;
  identity?: { email: string };
};

// A reviewed brief can update an existing account. First-time signup still
// requires confirmed identity and a matching verified authentication email.
export function assertProfileConsumption(
  draft: ConsumptionDraft,
  existing: Record<string, unknown> | undefined,
  authenticatedEmail: string,
): boolean {
  const existingProfile = existing?.profileFormat === "markdown-v1"
    && profileMarkdownSchema.safeParse(existing.profileMarkdown).success;
  const existingIdentity = existing?.identity as { email?: unknown } | undefined;
  if (typeof existingIdentity?.email === "string"
    && existingIdentity.email.toLowerCase() !== authenticatedEmail) {
    throw new HttpsError("permission-denied", "The signed-in email does not match the saved profile.");
  }
  if (!draft.profileMarkdown || !["review", "confirmed"].includes(draft.status)) {
    throw new HttpsError("failed-precondition", "Prepare the training brief before saving it.");
  }
  if (draft.status === "review" && !existingProfile) {
    throw new HttpsError("failed-precondition", "Confirm your basic details before completing signup.");
  }
  if (draft.status === "confirmed" && !draft.identity) {
    throw new HttpsError("failed-precondition", "Confirm your basic details before completing signup.");
  }
  if (draft.identity && draft.identity.email.toLowerCase() !== authenticatedEmail) {
    throw new HttpsError("permission-denied", "The signed-in email does not match this draft.");
  }
  return existingProfile;
}
