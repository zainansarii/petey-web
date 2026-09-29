// Opt-in real chat-model checks using only synthetic conversations. Build functions first.
import assert from "node:assert/strict";
import { createOpenAIClient, generateOpenAIText } from "../functions-david-lloyd/lib/functions/src/openai.js";
import { createDavidLloydService } from "../functions-david-lloyd/lib/functions-david-lloyd/src/service.js";
import { generateModelResponse } from "../functions-david-lloyd/lib/functions-david-lloyd/src/generation.js";
import { BUDGET_QUICK_REPLIES, LOCATION_QUICK_REPLIES, OPENING_MESSAGE } from "../functions-david-lloyd/lib/david-lloyd-shared/contract.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-david-lloyd/lib/david-lloyd-shared/locations.js";

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY before running this opt-in evaluation.");
  const client = createOpenAIClient(process.env.OPENAI_API_KEY);
  const service = createDavidLloydService(request => generateModelResponse(request, {
    generateText: parameters => generateOpenAIText(client, parameters),
  }), { trainers: [], clubs: CLUBS, locations: LONDON_LOCATIONS });
  const messages = (...replies) => [OPENING_MESSAGE, ...replies].map((content, index) => ({ role: index % 2 === 0 ? "assistant" : "user", content }));
  const trainee = ["I want to run my first half marathon in March.", "How far are you running comfortably at the moment?", "About 5k; I have been running twice a week for three months."];
  const coaching = ["What coaching style would suit you?", "Direct and disciplined.", "What does direct coaching look like for you?", "Clear instructions and someone who checks I stick to the plan."];
  const membership = "Are you already a David Lloyd member?";
  const budget = ["What budget per session feels comfortable?", "Not sure yet."];
  const scenarios = [
    { name: "Broad health goal needs meaning", history: ["I want to be healthier"], topics: ["goal"], incomplete: "goal" },
    { name: "Body confidence needs meaning", history: ["I want to feel body confident"], topics: ["goal"], incomplete: "goal" },
    { name: "Concrete goal needs practical context", history: [trainee[0]], topics: ["goal", "experience"], incomplete: "goal" },
    { name: "Clarifying meaning does not replace practical follow-up", history: ["I want to be healthier", "What would that look like day to day?", "Climbing stairs without getting out of breath."], topics: ["goal", "experience"], incomplete: "goal" },
    { name: "Goal uncertainty accepted after clarification", history: ["I want to be healthier", "What would that look like day to day?", "I am not sure really."], topics: ["experience"], covered: "goal", incomplete: "experience" },
    { name: "Explicit goal skip", history: ["I want to be healthier", "What would that look like day to day?", "Please skip goal questions for now."], noTopic: "goal", covered: "goal" },
    { name: "Coaching preference gets personalised follow-up", history: [...trainee, ...coaching.slice(0, 2)], topics: ["coaching"], incomplete: "coaching" },
    { name: "No coaching preference accepted", history: [...trainee, coaching[0], "No preference."], noTopic: "coaching", covered: "coaching" },
    { name: "Member without home club needs access question", history: [...trainee, ...coaching, membership, "Yes, I am a member.", ...budget], topics: ["access"], incomplete: "access" },
    { name: "Platinum does not identify home club", history: [...trainee, ...coaching, membership, "Yes, Platinum membership.", ...budget], topics: ["access"], incomplete: "access" },
    ...["", "Platinum", "Club Plus", "Legacy package"].map(packageName => ({
      name: `Known home club completes with ${packageName || "no package name"}`,
      history: [...trainee, ...coaching, membership, `Yes, my home club is Raynes Park.${packageName ? ` My package is ${packageName}.` : ""}`, ...budget], complete: true,
    })),
    { name: "Non-member needs one area", history: [...trainee, ...coaching, membership, "No, I am not a member.", ...budget], topics: ["location"], incomplete: "location" },
    ...LOCATION_QUICK_REPLIES.map(area => ({ name: `${area} completes non-member location`, history: [...trainee, ...coaching, membership, "No, I am not a member.", "Where in London would be easiest for you to train?", area, ...budget], complete: true })),
    { name: "Per-session budget remains open", history: [...trainee, ...coaching, membership, "Yes, my home club is Kingston."], topics: ["budget"], incomplete: "budget" },
    ...["£20 per session", "£150 per session", "Flexible"].map(answer => ({ name: `${answer} is accepted without price promises`, history: [...trainee, ...coaching, membership, "Yes, my home club is Kingston.", budget[0], answer], complete: true })),
    { name: "Refinement retains previous conversation", history: [...trainee, ...coaching, membership, "Yes, my home club is Raynes Park and I can also use Kingston.", ...budget, "I have enough to find your matches.", "Please focus only on Kingston now."], complete: true },
  ];
  for (const scenario of scenarios) {
    const started = Date.now();
    const turn = await service.turn(messages(...scenario.history));
    if (scenario.topics) assert.ok(scenario.topics.includes(turn.topic), `${scenario.name}: unexpected topic ${turn.topic}`);
    if (scenario.noTopic) assert.notEqual(turn.topic, scenario.noTopic);
    if (scenario.incomplete) assert.equal(turn.coverage[scenario.incomplete], false);
    if (scenario.covered) assert.equal(turn.coverage[scenario.covered], true);
    if (scenario.complete) assert.equal(turn.readyForMatching, true, `${scenario.name}: ${turn.reply}`);
    if (turn.topic === "budget") {
      assert.deepEqual(turn.quickReplies, BUDGET_QUICK_REPLIES);
      assert.match(turn.reply, /per session|session budget|each session/i);
    }
    if (turn.topic === "location") assert.deepEqual(turn.quickReplies, LOCATION_QUICK_REPLIES);
    assert.doesNotMatch(turn.reply, /£\d|\b(?:hourly|per hour|sessions start from)\b/i);
    assert.ok(!turn.reply.includes("—"));
    console.log(JSON.stringify({ scenario: scenario.name, durationMs: Date.now() - started, topic: turn.topic, passed: true }));
  }
  console.log(`${scenarios.length}/${scenarios.length} onboarding checks passed with genuine model output.`);
}
main().catch(error => {
  console.error(JSON.stringify({ error: error.name, status: typeof error.status === "number" ? error.status : undefined,
    ...(!process.env.OPENAI_API_KEY ? { message: "Set OPENAI_API_KEY before running this opt-in evaluation." } : {}),
    ...(error.name === "AssertionError" ? { assertion: error.message } : {}) }));
  process.exitCode = 1;
});
