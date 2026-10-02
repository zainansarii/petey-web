import { ADMIN_CLUBS, ADMIN_TRAINERS, JOURNEYS, SAMPLE_CLUB_IDS, insightsFor, clubsFor, gapsFor, goalsFor, selectJourneys, summarise, trainersFor, trendFor, type Period } from "./data";

describe("Gymbox sample reporting", () => {
  it("uses the consumer demo's ten identities with the intended club assignments", () => {
    expect(ADMIN_TRAINERS.map(({ name }) => name)).toEqual([
      "Emma Carter", "Daniel Reed", "Amira Hassan", "Lucas Bennett", "Sophie Morgan",
      "Nathan Cole", "Isabel Ross", "Adam Khan", "Grace Ellis", "Theo Parker",
    ]);
    expect(ADMIN_TRAINERS.map(({ clubId }) => clubId)).toEqual([
      "bank", "bank", "bank", "farringdon", "farringdon", "bank", "farringdon", "farringdon", "bank", "farringdon",
    ]);
    expect(ADMIN_TRAINERS.every(({ id }) => JOURNEYS.some(({ trainerIds }) => trainerIds.includes(id)))).toBe(true);
  });

  it("keeps enquiries attributable to recommended trainers and never to unmatched searches", () => {
    expect(new Set(JOURNEYS.map((row) => row.id)).size).toBe(JOURNEYS.length);
    for (const row of JOURNEYS) {
      expect(new Set(row.trainerIds).size).toBe(row.trainerIds.length);
      if (row.enquiryIntentTrainerId) expect(row.trainerIds).toContain(row.enquiryIntentTrainerId);
      expect(row.trainerIds.every((id) => ADMIN_TRAINERS.some((trainer) => trainer.id === id && trainer.clubId === row.clubId))).toBe(true);
    }
  });

  it.each([7, 28, 90] as Period[])("reconciles every club, trainer and trend to the %i-day headline figures", (period) => {
    const current = selectJourneys(period, "all");
    const previous = selectJourneys(period, "all", true);
    expect(new Set(current.map((row) => row.date)).size).toBe(period);
    expect(new Set(previous.map((row) => row.date)).size).toBe(period);
    const previousIds = new Set(previous.map((row) => row.id));
    expect(current.some((row) => previousIds.has(row.id))).toBe(false);
    const summary = summarise(current);
    const clubs = clubsFor(current, "all");
    const trainers = trainersFor(current, "all");
    const trend = trendFor(current, period);
    expect(clubs.reduce((sum, row) => sum + row.searches, 0)).toBe(summary.searches);
    expect(clubs.reduce((sum, row) => sum + row.unmatched, 0)).toBe(summary.unmatched);
    expect(trainers.reduce((sum, row) => sum + row.enquiries, 0)).toBe(summary.enquiries);
    expect(trend.reduce((sum, row) => sum + row.enquiries, 0)).toBe(summary.enquiries);
    expect(trend.reduce((sum, row) => sum + row.searches, 0)).toBe(summary.searches);
    expect(goalsFor(current).reduce((sum, row) => sum + row.count, 0)).toBe(summary.searches);
  });

  it.each([7, 28, 90] as Period[])("scopes both comparison periods and all breakdowns to each club over %i days", (period) => {
    for (const club of ADMIN_CLUBS) {
      const current = selectJourneys(period, club.id);
      const previous = selectJourneys(period, club.id, true);
      if (SAMPLE_CLUB_IDS.includes(club.id)) expect(current.length).toBeGreaterThan(0);
      else {
        expect(current).toEqual([]);
        expect(previous).toEqual([]);
        expect(trainersFor(current, club.id)).toEqual([]);
        expect(insightsFor(current, previous, club.id)).toEqual([]);
      }
      expect([...current, ...previous].every((row) => row.clubId === club.id)).toBe(true);
      expect(clubsFor(current, club.id)).toHaveLength(1);
      expect(trainersFor(current, club.id).every((row) => row.clubId === club.id)).toBe(true);
      expect(gapsFor(current).every((row) => row.clubId === club.id)).toBe(true);
    }
  });
});

it("counts each completed search once even if an event is repeated", () => {
  const selected = selectJourneys(28, "bank");
  const repeated = [...selected, ...selected];
  expect(summarise(repeated)).toEqual(summarise(selected));
  expect(goalsFor(repeated)).toEqual(goalsFor(selected));
  expect(trainersFor(repeated, "bank")).toEqual(trainersFor(selected, "bank"));
  expect(trendFor(repeated, 28)).toEqual(trendFor(selected, 28));
  const expectedIntent = new Set(selected.filter((row) => row.enquiryIntentTrainerId).map((row) => row.id)).size;
  expect(summarise(repeated).conversion).toBe(expectedIntent / selected.length * 100);
});

it("shows all ten clubs, with eight having no synthetic trainer coverage", () => {
  expect(ADMIN_CLUBS).toHaveLength(10);
  expect(SAMPLE_CLUB_IDS.sort()).toEqual(["bank", "farringdon"]);
  expect(ADMIN_CLUBS.filter(({ id }) => !SAMPLE_CLUB_IDS.includes(id))).toHaveLength(8);
});
