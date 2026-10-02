// Opt-in real-model checks with synthetic conversations only. Build functions first.
// --force-retry injects one transient failure per stage before genuine model output.
import assert from "node:assert/strict";
import { createOpenAIClient, generateOpenAIText } from "../functions-gymbox/lib/functions/src/openai.js";
import { generateModelResponse } from "../functions-gymbox/lib/functions-gymbox/src/generation.js";
import { createGymboxService } from "../functions-gymbox/lib/functions-gymbox/src/service.js";
import { OPENING_MESSAGE } from "../functions-gymbox/lib/gymbox-shared/contract.js";
import { TRAINERS } from "../functions-gymbox/lib/gymbox-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-gymbox/lib/gymbox-shared/locations.js";

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY before running this opt-in evaluation.");
  const client = createOpenAIClient(process.env.OPENAI_API_KEY);
  const forcedRetry = process.argv.includes("--force-retry");
  let candidates;
  const service = createGymboxService(request => {
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
    ...["bank", "farringdon"].map(clubId => ({
      name: `Home-club member at ${clubId}, package unknown`,
      answer: `${goal} I am a Gymbox member and my home club is ${CLUBS.find(club => club.id === clubId).name}. My budget is not sure yet.`,
      home: clubId, only: clubId, package: "", budget: /not sure|uncertain|unknown/i,
    })),
    { name: "Annual student contract never grants other-club access",
      answer: `${goal} I have an annual student membership and Bank is my home club. My budget is £20 per session.`,
      home: "bank", only: "bank", budget: /20/ },
    { name: "Explicit all-clubs access includes both populated clubs",
      answer: `${goal} My home club is Bank. I have all gyms access. My budget per session is flexible.`,
      home: "bank", clubs: 2, budget: /flexible/i },
    { name: "Additional Farringdon access preserves Bank",
      answer: `${goal} My home club is Bank. I can also use Farringdon. My budget per session is flexible.`,
      home: "bank", clubs: 2 },
    { name: "Latest restricted list replaces all-clubs access",
      answer: `${goal} My home club is Bank and I previously had all clubs access. I can now only use Farringdon. My budget is £60 per session.`,
      home: "bank", only: "farringdon" },
    { name: "Exclusions override all-clubs access",
      answer: `${goal} My home club is Bank. I have all clubs access. Exclude Bank from results. My budget is flexible.`,
      home: "bank", only: "farringdon", excluded: "bank" },
    { name: "Single-gym is independent of contract duration",
      answer: `${goal} I have a monthly single-gym membership with Bank as my home club. My budget is not sure yet.`,
      home: "bank", only: "bank" },
    { name: "Ealing has no fictional sample trainers",
      answer: `${goal} I am a member with my home club at Ealing. My budget is flexible.`, home: "ealing", empty: true },
    { name: "One area for a non-member",
      answer: `${goal} I am not a Gymbox member. I want to train around Bank. Not sure about budget yet.`,
      membership: "non-member", location: "Bank" },
    { name: "Unknown member access yields an honest empty result",
      answer: `${goal} I am a member with annual membership but do not know my home club or access. I want to train near Bank. My budget is flexible.`,
      membership: "member", location: "Bank", empty: true },
    { name: "Only-want training preference does not alter all-club access",
      answer: `${goal} My home club is Bank and I have all clubs access. I only want Farringdon. My budget is flexible.`,
      home: "bank", only: "farringdon" },
    { name: "Olympic lifting yields one evidenced trainer",
      answer: "I want a trainer with Olympic lifting expertise. I train twice a week and prefer structured coaching. I am a member at Farringdon, my home club, and my budget per session is flexible.",
      home: "farringdon", only: "farringdon", trainer: "gb-demo-theo-parker", count: 1 },
    { name: "Unsupported clinical rehabilitation is not mobility coaching",
      answer: "I specifically require clinical rehabilitation expertise, not general mobility. I am a member with Bank as my home club and my budget is flexible.",
      home: "bank", empty: true },
    { name: "Online-only cannot claim unverified sample provision",
      answer: `${goal} I want online personal training only. My home club is Bank and my budget is flexible.`,
      home: "bank", empty: true },
    { name: "Volunteered under-18 requirement blocks PT matching",
      answer: `${goal} I am 17 years old. My home club is Bank and my budget is flexible.`,
      home: "bank", empty: true },
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
      if (scenario.count) assert.equal(result.matches.length, scenario.count);
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
