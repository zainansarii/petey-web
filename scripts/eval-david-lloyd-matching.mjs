// Opt-in real-model checks with synthetic conversations only. Build functions first.
// --force-retry injects one transient failure per stage before genuine model output.
import assert from "node:assert/strict";
import { createOpenAIClient, generateOpenAIText } from "../functions-david-lloyd/lib/functions/src/openai.js";
import { generateModelResponse } from "../functions-david-lloyd/lib/functions-david-lloyd/src/generation.js";
import { createDavidLloydService } from "../functions-david-lloyd/lib/functions-david-lloyd/src/service.js";
import { OPENING_MESSAGE } from "../functions-david-lloyd/lib/david-lloyd-shared/contract.js";
import { TRAINERS } from "../functions-david-lloyd/lib/david-lloyd-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-david-lloyd/lib/david-lloyd-shared/locations.js";

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY before running this opt-in evaluation.");
  const client = createOpenAIClient(process.env.OPENAI_API_KEY);
  const forcedRetry = process.argv.includes("--force-retry");
  let candidates;
  const service = createDavidLloydService(request => {
    if (request.kind === "ranking") {
      const payload = JSON.parse(request.contents);
      candidates = payload.candidates;
      assert.equal("budget" in payload.brief, false);
      assert.equal("membershipPackage" in payload.brief, false);
    }
    let attempts = 0;
    return generateModelResponse(request, {
      generateText: parameters => {
        if (forcedRetry && ++attempts === 1) return Promise.reject(Object.assign(new Error("Synthetic provider outage"), { status: 429 }));
        return generateOpenAIText(client, parameters);
      },
      onRetry: event => console.log(JSON.stringify({ event: "retry", forcedRetry, ...event })),
    });
  }, { trainers: TRAINERS, clubs: CLUBS, locations: LONDON_LOCATIONS });
  const goal = "I want to build strength for everyday life. I am a beginner and prefer patient coaching with clear explanations.";
  const scenarios = [
    ...["raynes-park", "kingston", "colliers-wood"].map(clubId => ({
      name: `Home-club member at ${clubId}, package unknown`,
      answer: `${goal} I am a David Lloyd member and my home club is ${CLUBS.find(club => club.id === clubId).name}. My budget is not sure yet.`,
      home: clubId, only: clubId, package: "", budget: /not sure|uncertain|unknown/i,
    })),
    { name: "Platinum never grants unconfirmed other-club access",
      answer: `${goal} I have Platinum membership and Raynes Park is my home club. My budget is £20 per session.`,
      home: "raynes-park", only: "raynes-park", package: "Platinum", budget: /20/ },
    { name: "All three explicitly confirmed clubs, flexible budget",
      answer: `${goal} My home club is Raynes Park. I can currently also use Kingston and Colliers Wood. My budget per session is flexible.`,
      home: "raynes-park", clubs: 3, budget: /flexible/i },
    { name: "Current access excludes home club",
      answer: `${goal} My home club is Raynes Park, but currently I can only use Kingston; Raynes Park is excluded. My budget is £60 per session.`,
      home: "raynes-park", only: "kingston", excluded: "raynes-park" },
    { name: "Acton Park has no fictional sample trainers",
      answer: `${goal} I am a member with my home club at Acton Park. My budget is flexible.`, home: "acton-park", empty: true },
    { name: "One area for a non-member",
      answer: `${goal} I am not a David Lloyd member. I want to train around Earlsfield. Not sure about budget yet.`,
      membership: "non-member", location: "Earlsfield" },
    { name: "A remote non-member area keeps nearest-club bounds",
      answer: `${goal} I am not a member. I want to train in Enfield. My budget is £60 per session.`,
      membership: "non-member", location: "Enfield", empty: true },
    { name: "Racquet conditioning is evidence-backed personal training",
      answer: "I want strength and conditioning to support tennis, with a trainer who specialises in tennis conditioning. I train twice a week and prefer structured coaching. I am a member at Raynes Park and my budget per session is flexible.",
      home: "raynes-park", only: "raynes-park", trainer: "dl-demo-daniel-reed" },
    { name: "Swimming lessons remain outside PT scope",
      answer: "I want swimming lessons, specifically to learn to swim. I do not want gym conditioning. I am a member at Raynes Park and my budget is flexible.",
      home: "raynes-park", empty: true },
  ];
  for (const scenario of scenarios) {
    candidates = [];
    const started = Date.now();
    const result = await service.match([{ role: "assistant", content: OPENING_MESSAGE }, { role: "user", content: scenario.answer }]);
    if (scenario.home) assert.ok(result.brief.homeClubIds.includes(scenario.home));
    if (scenario.membership) assert.equal(result.brief.membership, scenario.membership);
    if (scenario.package !== undefined) assert.equal(result.brief.membershipPackage.toLowerCase(), scenario.package.toLowerCase());
    if (scenario.budget) assert.match(result.brief.budget, scenario.budget);
    if (scenario.excluded) assert.ok(result.brief.excludedClubIds.includes(scenario.excluded));
    if (scenario.location) assert.ok(result.brief.locationAnchors.includes(scenario.location));
    else assert.deepEqual(result.brief.locationAnchors, [], "Do not create a second training preference from the home default");
    if (scenario.empty) {
      assert.deepEqual(result.matches, []);
      assert.deepEqual(candidates, []);
      assert.ok(result.emptyReason);
    } else {
      assert.ok(result.matches.length > 0 && result.matches.length <= 3);
      assert.ok(result.matches.every(match => TRAINERS.some(trainer => trainer.id === match.trainerId && trainer.clubIds.includes(match.clubId))));
      if (scenario.only) assert.ok(candidates.every(candidate => candidate.clubId === scenario.only));
      if (scenario.clubs) assert.equal(new Set(candidates.map(candidate => candidate.clubId)).size, scenario.clubs);
      if (scenario.trainer) assert.equal(result.matches[0].trainerId, scenario.trainer);
    }
    console.log(JSON.stringify({ scenario: scenario.name, durationMs: Date.now() - started, matches: result.matches.map(match => match.trainerId), passed: true }));
  }
  console.log(`${scenarios.length}/${scenarios.length} matching checks passed with genuine model output.`);
}
main().catch(error => {
  console.error(JSON.stringify({ error: error.name, status: typeof error.status === "number" ? error.status : undefined,
    ...(!process.env.OPENAI_API_KEY ? { message: "Set OPENAI_API_KEY before running this opt-in evaluation." } : {}),
    ...(error.name === "AssertionError" ? { assertion: error.message } : {}) }));
  process.exitCode = 1;
});
