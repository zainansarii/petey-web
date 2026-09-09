import { reviewErrorMessage } from "./auth";

it("distinguishes a browser attestation failure from an expired reviewer session", () => {
  expect(reviewErrorMessage({ code: "appCheck/recaptcha-error" })).toContain("browser could not complete the security check");
  expect(reviewErrorMessage({ code: "functions/unauthenticated" })).toContain("session needs to be renewed");
});

it("shows actionable backend approval and field failures", () => {
  expect(reviewErrorMessage({ code: "functions/failed-precondition", details: { issues: ["Confirm the future start date.", "Insurance has expired."] } })).toBe("Confirm the future start date. Insurance has expired.");
  expect(reviewErrorMessage({ code: "functions/invalid-argument", details: { fields: [{ path: "verification.insurance.expiresOn", message: "Enter a valid date." }] } })).toContain("Enter a valid date");
});
