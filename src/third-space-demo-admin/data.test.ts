import { ADMIN_CLUBS, ADMIN_TRAINERS, JOURNEYS, clubsFor, gapsFor, goalsFor, selectJourneys, summarise, trainersFor, trendFor, type Period } from "./data";

describe("Third Space sample reporting", () => {
  it("keeps enquiries attributable to recommended trainers and never to unmatched searches", () => {
    expect(new Set(JOURNEYS.map((row) => row.id)).size).toBe(JOURNEYS.length);
    for (const row of JOURNEYS) {
      expect(new Set(row.trainerIds).size).toBe(row.trainerIds.length);
      if (row.enquiryTrainerId) expect(row.trainerIds).toContain(row.enquiryTrainerId);
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

  it("scopes both comparison periods and all breakdowns to the selected club", () => {
    for (const club of ADMIN_CLUBS) {
      const current = selectJourneys(28, club.id);
      const previous = selectJourneys(28, club.id, true);
      expect(current.length).toBeGreaterThan(0);
      expect([...current, ...previous].every((row) => row.clubId === club.id)).toBe(true);
      expect(clubsFor(current, club.id)).toHaveLength(1);
      expect(trainersFor(current, club.id).every((row) => row.clubId === club.id)).toBe(true);
      expect(gapsFor(current).every((row) => row.clubId === club.id)).toBe(true);
    }
  });
});
