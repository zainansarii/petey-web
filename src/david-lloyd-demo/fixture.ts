// Local browser QA only. api.ts imports this file behind import.meta.env.DEV.
// These responses are never a fallback for the live AI service.
import { TRAINERS } from "../../david-lloyd-shared/catalogue";
import { CLUBS } from "../../david-lloyd-shared/locations";
import { BUDGET_QUICK_REPLIES, type DemoMessage, type DavidLloydMatches, type DavidLloydTurn } from "../../david-lloyd-shared/contract";

const turns: Array<Pick<DavidLloydTurn, "reply" | "quickReplies" | "topic">> = [
  { reply: "What does your training look like at the moment?", quickReplies: ["I’m just getting started", "I train occasionally", "I train regularly"], topic: "experience" },
  { reply: "Are you already a David Lloyd member?", quickReplies: ["Yes, I’m a member", "Not yet", "I’m not sure"], topic: "membership" },
  { reply: "Where in London would be easiest for you to train?", quickReplies: ["Wimbledon", "Kingston", "Earlsfield"], topic: "location" },
  { reply: "What kind of coach helps you get the most out of yourself?", quickReplies: ["Encouraging and patient", "Direct and challenging", "A mix of both"], topic: "coaching" },
  { reply: "What would you feel comfortable spending per personal-training session?", quickReplies: BUDGET_QUICK_REPLIES, topic: "budget" },
  { reply: "I have enough to find a few trainers who could be a good fit for you.", quickReplies: [], topic: "complete" },
];

export async function fixtureTurn(messages: DemoMessage[]): Promise<DavidLloydTurn> {
  const answers = messages.filter((message) => message.role === "user");
  const index = Math.min(Math.max(answers.length - 1, 0), turns.length - 1);
  const turn = turns[index];
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { ...turn, readyForMatching: turn.topic === "complete", coverage: { goal: true, experience: index >= 1, membership: index >= 2, access: index >= 2, location: index >= 3, coaching: index >= 4, budget: index >= 5 } };
}

export async function fixtureMatches(messages: DemoMessage[]): Promise<DavidLloydMatches> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  const selected = ["dl-demo-emma-carter", "dl-demo-amira-hassan", "dl-demo-grace-ellis"].map((id) => TRAINERS.find((trainer) => trainer.id === id)!);
  return {
    brief: {
      goal: messages.find((message) => message.role === "user")?.content || "Build strength and feel confident in the gym",
      experience: "Getting started", coachingStyle: "Encouraging and patient", specialistNeeds: [], membership: "non-member",
      membershipPackage: "", homeClubIds: [], accessibleClubIds: [],
      excludedClubIds: [], locationAnchors: ["Earlsfield"], budget: "Flexible", additionalPreferences: [],
    },
    matches: selected.map((trainer) => ({ trainerId: trainer.id, clubId: trainer.clubIds[0], reasons: [trainer.summary, `Their profile includes ${trainer.expertise[0].toLowerCase()}.`], locationReason: `${CLUBS.find((club) => club.id === trainer.clubIds[0])?.name} is near your preferred training area.` })),
    unconfirmed: ["Individual trainer prices and availability need confirming.", "Confirm membership and club access before arranging personal training."],
  };
}
