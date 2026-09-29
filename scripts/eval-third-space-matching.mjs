// Opt-in real-model checks with synthetic conversations and fictional demo trainers only.
// Build functions-third-space first. --force-retry injects a transient first-attempt
// failure in each stage; Sol medium still has to produce real, validated matches on retry.
import assert from "node:assert/strict";
import { createOpenAIClient, generateOpenAIText } from "../functions-third-space/lib/functions/src/openai.js";
import { generateModelResponse } from "../functions-third-space/lib/functions-third-space/src/generation.js";
import { createThirdSpaceService } from "../functions-third-space/lib/functions-third-space/src/service.js";
import { OPENING_MESSAGE } from "../functions-third-space/lib/third-space-shared/contract.js";
import { TRAINERS } from "../functions-third-space/lib/third-space-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-third-space/lib/third-space-shared/locations.js";

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY before running this opt-in evaluation.");
  const client = createOpenAIClient(process.env.OPENAI_API_KEY);
  const forcedRetry = process.argv.includes("--force-retry");
  let rankingCandidates;
  const service = createThirdSpaceService(request => {
    if (request.kind === "ranking") rankingCandidates = JSON.parse(request.contents).candidates;
    let attempts = 0;
    return generateModelResponse(request, {
      generateText: parameters => {
        attempts += 1;
        if (forcedRetry && attempts === 1) {
          return Promise.reject(Object.assign(new Error("Synthetic provider outage"), { status: request.kind === "brief" ? 504 : 429 }));
        }
        return generateOpenAIText(client, parameters);
      },
      onRetry: event => console.log(JSON.stringify({ event: "retry", forcedRetry, ...event })),
    });
  }, { trainers: TRAINERS, clubs: CLUBS, locations: LONDON_LOCATIONS });

  const scenarios = [
    {
      name: "Health goal, Group membership, Liverpool Street",
      answer: "I want to feel healthier by building strength for everyday life and being less out of breath on stairs. I am a beginner and walk most days. I like calm coaching with clear explanations. I have Third Space Group membership, home club Moorgate, with no restrictions. I want to train near Liverpool Street, not necessarily my home club. My hourly budget is £85–£100.",
      membershipType: "group", homeClubId: "moorgate", location: "Liverpool Street", expectedClubCount: 3,
    },
    ...["wimbledon", "richmond", "clapham-junction"].map(clubId => ({
      name: `Single Club member at ${clubId}`,
      answer: `I want to build strength and improve my squat technique. I have trained twice weekly for six months. I prefer direct coaching with technique feedback. I have Single Club membership at ${CLUBS.find(club => club.id === clubId).name} only, with no access to other clubs. My hourly budget is £100–£125.`,
      membershipType: "club", homeClubId: clubId, onlyClubId: clubId, expectedClubCount: 1,
    })),
    ...["group", "group-plus"].map(membershipType => ({
      name: `${membershipType} member at Wimbledon with no training-area answer`,
      answer: `I want to build muscle and improve my lifting technique. I have trained twice weekly for six months. I have no coaching style preference. I am a Third Space member with ${membershipType === "group-plus" ? "Group Plus" : "Group"} membership and my home club is Wimbledon. My hourly budget is £100–£125.`,
      membershipType, homeClubId: "wimbledon", expectedClubCount: 3, nearestFirst: true,
    })),
    {
      name: "City Single Club member has no profiles in the active demo sample",
      answer: "I want to build strength. I am a beginner and prefer patient coaching. I have Single Club membership at City only and no other club access. My hourly budget is £100.",
      membershipType: "club", homeClubId: "city", empty: true,
    },
    {
      name: "City Group member with current access limited by waiting lists",
      answer: "I want to build muscle. I am a beginner and have no coaching style preference. I have Group membership and my home club is City. Currently I can only access City and Moorgate, but I am still waitlisted for Moorgate so I cannot use it yet. My budget is £100 an hour.",
      membershipType: "group", homeClubId: "city", empty: true,
    },
    {
      name: "Non-member at City keeps nearest-three-club exploration",
      answer: "I want to build strength for everyday life. I am a beginner and like encouraging coaching. I am not a Third Space member. I want to train in City near Bank station. My budget is £100 an hour.",
      membership: "non-member", membershipType: "unknown", empty: true, explicitLocation: true,
    },
  ];
  for (const scenario of scenarios) {
    rankingCandidates = [];
    const started = Date.now();
    const result = await service.match([
      { role: "assistant", content: OPENING_MESSAGE }, { role: "user", content: scenario.answer },
    ]);
    console.log(JSON.stringify({
      scenario: scenario.name, forcedRetry, durationMs: Date.now() - started, ...result,
    }));
    assert.equal(result.brief.membershipType, scenario.membershipType);
    if (scenario.membership) assert.equal(result.brief.membership, scenario.membership);
    if (scenario.homeClubId) assert.ok(result.brief.homeClubIds.includes(scenario.homeClubId));
    if (scenario.location) assert.ok(result.brief.locationAnchors.includes(scenario.location));
    else if (scenario.explicitLocation) assert.ok(result.brief.locationAnchors.length > 0);
    else assert.deepEqual(result.brief.locationAnchors, [], "Keep inferred home-club defaults separate from explicit preferences");
    if (scenario.empty) {
      assert.deepEqual(result.matches, [], "Never fill an unsupported club with out-of-area demo trainers");
      assert.deepEqual(rankingCandidates, [], "An empty eligible catalogue must skip ranking");
      assert.ok(result.emptyReason, "Explain the limited demo coverage");
      continue;
    }
    assert.ok(result.matches.length > 0 && result.matches.length <= 3, "Expected validated fictional catalogue matches");
    assert.ok(result.matches.every(match => TRAINERS.some(trainer => trainer.id === match.trainerId && trainer.clubIds.includes(match.clubId))));
    if (scenario.onlyClubId) assert.ok(result.matches.every(match => match.clubId === scenario.onlyClubId));
    if (scenario.expectedClubCount) assert.equal(new Set(rankingCandidates.map(candidate => candidate.clubId)).size, scenario.expectedClubCount);
    if (scenario.nearestFirst) {
      assert.equal(result.matches[0].clubId, scenario.homeClubId, "A general lifting goal should prioritise a suitable home-club trainer");
    }
  }
  console.log(`${scenarios.length}/${scenarios.length} matching checks passed with real model output.`);
}

main().catch(error => {
  // Keep provider bodies and credentials out of terminal output.
  console.error(JSON.stringify({ error: error.name, status: typeof error.status === "number" ? error.status : undefined,
    ...(!process.env.OPENAI_API_KEY ? { message: "Set OPENAI_API_KEY before running this opt-in evaluation." } : {}),
    ...(error.name === "AssertionError" ? { assertion: error.message } : {}) }));
  process.exitCode = 1;
});
