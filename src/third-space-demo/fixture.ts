// Local browser QA only. api.ts imports this file behind import.meta.env.DEV.
// These responses are never a fallback for the live AI service.
import { TRAINERS } from "../../third-space-shared/catalogue";
import { CLUBS } from "../../third-space-shared/locations";
import { BUDGET_QUICK_REPLIES, type DemoMessage, type ThirdSpaceMatches, type ThirdSpaceTurn } from "../../third-space-shared/contract";

const turns: Array<Pick<ThirdSpaceTurn, "reply" | "quickReplies" | "topic">> = [
  { reply: "What does your training look like at the moment?", quickReplies: ["I’m just getting started", "I train occasionally", "I train regularly"], topic: "experience" },
  { reply: "Are you already a Third Space member?", quickReplies: ["Yes, I’m a member", "Not yet", "I’m not sure"], topic: "membership" },
  { reply: "What type of membership do you have?", quickReplies: ["Group membership", "Group Plus", "The Wharf", "One club"], topic: "access" },
  { reply: "Which is your home club?", quickReplies: ["Wimbledon", "Richmond", "Clapham Junction"], topic: "access" },
  { reply: "What kind of coach helps you get the most out of yourself?", quickReplies: ["Encouraging and patient", "Direct and challenging", "A mix of both"], topic: "coaching" },
  { reply: "What hourly budget feels comfortable for personal training? Third Space sessions start from £85; individual trainer rates need confirming.", quickReplies: BUDGET_QUICK_REPLIES, topic: "budget" },
  { reply: "I have enough to find a few trainers who could be a good fit for you.", quickReplies: [], topic: "complete" },
];

export async function fixtureTurn(messages: DemoMessage[]): Promise<ThirdSpaceTurn> {
  const answers = messages.filter((message) => message.role === "user");
  const index = Math.min(Math.max(answers.length - 1, 0), turns.length - 1);
  const turn = turns[index];
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { ...turn, readyForMatching: turn.topic === "complete", coverage: { goal: true, experience: index >= 1, membership: index >= 2, access: index >= 4, location: index >= 4, coaching: index >= 5, budget: index >= 6 } };
}

export async function fixtureMatches(messages: DemoMessage[]): Promise<ThirdSpaceMatches> {
  await new Promise((resolve) => setTimeout(resolve, 650));
  const selected = ["ts-demo-emma-carter", "ts-demo-sophie-morgan", "ts-demo-grace-ellis"].map((id) => TRAINERS.find((trainer) => trainer.id === id)!);
  return {
    brief: {
      goal: messages.find((message) => message.role === "user")?.content || "Build strength and feel confident in the gym",
      experience: "Getting started", coachingStyle: "Encouraging and patient", specialistNeeds: [], membership: "member",
      membershipType: "group", homeClubIds: ["wimbledon"], accessibleClubIds: CLUBS.filter((club) => !["chelsea", "mayfair"].includes(club.id)).map((club) => club.id),
      excludedClubIds: ["chelsea", "mayfair"], locationAnchors: [], budget: "£85–£100", additionalPreferences: [],
    },
    matches: selected.map((trainer) => ({ trainerId: trainer.id, clubId: trainer.clubIds[0], reasons: [trainer.summary, `Their profile includes ${trainer.expertise[0].toLowerCase()}.`], locationReason: `${CLUBS.find((club) => club.id === trainer.clubIds[0])?.name} is included in your Group access.` })),
    unconfirmed: ["Individual trainer prices and availability need confirming."],
  };
}
