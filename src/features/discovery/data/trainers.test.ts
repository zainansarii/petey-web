import { INITIAL_MATCHING_ANSWERS, type MatchingAnswers } from "../../onboarding/model/onboarding";
import { matchReasonFor, orderTrainersFor, TRAINERS } from "./trainers";

const answersWith = (patch: Partial<MatchingAnswers>): MatchingAnswers => ({
  ...INITIAL_MATCHING_ANSWERS,
  ...patch,
});

describe("trainer matching", () => {
  it("includes all four demo trainer profiles in carousel order", () => {
    expect(TRAINERS.map(({ id }) => id)).toEqual([
      "maya-chen",
      "marcus-adebayo",
      "aliyah-rahman",
      "rohan-kapoor",
    ]);
  });

  it("scores every matching preference instead of relying on goal alone", () => {
    const firstTrainerId = (patch: Partial<MatchingAnswers>) => (
      orderTrainersFor(answersWith(patch))[0].id
    );

    expect(firstTrainerId({ goal: "build_muscle" })).toBe("marcus-adebayo");
    expect(firstTrainerId({ coachingStyle: "data_and_metrics" })).toBe("marcus-adebayo");
    expect(firstTrainerId({ budget: "gbp_400_600" })).toBe("marcus-adebayo");
    expect(firstTrainerId({ trainerGenders: ["man"] })).toBe("marcus-adebayo");
    expect(firstTrainerId({ venues: ["commercial_gym"] })).toBe("marcus-adebayo");
    expect(firstTrainerId({ experience: "advanced" })).toBe("marcus-adebayo");

    expect(firstTrainerId({
      budget: "gbp_400_600",
      postcode: "SW11 3AA",
      travelKm: 5,
    })).toBe("maya-chen");
  });

  it("ranks Maya first for compatible beginner, venue, gender, style, and budget preferences", () => {
    const trainers = orderTrainersFor(answersWith({
      budget: "gbp_250_400",
      coachingStyle: "gentle_encouragement",
      experience: "beginner",
      goal: "lose_weight",
      postcode: "SW11 3AA",
      trainerGenders: ["woman"],
      travelKm: 5,
      venues: ["outdoors"],
    }));

    expect(trainers.map(({ id }) => id)).toEqual([
      "maya-chen",
      "aliyah-rahman",
      "rohan-kapoor",
      "marcus-adebayo",
    ]);
  });

  it("ranks Marcus first for compatible advanced strength preferences", () => {
    const trainers = orderTrainersFor(answersWith({
      budget: "gbp_400_600",
      coachingStyle: "data_and_metrics",
      experience: "advanced",
      goal: "build_muscle",
      postcode: "E1 6AN",
      trainerGenders: ["man"],
      travelKm: 5,
      venues: ["commercial_gym"],
    }));

    expect(trainers.map(({ id }) => id)).toEqual([
      "marcus-adebayo",
      "rohan-kapoor",
      "aliyah-rahman",
      "maya-chen",
    ]);
  });

  it("keeps every demo trainer even when one conflicts with the preferences", () => {
    const trainers = orderTrainersFor(answersWith({
      trainerGenders: ["woman"],
      venues: ["outdoors"],
    }));

    expect(trainers).toHaveLength(TRAINERS.length);
    expect(new Set(trainers.map(({ id }) => id))).toEqual(new Set(TRAINERS.map(({ id }) => id)));
  });

  it("ranks and describes only exact availability overlap", () => {
    const answers = answersWith({ availability: ["Mon-Lunch"] });
    const trainers = orderTrainersFor(answers);

    expect(trainers.map(({ id }) => id)).toEqual([
      "marcus-adebayo",
      "aliyah-rahman",
      "maya-chen",
      "rohan-kapoor",
    ]);
    expect(matchReasonFor(trainers[0], answers)).toBe("Schedule overlap");
    const maya = trainers.find(({ id }) => id === "maya-chen")!;
    expect(matchReasonFor(maya, answers)).not.toMatch(/schedule/i);
  });

  it("matches the new trainers' distinct coaching styles", () => {
    const gentleAnswers = answersWith({ coachingStyle: "gentle_encouragement" });
    const funAnswers = answersWith({ coachingStyle: "fun" });
    const aliyah = TRAINERS.find(({ id }) => id === "aliyah-rahman")!;
    const rohan = TRAINERS.find(({ id }) => id === "rohan-kapoor")!;

    expect(matchReasonFor(aliyah, gentleAnswers)).toBe("Calm coaching");
    expect(matchReasonFor(rohan, funAnswers)).toBe("High-energy coaching");
  });

  it("only names a coaching style when the trainer actually has a compatible style", () => {
    const answers = answersWith({ coachingStyle: "data_and_metrics" });
    const maya = TRAINERS.find(({ id }) => id === "maya-chen")!;
    const marcus = TRAINERS.find(({ id }) => id === "marcus-adebayo")!;

    expect(matchReasonFor(maya, answers)).toBe("Running & endurance near Battersea");
    expect(matchReasonFor(marcus, answers)).toBe("Data-driven coaching");
  });

  it("does not claim an over-budget trainer is within budget", () => {
    const answers = answersWith({ budget: "gbp_250_400" });
    const maya = TRAINERS.find(({ id }) => id === "maya-chen")!;
    const marcus = TRAINERS.find(({ id }) => id === "marcus-adebayo")!;

    expect(matchReasonFor(maya, answers)).toBe("Within budget");
    expect(matchReasonFor(marcus, answers)).not.toMatch(/budget/i);
  });
});
