import { matchReasonFor, orderTrainersFor, TRAINERS } from "./trainers";

describe("demo trainer catalogue", () => {
  it("keeps all four demo profiles in a stable, neutral order", () => {
    expect(orderTrainersFor().map(({ id }) => id)).toEqual([
      "maya-chen",
      "marcus-adebayo",
      "aliyah-rahman",
      "rohan-kapoor",
    ]);
  });

  it("returns a fresh list without parsing or ranking onboarding notes", () => {
    const ordered = orderTrainersFor();
    ordered.reverse();
    expect(orderTrainersFor()).toEqual(TRAINERS);
  });

  it("describes only catalogue facts rather than claiming a personalised match", () => {
    const marcus = TRAINERS.find(({ id }) => id === "marcus-adebayo")!;
    expect(matchReasonFor(marcus)).toBe("Strength · Data-driven");
    expect(matchReasonFor(marcus)).not.toMatch(/match|goal|budget|schedule/i);
  });
});
