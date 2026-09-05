import { orderTrainersFor, TRAINERS } from "./trainers";

describe("demo trainer catalogue", () => {
  it("keeps all eight demo profiles in a stable, neutral order", () => {
    expect(orderTrainersFor().map(({ id }) => id)).toEqual([
      "maya-chen",
      "marcus-adebayo",
      "aliyah-rahman",
      "rohan-kapoor",
      "leanne-brooks",
      "john-kim",
      "aleem-malik",
      "yasmin-okafor",
    ]);
  });

  it("returns a fresh list without parsing or ranking onboarding notes", () => {
    const ordered = orderTrainersFor();
    ordered.reverse();
    expect(orderTrainersFor()).toEqual(TRAINERS);
  });

  it("bundles only public demo card data in the landing carousel", () => {
    expect(TRAINERS.every((trainer) => trainer.isDemo === true)).toBe(true);
    expect(TRAINERS.every((trainer) => !("bio" in trainer) && !("availability" in trainer))).toBe(true);
  });
});
