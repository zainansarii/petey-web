import { CLUBS } from "../../third-space-shared/locations";

export const DEMO_END = "2026-09-25";
export const GOALS = ["Build strength", "Improve fitness", "Lose body fat", "Train for an event", "Build confidence"] as const;
export type Goal = typeof GOALS[number];
export type Period = 7 | 28 | 90;
export const ADMIN_CLUBS = CLUBS.map(({ id, name }) => ({ id, name }));

// All identities and performance are invented for this standalone demonstration.
const NAMES = ["Alex Morgan", "Jamie Reed", "Olivia Ellis", "Theo Brooks", "Sophie Bennett", "Noah Clarke", "Amelia Hayes", "Lucas Parker", "Maya Collins", "Ethan Foster", "Grace Taylor", "Leo Mitchell", "Isla Anderson", "Oscar James", "Ella Harrison", "Oliver Scott", "Ruby Wilson", "Finn Adams", "Freya Lewis", "Max Cooper", "Chloe Evans", "Hugo Wright", "Zara Walsh", "Sam Turner", "Ava Campbell", "Dylan Moore", "Lily Davies", "Ben Carter", "Nina Wood", "Tom Riley", "Emma Hughes", "Adam Walker"];
export const ADMIN_TRAINERS = ADMIN_CLUBS.flatMap((club, index) => [0, 1].map((position) => ({
  id: `${club.id}-${position}`, clubId: club.id, name: NAMES[index * 2 + position],
  specialty: GOALS[(index + position * 2) % GOALS.length],
})));
export type Trainer = typeof ADMIN_TRAINERS[number];
export interface Journey { id: string; date: string; clubId: string; goal: Goal; trainerIds: string[]; enquiryTrainerId: string | null }
export interface Summary { searches: number; enquiries: number; unmatched: number; conversion: number }
export interface GoalRow { goal: Goal; count: number; share: number; change: number; unmatched: number }
export interface ClubRow extends Summary { id: string; name: string }
export interface TrainerRow { id: string; name: string; clubId: string; recommendations: number; enquiries: number; conversion: number; topGoal: Goal }
export interface Gap { clubId: string; clubName: string; goal: Goal; searches: number; unmatched: number; rate: number }
export type Detail = { kind: "club"; id: string } | { kind: "trainer"; id: string } | { kind: "gap"; id: string; goal: Goal } | { kind: "goal"; goal: Goal };
export interface Insight { title: string; evidence: string; action: string; detail: Detail }

const DAY = 86_400_000;
const endTime = Date.parse(`${DEMO_END}T12:00:00Z`);
export function dateAt(daysAgo: number) { return new Date(endTime - daysAgo * DAY).toISOString().slice(0, 10); }
export function dateLabel(date: string) { return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }); }
export function periodLabel(period: Period) { return `${dateLabel(dateAt(period - 1))} – ${dateLabel(DEMO_END)} 2026`; }
export function rate(n: number, total: number) { return total ? n / total * 100 : 0; }
export function percent(value: number) { return `${value.toFixed(1)}%`; }
export function count(value: number) { return value.toLocaleString("en-GB"); }
export function change(current: number, previous: number) { return previous ? `${current >= previous ? "+" : "−"}${Math.abs((current - previous) / previous * 100).toFixed(1)}%` : "—"; }
export function points(value: number) { return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)} pp`; }

function createJourneys(): Journey[] {
  let seed = 4183;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const journeys: Journey[] = [];
  for (let daysAgo = 179; daysAgo >= 0; daysAgo--) {
    ADMIN_CLUBS.forEach((club, clubIndex) => {
      const volume = Math.floor((3 + (clubIndex * 7 % 5) + random() * 4) * (daysAgo < 28 ? 1.17 : 1));
      const trainers = ADMIN_TRAINERS.filter((trainer) => trainer.clubId === club.id);
      for (let j = 0; j < volume; j++) {
        const choice = random();
        const goal: Goal = club.id === "islington" && choice > .72 ? GOALS[4] : choice < (daysAgo < 28 ? .36 : .29) ? GOALS[0] : choice < .56 ? GOALS[1] : choice < .74 ? GOALS[2] : choice < .88 ? GOALS[3] : GOALS[4];
        const gap = club.id === "city" && goal === GOALS[0] ? .36 : club.id === "islington" && goal === GOALS[4] ? .4 : club.id === "canary-wharf" && goal === GOALS[3] ? .32 : .045 + clubIndex % 4 * .01;
        const trainerIds: string[] = [];
        if (random() > gap) {
          const primary = random() < .77 ? 0 : 1;
          trainerIds.push(trainers[primary].id);
          if (random() > .3) trainerIds.push(trainers[1 - primary].id);
        }
        const enquires = trainerIds.length && random() < (.29 + clubIndex % 5 * .025 + (daysAgo < 28 ? .05 : 0));
        const enquiryTrainerId = enquires ? trainerIds[random() < .6 ? 0 : trainerIds.length - 1] : null;
        journeys.push({ id: `${daysAgo}-${club.id}-${j}`, date: dateAt(daysAgo), clubId: club.id, goal, trainerIds, enquiryTrainerId });
      }
    });
  }
  return journeys;
}
export const JOURNEYS = createJourneys();

export function selectJourneys(period: Period, clubId: string, previous = false): Journey[] {
  const from = dateAt(previous ? period * 2 - 1 : period - 1);
  const to = previous ? dateAt(period) : DEMO_END;
  return JOURNEYS.filter((journey) => journey.date >= from && journey.date <= to && (clubId === "all" || journey.clubId === clubId));
}
export function summarise(journeys: Journey[]): Summary {
  const enquiries = journeys.filter((journey) => journey.enquiryTrainerId).length;
  return { searches: journeys.length, enquiries, unmatched: journeys.filter((journey) => !journey.trainerIds.length).length, conversion: rate(enquiries, journeys.length) };
}
export function goalsFor(journeys: Journey[], previous: Journey[] = []): GoalRow[] {
  return GOALS.map((goal) => {
    const matching = journeys.filter((journey) => journey.goal === goal);
    return { goal, count: matching.length, share: rate(matching.length, journeys.length), change: rate(matching.length, journeys.length) - rate(previous.filter((journey) => journey.goal === goal).length, previous.length), unmatched: matching.filter((journey) => !journey.trainerIds.length).length };
  }).sort((a, b) => b.count - a.count);
}
export function clubsFor(journeys: Journey[], clubId: string): ClubRow[] {
  return ADMIN_CLUBS.filter((club) => clubId === "all" || club.id === clubId).map((club) => ({ ...club, ...summarise(journeys.filter((journey) => journey.clubId === club.id)) })).sort((a, b) => b.searches - a.searches);
}
export function trainersFor(journeys: Journey[], clubId: string): TrainerRow[] {
  return ADMIN_TRAINERS.filter((trainer) => clubId === "all" || trainer.clubId === clubId).map((trainer) => {
    const matching = journeys.filter((journey) => journey.trainerIds.includes(trainer.id));
    const enquiries = matching.filter((journey) => journey.enquiryTrainerId === trainer.id).length;
    return { ...trainer, recommendations: matching.length, enquiries, conversion: rate(enquiries, matching.length), topGoal: goalsFor(matching)[0].goal };
  }).sort((a, b) => b.enquiries - a.enquiries);
}
export function gapsFor(journeys: Journey[]): Gap[] {
  return ADMIN_CLUBS.flatMap((club) => GOALS.map((goal) => {
    const matching = journeys.filter((journey) => journey.clubId === club.id && journey.goal === goal);
    const unmatched = matching.filter((journey) => !journey.trainerIds.length).length;
    return { clubId: club.id, clubName: club.name, goal, searches: matching.length, unmatched, rate: rate(unmatched, matching.length) };
  })).filter((gap) => gap.searches >= 20 && gap.unmatched > 0).sort((a, b) => b.rate - a.rate || b.unmatched - a.unmatched);
}
export function trendFor(journeys: Journey[], period: Period, trainerId?: string) {
  const bins = period === 7 ? 7 : period === 28 ? 4 : 6;
  const size = period / bins;
  return Array.from({ length: bins }, (_, index) => {
    const from = dateAt(period - 1 - index * size);
    const to = dateAt(period - (index + 1) * size);
    const matching = journeys.filter((journey) => journey.date >= from && journey.date <= to);
    const enquiries = matching.filter((journey) => trainerId ? journey.enquiryTrainerId === trainerId : journey.enquiryTrainerId).length;
    return { label: dateLabel(from), searches: matching.length, enquiries, conversion: rate(enquiries, matching.length), unmatched: matching.filter((journey) => !journey.trainerIds.length).length };
  });
}
export function insightsFor(journeys: Journey[], previous: Journey[], clubId: string): Insight[] {
  const gap = gapsFor(journeys)[0];
  const growing = [...goalsFor(journeys, previous)].sort((a, b) => b.change - a.change)[0];
  const trainers = trainersFor(journeys, clubId);
  const meanExposure = trainers.reduce((sum, trainer) => sum + trainer.recommendations, 0) / trainers.length;
  const underexposed = trainers.filter((trainer) => trainer.recommendations >= 20 && trainer.recommendations < meanExposure).sort((a, b) => b.conversion - a.conversion)[0];
  const bestClub = clubsFor(journeys, clubId).sort((a, b) => b.conversion - a.conversion)[0];
  const insights: Insight[] = [];
  if (gap) insights.push({ title: `${gap.clubName}: a gap in ${gap.goal.toLowerCase()}`, evidence: `${gap.unmatched} of ${gap.searches} searches received no match.`, action: "Review trainer coverage", detail: { kind: "gap", id: gap.clubId, goal: gap.goal } });
  if (growing) insights.push({ title: `${growing.goal} ${growing.change > 0 ? "is gaining interest" : "leads the demand review"}`, evidence: `${percent(growing.share)} of searches · ${points(growing.change)} vs previous period.`, action: "Explore member demand", detail: { kind: "goal", goal: growing.goal } });
  if (underexposed) insights.push({ title: `${underexposed.name}: worth a closer look`, evidence: `${underexposed.enquiries} enquiries from ${underexposed.recommendations} recommendations, with below-average exposure in this view.`, action: "Explore trainer performance", detail: { kind: "trainer", id: underexposed.id } });
  else if (bestClub) insights.push({ title: `${bestClub.name}: follow the enquiries`, evidence: `${bestClub.enquiries} enquiries from ${bestClub.searches} searches (${percent(bestClub.conversion)}).`, action: "Explore club performance", detail: { kind: "club", id: bestClub.id } });
  return insights;
}
