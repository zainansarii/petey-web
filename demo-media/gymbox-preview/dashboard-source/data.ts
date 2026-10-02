import { CLUBS } from "./shared/locations";
import { TRAINERS } from "./shared/catalogue";

export const DEMO_END = "2026-10-02";
export const GOALS = ["Build strength", "Improve fitness", "Lose body fat", "Train for an event", "Build confidence"] as const;
export type Goal = typeof GOALS[number];
export type Period = 7 | 28 | 90;
export const ADMIN_CLUBS = CLUBS.map(({ id, name }) => ({ id, name }));

// Share the consumer catalogue so every sample recommendation has a real demo profile.
export const ADMIN_TRAINERS = TRAINERS.map((trainer) => ({
  id: trainer.id, clubId: trainer.clubIds[0], name: trainer.name,
  specialty: trainer.expertise[0], photoUrl: trainer.photoUrl, expertise: trainer.expertise,
}));
export const SAMPLE_CLUB_IDS = [...new Set(ADMIN_TRAINERS.map((trainer) => trainer.clubId))];
export type Trainer = typeof ADMIN_TRAINERS[number];
// One synthetic completed search. Intent simulates interest; no enquiry is delivered.
export interface Journey { id: string; date: string; clubId: string; goal: Goal; trainerIds: string[]; enquiryIntentTrainerId: string | null }
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
  let seed = 20261002;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const journeys: Journey[] = [];
  for (let daysAgo = 179; daysAgo >= 0; daysAgo--) {
    ADMIN_CLUBS.filter((club) => SAMPLE_CLUB_IDS.includes(club.id)).forEach((club, clubIndex) => {
      const volume = Math.floor((22 + (clubIndex * 7 % 5) + random() * 10) * (daysAgo < 28 ? 1.17 : 1));
      const trainers = ADMIN_TRAINERS.filter((trainer) => trainer.clubId === club.id);
      for (let j = 0; j < volume; j++) {
        const choice = random();
        const goal: Goal = club.id === "bank" && choice > .72 ? GOALS[4] : choice < (daysAgo < 28 ? .36 : .29) ? GOALS[0] : choice < .56 ? GOALS[1] : choice < .74 ? GOALS[2] : choice < .88 ? GOALS[3] : GOALS[4];
        const gap = club.id === "bank" && goal === GOALS[4] ? .24 : club.id === "farringdon" && goal === GOALS[3] ? .18 : .045 + clubIndex % 4 * .01;
        const trainerIds: string[] = [];
        if (random() > gap) {
          const primary = random() < .45 ? 0 : Math.floor(random() * trainers.length);
          trainerIds.push(trainers[primary].id);
          for (let offset = 1; offset < Math.min(3, trainers.length); offset++) {
            if (random() > .3) trainerIds.push(trainers[(primary + offset) % trainers.length].id);
          }
        }
        const hasIntent = trainerIds.length && random() < (.29 + clubIndex % 5 * .025 + (daysAgo < 28 ? .05 : 0));
        const enquiryIntentTrainerId = hasIntent ? trainerIds[random() < .6 ? 0 : trainerIds.length - 1] : null;
        journeys.push({ id: `${daysAgo}-${club.id}-${j}`, date: dateAt(daysAgo), clubId: club.id, goal, trainerIds, enquiryIntentTrainerId });
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
export function uniqueSearches(journeys: Journey[]): Journey[] {
  return [...new Map(journeys.map((journey) => [journey.id, journey])).values()];
}
export function summarise(journeys: Journey[]): Summary {
  journeys = uniqueSearches(journeys);
  const enquiries = journeys.filter((journey) => journey.enquiryIntentTrainerId).length;
  return { searches: journeys.length, enquiries, unmatched: journeys.filter((journey) => !journey.trainerIds.length).length, conversion: rate(enquiries, journeys.length) };
}
export function goalsFor(journeys: Journey[], previous: Journey[] = []): GoalRow[] {
  journeys = uniqueSearches(journeys);
  previous = uniqueSearches(previous);
  return GOALS.map((goal) => {
    const matching = journeys.filter((journey) => journey.goal === goal);
    return { goal, count: matching.length, share: rate(matching.length, journeys.length), change: rate(matching.length, journeys.length) - rate(previous.filter((journey) => journey.goal === goal).length, previous.length), unmatched: matching.filter((journey) => !journey.trainerIds.length).length };
  }).sort((a, b) => b.count - a.count);
}
export function clubsFor(journeys: Journey[], clubId: string): ClubRow[] {
  journeys = uniqueSearches(journeys);
  return ADMIN_CLUBS.filter((club) => clubId === "all" || club.id === clubId).map((club) => ({ ...club, ...summarise(journeys.filter((journey) => journey.clubId === club.id)) })).sort((a, b) => b.searches - a.searches);
}
export function trainersFor(journeys: Journey[], clubId: string): TrainerRow[] {
  journeys = uniqueSearches(journeys);
  return ADMIN_TRAINERS.filter((trainer) => clubId === "all" || trainer.clubId === clubId).map((trainer) => {
    const matching = journeys.filter((journey) => journey.trainerIds.includes(trainer.id));
    const enquiries = matching.filter((journey) => journey.enquiryIntentTrainerId === trainer.id).length;
    return { ...trainer, recommendations: matching.length, enquiries, conversion: rate(enquiries, matching.length), topGoal: goalsFor(matching)[0].goal };
  }).sort((a, b) => b.enquiries - a.enquiries);
}
export function gapsFor(journeys: Journey[]): Gap[] {
  journeys = uniqueSearches(journeys);
  return ADMIN_CLUBS.flatMap((club) => GOALS.map((goal) => {
    const matching = journeys.filter((journey) => journey.clubId === club.id && journey.goal === goal);
    const unmatched = matching.filter((journey) => !journey.trainerIds.length).length;
    return { clubId: club.id, clubName: club.name, goal, searches: matching.length, unmatched, rate: rate(unmatched, matching.length) };
  })).filter((gap) => gap.searches >= 20 && gap.unmatched > 0).sort((a, b) => b.rate - a.rate || b.unmatched - a.unmatched);
}
export function trendFor(journeys: Journey[], period: Period, trainerId?: string) {
  journeys = uniqueSearches(journeys);
  const bins = period === 7 ? 7 : period === 28 ? 4 : 6;
  const size = period / bins;
  return Array.from({ length: bins }, (_, index) => {
    const from = dateAt(period - 1 - index * size);
    const to = dateAt(period - (index + 1) * size);
    const matching = journeys.filter((journey) => journey.date >= from && journey.date <= to);
    const enquiries = matching.filter((journey) => trainerId ? journey.enquiryIntentTrainerId === trainerId : journey.enquiryIntentTrainerId).length;
    return { label: dateLabel(from), searches: matching.length, enquiries, conversion: rate(enquiries, matching.length), unmatched: matching.filter((journey) => !journey.trainerIds.length).length };
  });
}
export function insightsFor(journeys: Journey[], previous: Journey[], clubId: string): Insight[] {
  journeys = uniqueSearches(journeys);
  if (!journeys.length) return [];
  const gap = gapsFor(journeys)[0];
  const growing = [...goalsFor(journeys, previous)].sort((a, b) => b.change - a.change)[0];
  const trainers = trainersFor(journeys, clubId);
  const meanExposure = trainers.reduce((sum, trainer) => sum + trainer.recommendations, 0) / (trainers.length || 1);
  const underexposed = trainers.filter((trainer) => trainer.recommendations >= 20 && trainer.recommendations < meanExposure).sort((a, b) => b.conversion - a.conversion)[0];
  const bestClub = clubsFor(journeys, clubId).sort((a, b) => b.conversion - a.conversion)[0];
  const insights: Insight[] = [];
  if (gap) insights.push({ title: `${gap.clubName}: a gap in ${gap.goal.toLowerCase()}`, evidence: `${gap.unmatched} of ${gap.searches} searches received no match.`, action: "Review trainer coverage", detail: { kind: "gap", id: gap.clubId, goal: gap.goal } });
  if (growing) insights.push({ title: `${growing.goal} ${growing.change > 0 ? "is gaining interest" : "leads the demand review"}`, evidence: `${percent(growing.share)} of searches · ${points(growing.change)} vs previous period.`, action: "Explore member demand", detail: { kind: "goal", goal: growing.goal } });
  if (underexposed) insights.push({ title: `${underexposed.name}: worth a closer look`, evidence: `${underexposed.enquiries} searches with enquiry intent from ${underexposed.recommendations} recommendations, with below-average exposure in this view.`, action: "Explore trainer performance", detail: { kind: "trainer", id: underexposed.id } });
  else if (bestClub) insights.push({ title: `${bestClub.name}: follow the enquiry intent`, evidence: `${bestClub.enquiries} searches with enquiry intent from ${bestClub.searches} searches (${percent(bestClub.conversion)}).`, action: "Explore club performance", detail: { kind: "club", id: bestClub.id } });
  return insights;
}
