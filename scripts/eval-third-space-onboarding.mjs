// Opt-in checks against the real chat model, using synthetic conversations only.
// Build functions-third-space first. Use ADC, or --gcloud-auth for an existing CLI login.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { GoogleGenAI, ThinkingLevel } from "../functions-third-space/node_modules/@google/genai/dist/node/index.mjs";
import { OAuth2Client } from "../functions-third-space/node_modules/google-auth-library/build/src/index.js";
import { createThirdSpaceService } from "../functions-third-space/lib/functions-third-space/src/service.js";
import { withTransientProviderRetry } from "../functions-third-space/lib/functions-third-space/src/provider-retry.js";
import { BUDGET_QUICK_REPLIES, OPENING_MESSAGE } from "../functions-third-space/lib/third-space-shared/contract.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-third-space/lib/third-space-shared/locations.js";

async function main() {
  let authClient;
  if (process.argv.includes("--gcloud-auth")) {
    authClient = new OAuth2Client();
    const token = execFileSync("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    authClient.setCredentials({ access_token: token });
  }
  const model = process.env.THIRD_SPACE_CHAT_MODEL || "gemini-3.5-flash-lite";
  const ai = new GoogleGenAI({
    vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT || "petey-dev-getcass", location: "global",
    ...(authClient ? { googleAuthOptions: { authClient } } : {}),
  });
  const service = createThirdSpaceService(async request => {
    const result = await withTransientProviderRetry(() => ai.models.generateContent({
      model, contents: request.contents,
      config: {
        systemInstruction: request.systemInstruction,
        responseMimeType: "application/json", responseJsonSchema: request.responseJsonSchema,
        temperature: 0.35, maxOutputTokens: 3000,
        thinkingConfig: model.startsWith("gemini-2.") ? { thinkingBudget: 0 }
          : { thinkingLevel: model.startsWith("gemini-3.7") ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL },
        httpOptions: { timeout: 20000, retryOptions: { attempts: 1 } },
      },
    }));
    return result.text;
  }, { trainers: [], clubs: CLUBS, locations: LONDON_LOCATIONS });

  const messages = (...replies) => [OPENING_MESSAGE, ...replies].map((content, index) => ({
    role: index % 2 === 0 ? "assistant" : "user", content,
  }));
  const trainee = [
    "I want to run my first half marathon in March.",
    "How far are you running comfortably at the moment?",
    "About 5k; I have been running twice a week for three months.",
  ];
  const coaching = [
    "What sort of personality would you like your trainer to have?", "Military style and direct.",
    "What does military style look like for you?", "Clear instructions and someone who checks I stick to the plan.",
  ];
  const practical = [
    "Are you already a Third Space member?", "Yes, Group membership. My home club is Moorgate, with no extra restrictions.",
    "Which area would you like to train in?", "Near Liverpool Street.",
    "What hourly budget feels comfortable?", "£85–£100 per hour.",
  ];
  const healthy = messages("I want to be more healthy");
  const scenarios = [
    ...[1, 2, 3].map(index => ({
      name: `Broad health goal ${index}`, messages: healthy, topics: ["goal"], incomplete: "goal",
    })),
    { name: "Body confidence", messages: messages("I want to feel body confident"), topics: ["goal"], incomplete: "goal" },
    { name: "Concrete running goal", messages: messages(trainee[0]), topics: ["goal", "experience"], incomplete: "goal" },
    {
      name: "Clarified goal still needs practical context",
      messages: messages("I want to be more healthy", "What would being healthier look like for you day to day?", "Being able to climb stairs without getting out of breath."),
      topics: ["goal", "experience"], incomplete: "goal",
    },
    {
      name: "Still uncertain after clarification",
      messages: messages("I want to be more healthy", "What would being healthier look like for you day to day?", "I am not sure really."),
      topics: ["experience"], covered: "goal", incomplete: "experience",
      review: "Accept uncertainty and explore a practical angle without repeating what healthy means.",
    },
    {
      name: "Explicit goal skip",
      messages: messages("I want to be more healthy", "What would being healthier look like for you day to day?", "Please skip the goal questions for now."),
      noTopic: "goal", covered: "goal",
    },
    { name: "Personalised coaching follow-up", messages: messages(...trainee, ...coaching.slice(0, 2)), topics: ["coaching"], incomplete: "coaching" },
    {
      name: "No coaching preference",
      messages: messages(...trainee, coaching[0], "No preference, anyone is fine."), noTopic: "coaching", covered: "coaching",
    },
    {
      name: "Membership still needed",
      messages: messages(...trainee, ...coaching), topics: ["membership", "budget"], incomplete: "membership",
    },
    {
      name: "Member access still needed",
      messages: messages(...trainee, ...coaching, practical[0], "Yes, I am a member.", ...practical.slice(2)),
      topics: ["access"], incomplete: "access",
    },
    {
      name: "Group home club covers location without another question",
      messages: messages(...trainee, ...coaching, ...practical.slice(0, 2), ...practical.slice(4)),
      complete: true,
    },
    ...["Single Club", "Group", "Group Plus"].map(tier => ({
      name: `${tier} at City completes without a training-area question`,
      messages: messages(...trainee, ...coaching, practical[0], `Yes, ${tier} membership. My home club is City.`, ...practical.slice(4)),
      complete: true,
    })),
    {
      name: "Membership type known but home club still needed",
      messages: messages(...trainee, ...coaching, practical[0], "Yes, Group membership.", ...practical.slice(4)),
      topics: ["access"], incomplete: "access", replyPattern: /home club/i,
    },
    {
      name: "Non-member still needs a training area",
      messages: messages(...trainee, ...coaching, practical[0], "Not a member yet.", ...practical.slice(4)),
      topics: ["location"], incomplete: "location",
    },
    {
      name: "Group member with phased access does not need another location question",
      messages: messages(...trainee, ...coaching, practical[0], "Yes, Group membership, home club City. I am still waitlisted for Moorgate.", ...practical.slice(4)),
      complete: true,
    },
    {
      name: "Hourly budget still needed",
      messages: messages(...trainee, ...coaching, ...practical.slice(0, 4)), topics: ["budget"], incomplete: "budget",
    },
    {
      name: "Complete without repeating answered follow-ups",
      messages: messages(...trainee, ...coaching, ...practical), complete: true,
    },
    {
      name: "Non-member can complete without access questions",
      messages: messages(...trainee, ...coaching, practical[0], "Not a member yet.", ...practical.slice(2)), complete: true,
    },
    {
      name: "Refinement preserves earlier depth",
      messages: messages(...trainee, ...coaching, ...practical,
        "I have enough to find your matches.", "Thanks.",
        "What would you like to change about your matches?", "Only Soho instead of Liverpool Street please."),
      complete: true,
    },
  ];

  let failures = 0;
  for (const scenario of scenarios) {
    const turn = await service.turn(scenario.messages);
    // Report actual replies for human review as topic labels alone cannot prove conversational quality.
    console.log(JSON.stringify({ scenario: scenario.name, review: scenario.review, ...turn }));
    try {
      assert.equal(turn.readyForMatching, Boolean(scenario.complete), "Unexpected matching readiness");
      if (scenario.topics) assert.ok(scenario.topics.includes(turn.topic), `Unexpected topic: ${turn.topic}`);
      if (scenario.noTopic) assert.notEqual(turn.topic, scenario.noTopic, "Repeated a skipped theme");
      if (scenario.incomplete) assert.equal(turn.coverage[scenario.incomplete], false, "Premature topic coverage");
      if (scenario.covered) assert.equal(turn.coverage[scenario.covered], true, "Skip/no preference not respected");
      if (turn.topic === "budget") assert.deepEqual(turn.quickReplies, BUDGET_QUICK_REPLIES);
      if (scenario.complete) assert.equal(turn.topic, "complete");
      if (scenario.replyPattern) assert.match(turn.reply, scenario.replyPattern);
    } catch (error) {
      failures += 1;
      console.error(`${scenario.name}: ${error.message}`);
    }
  }
  console.log(`${scenarios.length - failures}/${scenarios.length} model-response checks passed. Review the actual wording above.`);
  if (failures) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
