import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applicationIdFor, approvalIssues, contentHashFor, formImportSchema, mapApplication, parsePence, photoProblem, signedMessage, validSignature, type FormImport } from "./webTrainerApplicationDomain.js";

export const applicationFixture = (): FormImport => ({
  schemaVersion: 1, formId: "test-form", responseId: "response-1", observedAt: "2026-09-07T12:00:00.000Z", submittedAt: "2026-09-07T11:59:00.000Z",
  editUrl: "https://docs.google.com/forms/d/e/test/viewform?edit2=private-edit-capability",
  items: [{ itemId: "12", title: "Full name", type: "TEXT", value: "Alex Trainer" }],
  answers: { fullName: "Alex Trainer", email: "ALEX@example.com", bio: "Friendly strength training.", specialties: ["Strength"], coachingStyle: "Calm and educational", venues: ["Online"], serviceAreas: "Online only", availability: "Monday 6–8pm UK time", acceptingClients: "Yes, now", sessionPrice: "65.50", sessionDuration: "60 minutes", qualification: "Personal training diploma", insurance: "Private Insurance Provider 01/01/2027", packages: "Five 60-minute sessions for £300", confirmations: ["Accurate", "Reviewed", "Public profile"] },
  photo: { fileId: "private-drive-id", modifiedAt: "2026-09-07T11:55:00.000Z", size: 100, mimeType: "image/jpeg" },
});
describe("form intake mapping", () => {
  it("preserves exact practical answers without inventing package pricing", () => {
    const { draft, email, verification } = mapApplication(applicationFixture());
    expect(email).toBe("alex@example.com"); expect(draft.singleSessionPence).toBe(6550);
    expect(draft.sessionDurationMinutes).toBe(60); expect(draft.tenPackPence).toBeNull(); expect(draft.monthlyCoachingPence).toBeNull();
    expect(draft.pricingNotes).toBe("Five 60-minute sessions for £300"); expect(draft.availability).toEqual(["Monday 6–8pm UK time"]);
    expect(draft.acceptingNewClients).toBe(true); expect(verification.insurance.checked).toBe(false); expect(verification.qualification.checked).toBe(false);
  });
  it.each(["0", "65", "65.5", "65.50"])("uses integer pence for %s", (value) => expect(parsePence(value)).toBe(Math.round(Number(value) * 100)));
  it.each(["-1", "65.123", "£65", "1e3", "", "Infinity", "65 per hour"])("does not guess an invalid price %s", (value) => expect(parsePence(value)).toBeNull());
  it("keeps optional gender unknown, and future availability requires review", () => {
    const fixture = applicationFixture(); fixture.answers.acceptingClients = "Yes — future date";
    const { draft, issues } = mapApplication(fixture);
    expect(draft.gender).toBeNull(); expect(draft.acceptingNewClients).toBe(false); expect(draft.availableFrom).toBeNull(); expect(issues.join(" ")).toContain("date");
  });
  it("makes idempotency independent of answer object order and observation time", () => {
    const original = applicationFixture(); const again = { ...original, observedAt: "2026-09-08T12:00:00.000Z", answers: Object.fromEntries(Object.entries(original.answers).reverse()) };
    expect(contentHashFor(original)).toBe(contentHashFor(again)); expect(applicationIdFor(original.formId, original.responseId)).toMatch(/^form_[a-f0-9]{64}$/);
    again.answers.bio = "Changed bio"; expect(contentHashFor(original)).not.toBe(contentHashFor(again));
  });
  it("rejects external edit links and malformed source metadata", () => {
    expect(formImportSchema.safeParse({ ...applicationFixture(), editUrl: "https://evil.example/phish" }).success).toBe(false);
  });
  it("reports unavailable and unsupported photos", () => {
    expect(photoProblem(null)).toContain("Check the form owner's Drive access");
    expect(photoProblem(null)).toContain("request a new application");
    expect(photoProblem({ ...applicationFixture().photo!, mimeType: "image/svg+xml" })).toContain("JPEG");
    expect(photoProblem({ ...applicationFixture().photo!, size: 10 * 1024 * 1024 + 1 })).toContain("10 MB");
  });
});
describe("signed form transport", () => {
  const timestamp = "1788782400000"; const body = Buffer.from('{"name":"private"}'); const secret = "test-secret";
  const message = signedMessage("photo", timestamp, body, "app1", "3", "file1");
  const signature = createHmac("sha256", secret).update(message).digest("hex");
  it("accepts an intact signed request only within five minutes", () => {
    expect(validSignature(secret, signature, timestamp, message, Number(timestamp))).toBe(true);
    expect(validSignature(secret, signature, timestamp, message, Number(timestamp) + 300_001)).toBe(false);
  });
  it("binds photo identity, revision and bytes; rejects malformed signatures", () => {
    for (const changed of [signedMessage("photo", timestamp, body, "app2", "3", "file1"), signedMessage("photo", timestamp, body, "app1", "4", "file1"), signedMessage("photo", timestamp, Buffer.from("different"), "app1", "3", "file1")]) expect(validSignature(secret, signature, timestamp, changed, Number(timestamp))).toBe(false);
    expect(validSignature(secret, "bad", timestamp, message, Number(timestamp))).toBe(false);
  });
});
describe("manual approval checks", () => {
  it("requires a photo and actual current verification even with complete self-reported answers", () => {
    const { draft, verification } = mapApplication(applicationFixture());
    const issues = approvalIssues(draft, verification, false, new Date("2026-09-07"));
    expect(issues.some((issue) => issue.includes("photo"))).toBe(true); expect(issues.some((issue) => issue.includes("insurance"))).toBe(true);
  });
  it("blocks stale insurance, unfinished extra checks and overly long practical notes", () => {
    const { draft, verification } = mapApplication(applicationFixture());
    verification.qualification = { checked: true, title: "PT", provider: "Awarding body", expiresOn: null, reference: "Checked externally" };
    verification.insurance = { checked: true, provider: "Insurer", expiresOn: "2026-09-06", reference: "Checked externally" };
    draft.coachingStyles = ["x".repeat(3000), "x".repeat(3000)];
    const issues = approvalIssues(draft, verification, true, new Date("2026-09-07"));
    expect(issues.join(" ")).toContain("expired"); expect(issues.join(" ")).toContain("4,000");
  });
});
