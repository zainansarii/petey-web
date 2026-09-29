import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { TRAINERS, DEMO_CLUB_IDS } from "../functions-third-space/lib/third-space-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-third-space/lib/third-space-shared/locations.js";

const require = createRequire(new URL("../functions/package.json", import.meta.url));
const sharp = require("sharp");
const root = new URL("../", import.meta.url);
const archivePath = "demo-data/third-space/archive/2026-09-24/";
const archive = new URL(archivePath, root);
const archivedTrainers = JSON.parse(await readFile(new URL("catalogue.json", archive), "utf8"));
const manifest = JSON.parse(await readFile(new URL("manifest.json", archive), "utf8"));
const originalSource = await readFile(new URL("catalogue.ts.txt", archive), "utf8");
assert.deepEqual(JSON.parse(originalSource.match(/export const TRAINERS: ThirdSpaceTrainer\[\] = ([\s\S]*);\s*$/)[1]), archivedTrainers,
  "Archived JSON must preserve every field in the exact original source");
assert.equal(archivedTrainers.length, 40, "Keep all 40 original sourced profiles");
assert.equal(new Set(archivedTrainers.map(trainer => trainer.id)).size, 40);
assert.equal(manifest.trainerCount, 40);
const expectedArchiveFiles = ["catalogue.json", "catalogue.ts.txt", "locations.ts.txt", "sources.md",
  ...archivedTrainers.map(trainer => `trainers/${trainer.id}.webp`)].sort();
assert.deepEqual(Object.keys(manifest.files).sort(), expectedArchiveFiles, "Checksum every archived source and portrait");
for (const [path, expected] of Object.entries(manifest.files)) {
  const data = await readFile(new URL(path, archive));
  assert.equal(data.length, expected.bytes, `${path}: archived size changed`);
  assert.equal(createHash("sha256").update(data).digest("hex"), expected.sha256, `${path}: archived bytes changed`);
}
assert.deepEqual((await readdir(new URL("trainers/", archive))).sort(), archivedTrainers.map(trainer => `${trainer.id}.webp`).sort());

assert.equal(TRAINERS.length, 10, "The active demo must contain exactly 10 synthetic trainers");
assert.equal(new Set(TRAINERS.map(trainer => trainer.id)).size, 10, "Trainer IDs must be unique");
assert.deepEqual([...DEMO_CLUB_IDS], ["wimbledon", "richmond", "clapham-junction"]);
assert.deepEqual(Object.fromEntries(DEMO_CLUB_IDS.map(id => [id, TRAINERS.filter(trainer => trainer.clubIds.includes(id)).length])),
  { wimbledon: 4, richmond: 3, "clapham-junction": 3 }, "Keep the 4/3/3 demo distribution");
assert.equal(CLUBS.length, 16, "Preserve the 16 real clubs for membership and location handling");
assert.equal(new Set(CLUBS.map(club => club.id)).size, 16);
assert.equal(new Set(LONDON_LOCATIONS.map(location => location.id)).size, LONDON_LOCATIONS.length);
const clubIds = new Set(CLUBS.map(club => club.id));
for (const club of CLUBS) {
  assert.ok(club.address && club.sourceUrl.startsWith("https://www.thirdspace.london/"));
  assert.ok(club.latitude > 51.3 && club.latitude < 51.7 && club.longitude > -0.5 && club.longitude < 0.2, `${club.name} must have London coordinates`);
}
const portraits = [];
const portraitHashes = [];
for (const trainer of TRAINERS) {
  assert.equal(trainer.kind, "synthetic", `${trainer.id} must be explicitly fictional`);
  assert.ok(trainer.id.startsWith("ts-demo-"));
  assert.ok(trainer.name && trainer.bio && trainer.summary && trainer.expertise.length && trainer.qualifications.length,
    `${trainer.id} is missing matching evidence`);
  assert.equal(trainer.clubIds.length, 1);
  assert.ok(trainer.clubIds.every(id => clubIds.has(id) && DEMO_CLUB_IDS.includes(id)), `${trainer.id} has invalid demo clubs`);
  assert.ok(!archivedTrainers.some(original => original.id === trainer.id || original.name === trainer.name), `${trainer.id} reuses an original identity`);
  for (const field of ["sourceUrl", "verifiedAt", "price", "rating", "availability", "gender", "testimonials"]) {
    assert.equal(field in trainer, false, `${trainer.id} must not claim ${field}`);
  }
  assert.equal(trainer.photoUrl, `/third-space-demo/trainers/${trainer.id}.webp`);
  const name = `${trainer.id}.webp`;
  portraits.push(name);
  const source = await readFile(new URL(`third-space-demo/public/trainers/${name}`, root));
  assert.ok(source.length > 200 && source.toString("ascii", 0, 4) === "RIFF" && source.toString("ascii", 8, 12) === "WEBP", `${name} must be WebP`);
  const { data: pixels, info } = await sharp(source).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < pixels.length; offset += info.channels) {
    const [red, green, blue] = pixels.subarray(offset, offset + 3);
    assert.ok(Math.max(red, green, blue) - Math.min(red, green, blue) <= 2, `${name} must contain black-and-white pixels, not rely on CSS`);
  }
  assert.deepEqual(await readFile(new URL(`dist-third-space/trainers/${name}`, root)), source, `${name} must be copied unchanged`);
  portraitHashes.push(createHash("sha256").update(source).digest("hex"));
}
assert.equal(new Set(portraitHashes).size, 10, "Each synthetic profile needs its own portrait");
assert.deepEqual((await readdir(new URL("third-space-demo/public/trainers/", root))).sort(), portraits.sort(), "Only active synthetic portraits belong in demo public assets");
assert.deepEqual((await readdir(new URL("dist-third-space/trainers/", root))).sort(), portraits.sort(), "Only active synthetic portraits may be published");
await assert.rejects(access(new URL("public/third-space-demo", root)), { code: "ENOENT" }, "Core public assets must not contain the demo");

async function assertNoArchive(buildPath) {
  const files = await readdir(new URL(buildPath, root), { recursive: true, withFileTypes: true });
  for (const file of files.filter(file => file.isFile())) {
    assert.ok(!file.parentPath.includes("/demo-data/"), `${buildPath} includes archive files`);
    assert.ok(!archivedTrainers.some(trainer => file.name === `${trainer.id}.webp`), `${buildPath} includes an archived portrait`);
    if (/\.(?:js|json|html|txt|md)$/.test(file.name)) {
      const text = await readFile(`${file.parentPath}/${file.name}`, "utf8");
      for (const trainer of archivedTrainers) {
        assert.ok(!text.includes(trainer.sourceUrl) && !text.includes(trainer.bio), `${buildPath} includes archived ${trainer.id} data`);
      }
    }
  }
}
await assertNoArchive("dist-third-space/");
await assertNoArchive("functions-third-space/lib/");
// Opt in after a fresh core build; do not mistake a stale dist directory for this release.
if (process.argv.includes("--core")) {
  await assertNoArchive("dist/");
  await assert.rejects(access(new URL("dist/third-space-demo", root)), { code: "ENOENT" }, "Core build must not publish demo assets");
}
const html = await readFile(new URL("dist-third-space/index.html", root), "utf8");
assert.match(html, /noindex/);
assert.match(html, /\/third-space-demo\/assets\//);
const assets = await readdir(new URL("dist-third-space/assets/", root));
assert.ok(!assets.some(asset => /^fixture-.*\.js$/.test(asset)), "Production must not ship fixture responses");
console.log("Third Space verified: 10 synthetic trainers across 3 demo clubs; 40 originals archived with checksums; isolated assets and noindex.");
