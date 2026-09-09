import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { approvedFormWebTrainer, approvedWebTrainer, loadWebTrainerCatalog, trainerPreview } from "./webTrainerCatalog.js";

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


const formId = `form_${"a".repeat(64)}`;
const formData = () => {
  const photo = `web-trainer-applications/${formId}/revisions/2/profile-${"b".repeat(64)}.webp`;
  return {
    published: {
      source: "google_form", applicationId: formId, trainerId: formId,
      published: true, approvalStatus: "approved", profileVersion: 4,
      acceptingNewClients: true, availableFrom: null, verificationExpiresOn: "2099-01-01",
      gender: "Woman",
      profile: {
        ...approvedData().published.webProfile, id: formId, photo,
        sessionDurationMinutes: 45, tenPackPrice: null, monthlyPrice: null,
        pricingNotes: "£65 per 45-minute session; travel within N1 included.",
        serviceAreaNotes: "Islington N1 and online. Gym membership is required at the venue.",
        availabilityNotes: "Monday and Wednesday 6–9pm, UK time.",
        coachingStyleNotes: "Calm coaching with clear explanations and regular check-ins.",
        experience: "3–5 years", professionalUrl: "https://example.com/coach",
      },
    },
    application: {
      status: "approved", publishedVersion: 4, publishedPhotoPath: photo,
      email: "private@example.com", verification: { policy: "private-policy" },
      reviewDraft: { bio: "Never display this unreviewed correction." },
    },
  };
};

describe("manually verified form catalogue eligibility", () => {
  it("returns the approved snapshot and exact practical notes without private data or ungrounded distance", () => {
    const data = formData();
    const candidate = approvedFormWebTrainer(formId, data.published, data.application, now)!;
    expect(candidate.trainer).toMatchObject({
      id: formId, sessionDurationMinutes: 45, tenPackPrice: null,
      availabilityNotes: data.published.profile.availabilityNotes,
      pricingNotes: data.published.profile.pricingNotes,
    });
    expect(candidate.trainer).not.toHaveProperty("distanceMiles");
    for (const secret of ["private@example.com", "private-policy", "unreviewed correction"]) {
      expect(JSON.stringify(candidate)).not.toContain(secret);
    }
  });

  it.each([
    ["source", "published", { source: "mobile" }],
    ["id", "published", { applicationId: "different" }],
    ["trainer id", "published", { trainerId: "different" }],
    ["publication", "published", { published: false }],
    ["approval", "published", { approvalStatus: "suspended" }],
    ["private suspension", "application", { status: "suspended" }],
    ["version", "application", { publishedVersion: 3 }],
    ["positive version", "published", { profileVersion: 0 }],
    ["integer version", "published", { profileVersion: 1.5 }],
    ["approved photo", "application", { publishedPhotoPath: "other" }],
    ["capacity", "published", { acceptingNewClients: false }],
    ["future start", "published", { availableFrom: "2026-09-06" }],
    ["unconfirmed start", "published", { availableFrom: undefined }],
    ["invalid start", "published", { availableFrom: "2026-02-30" }],
    ["expired checks", "published", { verificationExpiresOn: "2026-09-04" }],
    ["invalid expiry", "published", { verificationExpiresOn: "2026-02-30" }],
    ["missing expiry", "published", { verificationExpiresOn: null }],
  ] as const)("requires %s", (_label, target, patch) => {
    const data = formData();
    Object.assign(data[target], patch);
    expect(approvedFormWebTrainer(formId, data.published, data.application, now)).toBeNull();
  });

  it("keeps the approved snapshot while a changed application awaits review", () => {
    const data = formData();
    data.application.status = "pending_review";
    expect(approvedFormWebTrainer(formId, data.published, data.application, now)?.trainer.bio)
      .toBe(data.published.profile.bio);
  });

  it("accepts the complete expiry day and the confirmed start date", () => {
    const data = formData();
    Object.assign(data.published, { verificationExpiresOn: "2026-09-05", availableFrom: "2026-09-05" });
    expect(approvedFormWebTrainer(formId, data.published, data.application, now)).not.toBeNull();
    expect(approvedFormWebTrainer(formId, data.published, data.application, new Date("2026-09-06T00:00:00Z"))).toBeNull();
  });

  it.each([
    `web-trainer-applications/another/revisions/2/profile-${"b".repeat(64)}.webp`,
    `web-trainer-applications/${formId}/revisions/0/profile-${"b".repeat(64)}.webp`,
    `web-trainer-applications/${formId}/revisions/2/profile-not-a-hash.webp`,
    `web-trainer-applications/${formId}/revisions/2/../profile-${"b".repeat(64)}.webp`,
    "https://example.com/photo.webp",
  ])("rejects an unapproved media object shape: %s", (photo) => {
    const data = formData();
    data.published.profile.photo = photo;
    data.application.publishedPhotoPath = photo;
    expect(approvedFormWebTrainer(formId, data.published, data.application, now)).toBeNull();
  });
});

function catalogDb(entries: Record<string, Record<string, unknown>>) {
  const reads: string[] = [];
  const snapshot = (path: string) => ({
    id: path.split("/").at(-1)!, exists: Object.hasOwn(entries, path), data: () => entries[path],
  });
  const db = {
    collection(name: string) {
      reads.push(name);
      const query = {
        doc: (id: string) => ({ get: async () => snapshot(`${name}/${id}`) }),
        where: () => query,
        limit: (count: number) => ({ get: async () => ({ docs: Object.keys(entries)
          .filter((path) => path.startsWith(`${name}/`) && entries[path]!.published === true)
          .slice(0, count).map(snapshot) }) }),
      };
      return query;
    },
  } as unknown as Firestore;
  return { db, reads };
}

describe("combined web catalogue loading", () => {
  it("loads both approved sources, with no account requirement for form applications", async () => {
    const legacy = approvedData();
    Object.assign(legacy.application.approvedProfile, {
      insurance: { expiresOn: "2099-01-01" }, firstAid: { expiresOn: "2099-01-01" },
    });
    const form = formData();
    const { db, reads } = catalogDb({
      [`publicTrainers/${trainerId}`]: legacy.published,
      [`trainerProfiles/${trainerId}`]: legacy.application,
      [`accounts/${trainerId}`]: legacy.account,
      [`webTrainerCatalog/${formId}`]: form.published,
      [`webTrainerApplications/${formId}`]: form.application,
    });
    const candidates = await loadWebTrainerCatalog(db, undefined, undefined, true);
    expect(candidates.map(({ trainer }) => trainer.id)).toEqual([formId, trainerId].sort());
    expect(reads.filter((name) => name === "accounts")).toHaveLength(1);
  });

  it("respects the rollback flag and never reads form-backed data while disabled", async () => {
    const { db, reads } = catalogDb({ [`webTrainerCatalog/${formId}`]: formData().published });
    expect(await loadWebTrainerCatalog(db, undefined, undefined, false)).toEqual([]);
    expect(reads).not.toContain("webTrainerCatalog");
  });

  it("filters blocked forms, deduplicates requested IDs and retains exact approved versions", async () => {
    const form = formData();
    const entries = {
      [`webTrainerCatalog/${formId}`]: form.published,
      [`webTrainerApplications/${formId}`]: form.application,
    };
    const { db } = catalogDb(entries);
    expect(await loadWebTrainerCatalog(db, [formId, formId], undefined, true)).toHaveLength(1);
    const blocked = catalogDb({ ...entries, [`blocks/${["client-one", formId].sort().join("_")}`]: {} });
    expect(await loadWebTrainerCatalog(blocked.db, [formId], "client-one", true)).toEqual([]);
  });

  it("fails explicitly when the total of both sources exceeds 500", async () => {
    const entries = Object.fromEntries(Array.from({ length: 501 }, (_, index) => [
      `${index < 250 ? "publicTrainers" : "webTrainerCatalog"}/trainer-${index}`, { published: true },
    ]));
    await expect(loadWebTrainerCatalog(catalogDb(entries).db, undefined, undefined, true))
      .rejects.toMatchObject({ code: "resource-exhausted" });
  });
});
