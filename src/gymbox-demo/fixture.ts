// Local browser QA only. api.ts imports this file behind import.meta.env.DEV.
// These responses are never a fallback for the live AI service.
import { TRAINERS } from "../../gymbox-shared/catalogue";
import { CLUBS } from "../../gymbox-shared/locations";
import { BUDGET_QUICK_REPLIES, type DemoMessage, type GymboxMatches, type GymboxTurn } from "../../gymbox-shared/contract";

const turns: Array<Pick<GymboxTurn, "reply" | "quickReplies" | "topic">> = [
  { reply: "What does your training look like at the moment?", quickReplies: ["I’m just getting started", "I train occasionally", "I train regularly"], topic: "experience" },
  { reply: "Are you already a Gymbox member, and which club can you use?", quickReplies: ["Yes — Bank only", "Yes — Farringdon only", "Not yet"], topic: "membership" },
  { reply: "What kind of coach helps you get the most out of yourself?", quickReplies: ["Encouraging and patient", "Direct and challenging", "A mix of both"], topic: "coaching" },
  { reply: "What would you feel comfortable spending per personal-training session?", quickReplies: BUDGET_QUICK_REPLIES, topic: "budget" },
  { reply: "I have enough to find a few trainers who could be a good fit for you.", quickReplies: [], topic: "complete" },
];

export async function fixtureTurn(messages: DemoMessage[]): Promise<GymboxTurn> {
  const answers = messages.filter((message) => message.role === "user");
  const index = Math.min(Math.max(answers.length - 1, 0), turns.length - 1);
  const turn = turns[index];
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { ...turn, readyForMatching: turn.topic === "complete", coverage: { goal: true, experience: index >= 1, membership: index >= 2, access: index >= 2, location: index >= 2, coaching: index >= 3, budget: index >= 4 } };
}

export async function fixtureMatches(messages: DemoMessage[]): Promise<GymboxMatches> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  const farringdon = messages.some(({ role, content }) => role === "user" && /farringdon/i.test(content));
  const clubId = farringdon ? "farringdon" : "bank";
  const ids = farringdon ? ["gb-demo-sophie-morgan", "gb-demo-lucas-bennett", "gb-demo-isabel-ross"] : ["gb-demo-emma-carter", "gb-demo-amira-hassan", "gb-demo-grace-ellis"];
  const selected = ids.map((id) => TRAINERS.find((trainer) => trainer.id === id)!);
  return {
    brief: {
      goal: messages.find((message) => message.role === "user")?.content || "Build strength and feel confident in the gym",
      experience: "Getting started", coachingStyle: "Encouraging and patient", specialistNeeds: [], membership: "member",
      membershipPackage: "", homeClubIds: [clubId], accessibleClubIds: [clubId], accessMode: "single-club",
      excludedClubIds: [], locationAnchors: [clubId], budget: "Flexible", additionalPreferences: [],
    },
    matches: selected.map((trainer) => ({ trainerId: trainer.id, clubId, reasons: [trainer.summary, `Their profile includes ${trainer.expertise[0].toLowerCase()}.`], locationReason: `${CLUBS.find((club) => club.id === clubId)?.name}, where you want to train.` })),
    unconfirmed: [],
  };
}
