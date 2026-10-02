// Opt-in protected hosted acceptance using invented conversations only.
// Credentials are read from ignored local Vite environment files and never printed.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

assert.ok(process.argv.includes("--run"), "Pass --run to call the deployed demo with synthetic conversations.");
const root = fileURLToPath(new URL("../", import.meta.url));
const env = loadEnv("development", root, "VITE_");
assert.equal(env.VITE_FIREBASE_PROJECT_ID, "petey-dev-getcass");
assert.ok(env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN, "A registered local App Check debug credential is required.");
const base = `https://europe-west2-${env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/`;

function post(url, body, token, timeout = 195) {
  const config = [
    ...(token ? [`header = ${JSON.stringify(`X-Firebase-AppCheck: ${token}`)}`] : []),
    `data = ${JSON.stringify(JSON.stringify(body))}`,
  ].join("\n");
  const output = execFileSync("curl", ["--http1.1", "--silent", "--show-error", "--max-time", String(timeout),
    "--request", "POST", "--header", "Content-Type: application/json", "--header", "Origin: https://joinpetey.com",
    "--config", "-", "--write-out", "\n%{http_code}", url],
  { input: config, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  const boundary = output.lastIndexOf("\n");
  return { status: Number(output.slice(boundary + 1)), body: JSON.parse(output.slice(0, boundary)) };
}

for (const endpoint of ["runGymboxOnboardingTurnV1", "matchGymboxTrainersV1"]) {
  assert.equal(post(`${base}${endpoint}`, { data: { messages: [] } }, undefined, 30).status, 401,
    `${endpoint} must reject missing App Check`);
}
const exchange = post(`https://content-firebaseappcheck.googleapis.com/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/apps/${env.VITE_FIREBASE_APP_ID}:exchangeDebugToken?key=${env.VITE_FIREBASE_API_KEY}`,
  { debug_token: env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN }, undefined, 30);
assert.equal(exchange.status, 200, "App Check exchange must succeed");
const token = exchange.body.token;
assert.ok(token);

// Malformed authorised input must fail cleanly before rate counting or model work.
// The valid turn/journey below then checks that the same client can continue normally.
const invalid = post(`${base}runGymboxOnboardingTurnV1`, { data: { messages: [] } }, token, 30);
assert.equal(invalid.status, 400, "Authorised malformed input must be rejected");
assert.equal(invalid.body.error?.status, "INVALID_ARGUMENT");
console.log("PASS authorised malformed input is rejected cleanly");

function call(endpoint, messages) {
  const response = post(`${base}${endpoint}`, { data: { messages } }, token);
  assert.equal(response.status, 200, `${endpoint}: ${response.body.error?.message || "hosted call failed"}`);
  assert.ok(response.body.result);
  return response.body.result;
}
const turn = messages => call("runGymboxOnboardingTurnV1", messages);
const match = messages => call("matchGymboxTrainersV1", messages);
const opening = "What would you like a personal trainer to help you achieve?";
const message = (role, content) => ({ role, content });
const history = [message("assistant", opening), message("user", "I want to feel confident at my wedding in six months.")];
if (process.argv.includes("--recovery-only")) {
  const recovered = turn(history);
  assert.equal(typeof recovered.reply, "string");
  assert.ok(recovered.reply.length);
  console.log("PASS valid onboarding after rejected input");
  process.exit(0);
}
const answers = {
  goal: "I want to lose some body fat and feel stronger in my clothes, with a sustainable routine. That is the goal.",
  experience: "I'm a beginner, currently walking three times a week. I would like two gym sessions a week.",
  membership: "I live in Earlsfield but train near Bank. I am a Gymbox member with Bank as my home club and single-gym access.",
  access: "I am a member with single-gym access to Bank, my home club.",
  location: "Bank is the one area I would like to train near.",
  coaching: "Someone friendly and patient, who explains technique clearly and encourages me without shouting. No other preference.",
  budget: "Not sure yet about my per-session budget.",
};
let completed = false;
for (let i = 0; i < 12; i++) {
  const response = turn(history);
  assert.equal(typeof response.reply, "string");
  history.push(message("assistant", response.reply));
  console.log(`Hosted wedding journey, turn ${i + 1}: ${response.topic}`);
  if (response.readyForMatching) { completed = true; break; }
  assert.ok(answers[response.topic], `Unexpected next topic ${response.topic}`);
  if (response.topic === "budget") {
    assert.deepEqual(response.quickReplies, ["Not sure yet", "Flexible"]);
    assert.doesNotMatch(response.reply, /£85|£125|per hour|hourly/i);
  }
  history.push(message("user", answers[response.topic]));
}
assert.ok(completed, "The real hosted conversation must reach matching");
const wedding = match(history);
assert.ok(wedding.matches.length > 0 && wedding.matches.length <= 3);
assert.ok(wedding.matches.some(value => value.trainerId === "gb-demo-emma-carter"));
assert.match(wedding.brief.budget, /not sure|uncertain|unknown/i);
assert.doesNotMatch(wedding.matches.flatMap(value => value.reasons).join(" "), /afford|within (?:your |the )?budget|£\d/i);
console.log(`PASS wedding onboarding-to-matching: ${wedding.matches.map(value => value.trainerId).join(", ")}`);

function briefTranscript(practical) {
  return [message("assistant", opening), message("user",
    `I want to learn squats and deadlifts safely and get stronger. I'm a beginner, want a friendly patient trainer who explains technique, and have no other specialist needs. ${practical}`),
  message("assistant", "I have enough to find your matches.")];
}
const home = match(briefTranscript("I'm a Gymbox Annual member. My home club is Bank. I have not confirmed any additional club access. My per-session budget is Flexible."));
assert.ok(home.matches.length);
assert.ok(home.matches.every(value => value.clubId === "bank"), "Package names must not infer access");
console.log("PASS home club only despite package name");

const extra = match(briefTranscript("I'm a member with Bank as my home club. I explicitly confirm I can also access Farringdon. Exclude Bank from these results; match me at Farringdon only. My per-session budget is £70."));
assert.ok(extra.matches.length);
assert.ok(extra.matches.every(value => value.clubId === "farringdon"), "Exclusions must override home access");
console.log("PASS explicitly confirmed additional access and exclusion");

const uncovered = match(briefTranscript("I'm a member at Ealing, my home club, with no additional access. My per-session budget is Not sure yet."));
assert.equal(uncovered.matches.length, 0);
assert.ok(uncovered.emptyReason);
console.log("PASS uncovered club returns an honest empty state");

const refined = match([...history, message("user", "Please refine the matches: only Bank, and exclude Farringdon and Holborn. My budget is still not sure yet.")]);
assert.ok(refined.matches.length);
assert.ok(refined.matches.every(value => value.clubId === "bank"));
console.log("PASS refinement preserves the conversation and honours club restrictions");
const allClubs = match(briefTranscript("My home club is Bank. I have all clubs access. I only want Farringdon for training. My per-session budget is Flexible."));
assert.ok(allClubs.matches.length);
assert.ok(allClubs.matches.every(value => value.clubId === "farringdon"));
console.log("PASS all-clubs access with explicit training preference");

const restricted = match([...briefTranscript("My home club is Bank. I have all clubs access. My per-session budget is Flexible."), message("user", "My access changed: I can now only use Farringdon.")]);
assert.ok(restricted.matches.length);
assert.ok(restricted.matches.every(value => value.clubId === "farringdon"));
console.log("PASS latest restricted access replaces earlier all-clubs access");

for (const requirement of ["I want online personal training only.", "I require clinical rehabilitation expertise.", "I am 17 years old."]) {
  const unsupported = match(briefTranscript(`My home club is Bank. My budget is Flexible. ${requirement}`));
  assert.equal(unsupported.matches.length, 0);
  assert.ok(unsupported.emptyReason);
}
console.log("PASS online, rehabilitation and under-18 requirements produce honest empty results");
console.log("PASS protected Gymbox hosted acceptance");
