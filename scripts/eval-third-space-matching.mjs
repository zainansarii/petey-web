// Opt-in real-model checks with synthetic conversations and public trainer data only.
// Build functions-third-space first. --force-fallback injects a transient first-attempt
// failure in each stage; the alternate model still has to produce real, validated matches.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { GoogleGenAI } from "../functions-third-space/node_modules/@google/genai/dist/node/index.mjs";
import { OAuth2Client } from "../functions-third-space/node_modules/google-auth-library/build/src/index.js";
import { generateModelResponse } from "../functions-third-space/lib/functions-third-space/src/generation.js";
import { createThirdSpaceService } from "../functions-third-space/lib/functions-third-space/src/service.js";
import { OPENING_MESSAGE } from "../functions-third-space/lib/third-space-shared/contract.js";
import { TRAINERS } from "../functions-third-space/lib/third-space-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-third-space/lib/third-space-shared/locations.js";

async function main() {
  let authClient;
  if (process.argv.includes("--gcloud-auth")) {
    authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: execFileSync("gcloud", ["auth", "print-access-token"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim() });
  }
  const ai = new GoogleGenAI({
    vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT || "petey-dev-getcass", location: "global",
    ...(authClient ? { googleAuthOptions: { authClient } } : {}),
  });
  const forcedFallback = process.argv.includes("--force-fallback");
  const service = createThirdSpaceService(request => {
    let attempts = 0;
    return generateModelResponse(request, {
      chatModel: process.env.THIRD_SPACE_CHAT_MODEL || "gemini-3.5-flash-lite",
      matchingModel: process.env.THIRD_SPACE_MATCHING_MODEL || "gemini-3.7-flash",
      generateContent: parameters => {
        attempts += 1;
        if (forcedFallback && attempts === 1) {
          return Promise.reject(Object.assign(new Error("Synthetic provider outage"), { status: request.kind === "brief" ? 504 : 429 }));
        }
        return ai.models.generateContent(parameters);
      },
      onRetry: event => console.log(JSON.stringify({ event: "retry", forcedFallback, ...event })),
    });
  }, { trainers: TRAINERS, clubs: CLUBS, locations: LONDON_LOCATIONS });

  const scenarios = [
    {
      name: "Health goal, Group membership, Liverpool Street",
      answer: "I want to feel healthier by building strength for everyday life and being less out of breath on stairs. I am a beginner and walk most days. I like calm coaching with clear explanations. I have Third Space Group membership, home club Moorgate, with no restrictions. I want to train near Liverpool Street, not necessarily my home club. My hourly budget is £85–£100.",
      membershipType: "group", homeClubId: "moorgate", location: "Liverpool Street",
    },
    {
      name: "Strength goal restricted to Soho club membership",
      answer: "I want to build strength and improve my squat technique. I have trained twice weekly for six months. I prefer direct coaching with technique feedback. I have Club membership at Soho only, no access to other clubs, and I want to train in Soho. My hourly budget is £100–£125.",
      membershipType: "club", homeClubId: "soho", location: "Soho", onlyClubId: "soho",
    },
  ];
  for (const scenario of scenarios) {
    const started = Date.now();
    const result = await service.match([
      { role: "assistant", content: OPENING_MESSAGE }, { role: "user", content: scenario.answer },
    ]);
    console.log(JSON.stringify({
      scenario: scenario.name, forcedFallback, durationMs: Date.now() - started, ...result,
    }));
    assert.equal(result.brief.membershipType, scenario.membershipType);
    assert.ok(result.brief.homeClubIds.includes(scenario.homeClubId));
    assert.ok(result.brief.locationAnchors.includes(scenario.location));
    assert.ok(result.matches.length > 0 && result.matches.length <= 3, "Expected real catalogue matches");
    if (scenario.onlyClubId) assert.ok(result.matches.every(match => match.clubId === scenario.onlyClubId));
  }
  console.log(`${scenarios.length}/${scenarios.length} matching checks passed with real model output.`);
}

main().catch(error => {
  // Keep provider bodies and credentials out of terminal output.
  console.error(JSON.stringify({ error: error.name, status: typeof error.status === "number" ? error.status : undefined,
    ...(error.name === "AssertionError" ? { assertion: error.message } : {}) }));
  process.exitCode = 1;
});
