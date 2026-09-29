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

for (const endpoint of ["runDavidLloydOnboardingTurnV1", "matchDavidLloydTrainersV1"]) {
  assert.equal(post(`${base}${endpoint}`, { data: { messages: [] } }, undefined, 30).status, 401,
    `${endpoint} must reject missing App Check`);
}
const exchange = post(`https://content-firebaseappcheck.googleapis.com/v1/projects/${env.VITE_FIREBASE_PROJECT_ID}/apps/${env.VITE_FIREBASE_APP_ID}:exchangeDebugToken?key=${env.VITE_FIREBASE_API_KEY}`,
  { debug_token: env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN }, undefined, 30);
assert.equal(exchange.status, 200, "App Check exchange must succeed");
const token = exchange.body.token;
assert.ok(token);

function call(endpoint, messages) {
  const response = post(`${base}${endpoint}`, { data: { messages } }, token);
  assert.equal(response.status, 200, `${endpoint}: ${response.body.error?.message || "hosted call failed"}`);
  assert.ok(response.body.result);
  return response.body.result;
}
const turn = messages => call("runDavidLloydOnboardingTurnV1", messages);
const match = messages => call("matchDavidLloydTrainersV1", messages);
const opening = "What would you like a personal trainer to help you achieve?";
const message = (role, content) => ({ role, content });
const history = [message("assistant", opening), message("user", "I want to feel confident at my wedding in six months.")];
const answers = {
  goal: "I want to lose some body fat and feel stronger in my clothes, with a sustainable routine. That is the goal.",
  experience: "I'm a beginner, currently walking three times a week. I would like two gym sessions a week.",
  membership: "I'm not a member yet, but I'm based in Earlsfield and want to train nearby.",
  access: "I'm not a member yet. Please consider clubs near Earlsfield.",
  location: "Earlsfield is the one area I'd like to train near.",
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
assert.ok(wedding.matches.some(value => value.trainerId === "dl-demo-emma-carter"));
assert.match(wedding.brief.budget, /not sure|uncertain|unknown/i);
assert.doesNotMatch(wedding.matches.flatMap(value => value.reasons).join(" "), /afford|within (?:your |the )?budget|£\d/i);
console.log(`PASS wedding onboarding-to-matching: ${wedding.matches.map(value => value.trainerId).join(", ")}`);

function briefTranscript(practical) {
  return [message("assistant", opening), message("user",
    `I want to learn squats and deadlifts safely and get stronger. I'm a beginner, want a friendly patient trainer who explains technique, and have no other specialist needs. ${practical}`),
  message("assistant", "I have enough to find your matches.")];
}
const home = match(briefTranscript("I'm a David Lloyd Platinum member. My home club is Raynes Park. I have not confirmed any additional club access. My per-session budget is Flexible."));
assert.ok(home.matches.length);
assert.ok(home.matches.every(value => value.clubId === "raynes-park"), "Package names must not infer access");
console.log("PASS home club only despite package name");

const extra = match(briefTranscript("I'm a member with Raynes Park as my home club. I explicitly confirm I can also access Kingston. Exclude Raynes Park from these results; match me at Kingston only. My per-session budget is £70."));
assert.ok(extra.matches.length);
assert.ok(extra.matches.every(value => value.clubId === "kingston"), "Exclusions must override home access");
console.log("PASS explicitly confirmed additional access and exclusion");

const uncovered = match(briefTranscript("I'm a member at Acton Park, my home club, with no additional access. My per-session budget is Not sure yet."));
assert.equal(uncovered.matches.length, 0);
assert.ok(uncovered.emptyReason);
console.log("PASS uncovered club returns an honest empty state");

const refined = match([...history, message("user", "Please refine the matches: only Raynes Park, and exclude Kingston and Colliers Wood. My budget is still not sure yet.")]);
assert.ok(refined.matches.length);
assert.ok(refined.matches.every(value => value.clubId === "raynes-park"));
console.log("PASS refinement preserves the conversation and honours club restrictions");
console.log("PASS protected David Lloyd hosted acceptance");
