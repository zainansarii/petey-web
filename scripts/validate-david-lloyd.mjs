import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { TRAINERS, DEMO_CLUB_IDS } from "../functions-david-lloyd/lib/david-lloyd-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-david-lloyd/lib/david-lloyd-shared/locations.js";
import { resolveLocation } from "../functions-david-lloyd/lib/david-lloyd-shared/matching.js";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const sharp = require("sharp");
const root = new URL("../", import.meta.url);
assert.equal(TRAINERS.length, 10, "Exactly ten fictional trainer profiles belong in the demo");
assert.equal(new Set(TRAINERS.map(trainer => trainer.id)).size, 10);
assert.deepEqual([...DEMO_CLUB_IDS], ["raynes-park", "kingston", "colliers-wood"]);
assert.deepEqual(Object.fromEntries(DEMO_CLUB_IDS.map(id => [id, TRAINERS.filter(trainer => trainer.clubIds.includes(id)).length])),
  { "raynes-park": 4, kingston: 3, "colliers-wood": 3 });
assert.equal(CLUBS.length, 20, "Keep every verified Greater London club available to access/location handling");
assert.equal(new Set(CLUBS.map(club => club.id)).size, 20);
assert.equal(new Set(LONDON_LOCATIONS.map(location => location.id)).size, LONDON_LOCATIONS.length);
for (const club of CLUBS) {
  assert.equal(club.sourceUrl, `https://www.davidlloyd.co.uk/clubs/${club.id}/`);
  assert.equal(club.verifiedAt, "2026-09-29");
  assert.ok(club.address && club.latitude > 51.3 && club.latitude < 51.7 && club.longitude > -0.5 && club.longitude < 0.3);
  assert.equal(resolveLocation(club.name, LONDON_LOCATIONS)?.id, club.id, `${club.name} must resolve unambiguously`);
}
const portraits = [];
const hashes = [];
for (const trainer of TRAINERS) {
  assert.equal(trainer.kind, "synthetic");
  assert.ok(trainer.id.startsWith("dl-demo-"));
  assert.ok(trainer.name && trainer.bio && trainer.summary && trainer.expertise.length && trainer.qualifications.length);
  assert.equal(trainer.tier, null, "Do not inherit Third Space trainer tiers");
  assert.equal(trainer.clubIds.length, 1);
  assert.ok(DEMO_CLUB_IDS.includes(trainer.clubIds[0]));
  for (const field of ["sourceUrl", "verifiedAt", "price", "rating", "availability", "gender", "testimonials"]) {
    assert.equal(field in trainer, false, `${trainer.id} must not claim ${field}`);
  }
  assert.equal(trainer.photoUrl, `/david-lloyd-demo/trainers/${trainer.id}.webp`);
  const name = `${trainer.id}.webp`;
  portraits.push(name);
  const source = await readFile(new URL(`david-lloyd-demo/public/trainers/${name}`, root));
  assert.ok(source.length > 200 && source.toString("ascii", 0, 4) === "RIFF" && source.toString("ascii", 8, 12) === "WEBP");
  const { data: pixels, info } = await sharp(source).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < pixels.length; offset += info.channels) {
    const [red, green, blue] = pixels.subarray(offset, offset + 3);
    assert.ok(Math.max(red, green, blue) - Math.min(red, green, blue) <= 2, `${name} must have monochrome pixels`);
  }
  assert.deepEqual(await readFile(new URL(`dist-david-lloyd/trainers/${name}`, root)), source, `${name} must publish unchanged`);
  assert.deepEqual(await readFile(new URL(`third-space-demo/public/trainers/${name.replace("dl-demo-", "ts-demo-")}`, root)), source,
    `${name} must preserve the approved synthetic portrait`);
  hashes.push(createHash("sha256").update(source).digest("hex"));
}
assert.equal(new Set(hashes).size, 10);
assert.deepEqual((await readdir(new URL("david-lloyd-demo/public/trainers/", root))).sort(), portraits.sort());
assert.deepEqual((await readdir(new URL("dist-david-lloyd/trainers/", root))).sort(), portraits.sort());
await assert.rejects(access(new URL("public/david-lloyd-demo", root)), { code: "ENOENT" });

async function checkIsolation(buildPath) {
  const files = await readdir(new URL(buildPath, root), { recursive: true, withFileTypes: true });
  for (const file of files.filter(file => file.isFile())) {
    assert.ok(!file.parentPath.includes("/demo-data/"), "Do not publish research archives");
    if (/\.(?:js|json|html|txt|md)$/.test(file.name)) {
      const content = await readFile(`${file.parentPath}/${file.name}`, "utf8");
      assert.ok(!content.includes("www.thirdspace.london"), `${buildPath} contains Third Space source links`);
      assert.ok(!content.includes("ts-demo-"), `${buildPath} contains Third Space profile IDs`);
      assert.ok(!content.includes("£85/hour") && !content.includes("sessions from £85"), `${buildPath} inherited unsupported prices`);
    }
  }
}
await checkIsolation("dist-david-lloyd/");
await checkIsolation("functions-david-lloyd/lib/");
if (process.argv.includes("--core")) {
  await assert.rejects(access(new URL("dist/david-lloyd-demo", root)), { code: "ENOENT" });
}
const html = await readFile(new URL("dist-david-lloyd/index.html", root), "utf8");
assert.match(html, /noindex/);
assert.match(html, /\/david-lloyd-demo\/assets\//);
assert.ok(!(await readdir(new URL("dist-david-lloyd/assets/", root))).some(asset => /^fixture-.*\.js$/.test(asset)), "Do not ship fixture responses");
console.log("David Lloyd verified: 20 official Greater London clubs, 10 fictional trainers across 3 clubs, preserved monochrome portraits, isolated noindex build.");
