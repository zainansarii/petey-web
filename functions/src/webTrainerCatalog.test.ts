import { describe, expect, it } from "vitest";
import { approvedWebTrainer, trainerPreview } from "./webTrainerCatalog.js";

const now = new Date("2026-09-05T12:00:00.000Z");
const trainerId = "trainer-one";
const approvedData = () => {
  const photo = `onboarding/${trainerId}/profile/photo.webp`;
  return {
    published: {
      trainerId,
      fullName: "Trainer One",
      published: true,
      approvalStatus: "approved",
      profileVersion: 3,
      primaryPhotoPath: photo,
      homeAreaLabel: "N1",
      specialties: ["strength"],
      pricing: { singleSessionPence: 6500, tenPackPence: 59000, monthlyCoachingPence: 34000 },
      venues: ["remote"],
      coachingStyles: ["calm"],
      qualificationTitles: ["Level 3 Personal Training"],
      availability: [{ day: "monday", period: "evening" }],
      gender: "woman",
      idealClients: ["Beginners"],
      webProfile: {
        id: trainerId,
        name: "Trainer One",
        photo,
        specialty: "Strength",
        specialties: ["Strength"],
        area: "Islington · N1",
        price: 65,
        tenPackPrice: 590,
        monthlyPrice: 340,
        distanceMiles: 4.1,
        coachingStyles: ["Calm"],
        venues: ["Remote"],
        qualifications: ["Level 3 Personal Training"],
        availability: ["Weekday evenings"],
        bio: "Practical strength coaching.",
      },
    },
    application: {
      approvalStatus: "approved",
      approvedProfileVersion: 3,
      identity: { email: "private@example.com" },
      approvedProfile: {
        primaryPhotoPath: photo,
        credentialsSubmitted: true,
        insurance: { expiresOn: "2027-01-01", policyNumber: "private-policy" },
        firstAid: { expiresOn: "2027-01-01", evidence: "private-file" },
        level3Qualification: { expiresOn: null, evidence: "private-file" },
        otherQualifications: [{ expiresOn: null }],
      },
    },
    account: { role: "trainer", status: "active", email: "private@example.com" },
  };
};

describe("approved trainer catalogue eligibility", () => {
  it("returns only approved public matching facts, excluding private evidence and placeholder distance", () => {
    const data = approvedData();
    const candidate = approvedWebTrainer(trainerId, data.published, data.application, data.account, now);
    expect(candidate).toMatchObject({
      profileVersion: 3,
      gender: "woman",
      idealClients: ["Beginners"],
      trainer: { id: trainerId, bio: "Practical strength coaching." },
    });
    expect(candidate?.trainer).not.toHaveProperty("distanceMiles");
    const serialized = JSON.stringify(candidate);
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("private-file");
    expect(serialized).not.toContain("private-policy");
  });

  it.each([
    ["trainer account role", "account", { role: "client" }],
    ["active account", "account", { status: "suspended" }],
    ["publication", "published", { published: false }],
    ["publication approval", "published", { approvalStatus: "pending" }],
    ["private suspension", "application", { approvalStatus: "suspended" }],
    ["approved version", "application", { approvedProfileVersion: 2 }],
    ["numeric profile version", "published", { profileVersion: "3" }],
    ["integer profile version", "published", { profileVersion: 3.5 }],
  ] as const)("requires %s", (_description, target, patch) => {
    const data = approvedData();
    Object.assign(data[target], patch);
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).toBeNull();
  });

  it("keeps an approved version available while a later private draft is awaiting review", () => {
    const data = approvedData();
    data.application.approvalStatus = "pending";
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).not.toBeNull();
  });

  it("uses newly approved practical facts even when the editorial web profile is older", () => {
    const data = approvedData();
    data.published.fullName = "Current Public Name";
    data.published.pricing.singleSessionPence = 8250;
    data.published.availability = [{ day: "tuesday", period: "morning" }];
    data.published.qualificationTitles = ["Current approved qualification"];
    data.published.primaryPhotoPath = `onboarding/${trainerId}/profile/current.webp`;
    data.application.approvedProfile.primaryPhotoPath = data.published.primaryPhotoPath;
    const candidate = approvedWebTrainer(trainerId, data.published, data.application, data.account, now);
    expect(candidate?.trainer).toMatchObject({
      name: "Current Public Name",
      photo: data.published.primaryPhotoPath,
      price: 82.5,
      availability: ["Tuesday mornings"],
      qualifications: ["Current approved qualification"],
      bio: "Practical strength coaching.",
    });
  });

  it.each([0, -1])("rejects a nonpositive profile version even when both snapshots agree: %s", (version) => {
    const data = approvedData();
    data.published.profileVersion = version;
    data.application.approvedProfileVersion = version;
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).toBeNull();
  });

  it.each(["credentialsSubmitted", "insurance", "level3Qualification"])("requires approved %s", (field) => {
    const data = approvedData();
    Object.assign(data.application.approvedProfile, { [field]: false });
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).toBeNull();
  });

  it.each(["insurance", "firstAid", "level3Qualification"])("rejects expired or invalid %s evidence", (field) => {
    for (const expiresOn of ["2026-09-04", "invalid", 123]) {
      const data = approvedData();
      Object.assign(data.application.approvedProfile, { [field]: { expiresOn } });
      expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).toBeNull();
    }
  });

  it("rejects an expired additional qualification while accepting the entire expiry day", () => {
    const data = approvedData();
    Object.assign(data.application.approvedProfile, { otherQualifications: [{ expiresOn: "2026-09-04" }] });
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).toBeNull();
    Object.assign(data.application.approvedProfile, { otherQualifications: [{ expiresOn: "2026-09-05" }] });
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).not.toBeNull();
  });

  it("rejects invalid profile data, a different trainer's media, and media absent from the approved snapshot", () => {
    const data = approvedData();
    expect(approvedWebTrainer("different-trainer", data.published, data.application, data.account, now)).toBeNull();
    data.published.webProfile.price = -1;
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).toBeNull();
    data.published.webProfile.price = 65;
    data.application.approvedProfile.primaryPhotoPath = "onboarding/someone-else/profile/photo.webp";
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).toBeNull();
  });

  it.each([
    `onboarding/${trainerId}/profile/`,
    "https://example.com/photo.webp",
    "onboarding/someone-else/profile/photo.webp",
    `onboarding/${trainerId}/profile/nested/photo.webp`,
    `onboarding/${trainerId}/profile/../identity.webp`,
  ])("rejects an unapproved media path shape even when all snapshots agree: %s", (photo) => {
    const data = approvedData();
    data.published.webProfile.photo = photo;
    data.published.primaryPhotoPath = photo;
    data.application.approvedProfile.primaryPhotoPath = photo;
    expect(approvedWebTrainer(trainerId, data.published, data.application, data.account, now)).toBeNull();
  });

  it("does not infer missing gender and trims previews to the pre-signup card fields", () => {
    const data = approvedData();
    const published = { ...data.published, gender: undefined };
    const candidate = approvedWebTrainer(trainerId, published, data.application, data.account, now)!;
    expect(candidate).not.toHaveProperty("gender");
    expect(Object.keys(trainerPreview(candidate.trainer)).sort()).toEqual([
      "area", "id", "name", "photo", "price", "specialty",
    ]);
  });
});
