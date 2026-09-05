import { describe, expect, it } from "vitest";
import seed from "../scripts/demo-web-trainers.json";
import { trainerSchema } from "../../src/features/discovery/model/trainer.js";
import { projectWebTrainer } from "./webTrainerProjection.js";

const webProfile = trainerSchema.parse(seed[0]);
const currentPublic = {
  trainerId: webProfile.id, fullName: "Maya Updated",
  primaryPhotoPath: `onboarding/${webProfile.id}/profile/new.png`, homeAreaLabel: "SW11",
  specialties: ["strength", "mobility"], venues: ["remote"],
  coachingStyles: ["calm"], qualificationTitles: ["New approved qualification"],
  availability: [{ day: "tuesday", period: "afternoon" }],
  pricing: { singleSessionPence: 8250, tenPackPence: null, monthlyCoachingPence: 50000 },
};

describe("approved web trainer projection", () => {
  it("updates all practical data after reapproval and preserves the editorial biography", () => {
    expect(projectWebTrainer(currentPublic, { ...webProfile, distanceMiles: 6 })).toEqual({
      ...webProfile, name: "Maya Updated", photo: currentPublic.primaryPhotoPath,
      specialty: "Strength", specialties: ["Mobility"], price: 82.5, tenPackPrice: null,
      monthlyPrice: 500, coachingStyles: ["Calm"], venues: ["Remote"],
      qualifications: ["New approved qualification"], availability: ["Tuesday afternoons"],
    });
  });

  it("removes a stale town label when the approved home area changes", () => {
    expect(projectWebTrainer({ ...currentPublic, homeAreaLabel: "N1" }, webProfile)?.area).toBe("N1");
  });

  it("does not guess unknown enums, missing package prices or unsupported time slots", () => {
    const result = projectWebTrainer({
      ...currentPublic, venues: ["some_new_venue"], coachingStyles: ["unknown"],
      availability: [{ day: "monday", period: "overnight" }],
      pricing: { singleSessionPence: 7000 },
    }, webProfile);
    expect(result).toMatchObject({ venues: [], coachingStyles: [], availability: [], tenPackPrice: null, monthlyPrice: null });
    expect(projectWebTrainer({ ...currentPublic, specialties: ["unknown"] }, webProfile)).toBeNull();
    expect(projectWebTrainer({ ...currentPublic, pricing: {} }, webProfile)).toBeNull();
  });
});
