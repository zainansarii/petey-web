import {
  INITIAL_IDENTITY_ANSWERS,
  INITIAL_MATCHING_ANSWERS,
  formatDobInput,
  isAdultDate,
  normalizePostcode,
  saveMatchingDraft,
  stepError,
} from "./onboarding";

describe("web onboarding model", () => {
  it("keeps personal identity out of the matching draft", () => {
    expect(INITIAL_MATCHING_ANSWERS).not.toHaveProperty("fullName");
    expect(INITIAL_MATCHING_ANSWERS).not.toHaveProperty("dateOfBirth");
    expect(INITIAL_MATCHING_ANSWERS).not.toHaveProperty("email");
  });

  it("normalizes UK postcodes", () => {
    expect(normalizePostcode("sw11 3aa")).toBe("SW11 3AA");
  });

  it("rejects under-18 dates", () => {
    const today = new Date("2026-08-15T12:00:00Z");
    expect(isAdultDate("16/08/2008", today)).toBe(false);
    expect(isAdultDate("15/08/2008", today)).toBe(true);
  });

  it("formats a numeric mobile date of birth as it is entered", () => {
    expect(formatDobInput("20051995")).toBe("20/05/1995");
    expect(formatDobInput("20/05/1995")).toBe("20/05/1995");
  });

  it("requires explicit consent when health information is present", () => {
    const answers = {
      ...INITIAL_MATCHING_ANSWERS,
      medicalNote: "A knee injury",
    };
    expect(stepError(5, answers, INITIAL_IDENTITY_ANSWERS)).toMatch(/consent/i);
  });

  it("does not persist health information in the session draft", () => {
    saveMatchingDraft({
      ...INITIAL_MATCHING_ANSWERS,
      postcode: "SW11 3AA",
      medicalNote: "Private health context",
      biggestObstacle: "Private free text",
      healthConsent: true,
    });
    const stored = JSON.parse(window.sessionStorage.getItem("petey.web.matching-draft.v1") ?? "{}");
    expect(stored.postcode).toBe("");
    expect(stored.medicalNote).toBe("");
    expect(stored.biggestObstacle).toBe("");
    expect(stored.healthConsent).toBe(false);
  });
});
