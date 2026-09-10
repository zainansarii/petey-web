// Fictional product-design fixtures. No Firebase, messaging or payment integration.
export const UNLOCK_PRICE = 8;
export const TODAY = "2026-09-09";
export type LeadStage = "new" | "reply" | "contacted" | "consultation" | "won" | "closed";
export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New enquiry", reply: "Needs a reply", contacted: "Contacted",
  consultation: "Consultation", won: "Started training", closed: "Closed",
};
export interface Lead {
  id: string; name: string; initials: string; goal: string; area: string;
  budget: string; venue: string; availability: string; frequency: string;
  experience: string; created: string; stage: LeadStage; unlocked: boolean;
  unlockedAt?: string; followUp?: string; note: string; messages: string[];
  brief: string; intro: string; fit: string[]; tradeoff?: string;
}
const names = ["Emma Wilson", "Daniel Brooks", "Sophie Patel", "Oliver James", "Amelia Lewis", "Noah Turner", "Isla Martin", "Leo Clarke", "Grace Ahmed", "James Taylor", "Mia Harris", "Alex Morgan", "Chloe Evans", "Ethan Lee", "Ruby Walker", "Oscar Thomas", "Freya White", "Lucas Green", "Ella Robinson", "Jack Wright", "Ava Hall", "Hugo Scott", "Lily Adams", "Max King"];
const goals = ["Run my first 10K", "Build strength", "Get back into fitness", "Improve my 5K time"];
const areas = ["Richmond", "Twickenham", "Kew", "Richmond"];
const stages: LeadStage[] = ["new", "new", "new", "new", "reply", "new", "reply", "new", "new", "reply", "contacted", "consultation", "new", "contacted", "contacted", "consultation", "contacted", "consultation", "closed", "closed", "won", "won", "won", "won"];
export function createLeads(): Lead[] {
  return names.map((name, i) => {
    const date = new Date(`${TODAY}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - Math.floor(i * 1.12));
    const created = date.toISOString().slice(0, 10);
    const stage = stages[i];
    const unlocked = stage !== "new" && stage !== "closed";
    return {
      id: `enquiry-${i + 1}`, name, initials: name.split(" ").map(n => n[0]).join(""),
      goal: goals[i % 4], area: areas[i % 4], budget: i === 2 ? "£60–£65 / session" : "£70–£80 / session",
      venue: i % 3 === 1 ? "Commercial gym" : i % 3 === 2 ? "Online" : "Private studio",
      availability: i % 2 ? "Weekday evenings" : "Weekday mornings",
      frequency: i % 2 ? "Twice a week with a trainer" : "Once a week with a trainer",
      experience: i % 2 ? "Some training experience" : "Getting started",
      created, stage, unlocked, unlockedAt: unlocked ? created : undefined,
      followUp: [10, 11].includes(i) ? TODAY : i === 13 ? "2026-09-10" : undefined,
      note: i === 10 ? "Check whether mornings still work." : i === 11 ? "Send a couple of times for an introductory call." : i === 13 ? "Ask how the first gym visit went." : "",
      messages: [],
      brief: `${name.split(" ")[0]} is looking for ${i % 4 === 0 ? "a clear plan for their first 10K, with strength work alongside running" : i % 4 === 1 ? "structured strength coaching and help feeling more confident with weights" : i % 4 === 2 ? "an encouraging coach to help build a consistent fitness routine" : "a running coach to help improve pace and build endurance"}. They prefer a patient, practical approach and regular feedback.`,
      intro: `Hi John! ${i % 4 === 0 ? "I’ve signed up for my first 10K in November and would love some help getting there. I can run about 3K at the moment." : i % 4 === 1 ? "I’d like to get stronger and feel more confident in the gym. I’ve trained a little before but would really value a proper plan." : i % 4 === 2 ? "I’m getting back into exercise after a busy year and your coaching style sounds like a good fit." : "I run a couple of times a week and would love to get a little faster with some guidance."} Are you taking on new clients?`,
      fit: [i % 4 === 1 ? "Strength coaching" : "Running & general fitness", "Your training settings", i % 2 ? "Evening availability" : "Morning availability"],
      tradeoff: i === 2 ? "Their £60–£65 session budget is below your £72 rate. Check flexibility before unlocking." : undefined,
    };
  });
}
export function inPeriod(date: string, days: number) {
  const age = (Date.parse(`${TODAY}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86_400_000;
  return age >= 0 && age < days;
}
export const money = (amount: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount);
export const dateLabel = (date: string) => date === TODAY ? "Today" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
export interface Profile {
  name: string; specialty: string; bio: string; area: string; serviceArea: string;
  price: string; packagePrice: string; monthlyPrice: string; duration: string;
  pricingNotes: string; styles: string; specialties: string; experience: string;
  website: string; accepting: boolean; venues: string[]; availability: string[];
}
export const INITIAL_PROFILE: Profile = {
  name: "John Kim", specialty: "Running and endurance", area: "Richmond · TW9",
  bio: "I help runners find a pace and routine they can sustain. From a first 5K to a faster race, I combine practical strength work, clear progress tracking and patient coaching.",
  serviceArea: "Richmond, Kew and Twickenham. Online coaching available across the UK.",
  price: "72", packagePrice: "650", monthlyPrice: "390", duration: "60",
  pricingNotes: "Packages include a tailored plan and progress check-ins.",
  styles: "Data-driven, Encouraging, Educational", specialties: "Running, General fitness, Mobility, Functional fitness",
  experience: "7 years of coaching", website: "", accepting: true,
  venues: ["Commercial gym", "Private studio", "Online"],
  availability: ["Mon-morning", "Tue-morning", "Tue-evening", "Wed-morning", "Thu-evening", "Fri-morning", "Sat-morning"],
};
