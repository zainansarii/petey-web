import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { TRAINERS } from "../functions-third-space/lib/third-space-shared/catalogue.js";
import { CLUBS, LONDON_LOCATIONS } from "../functions-third-space/lib/third-space-shared/locations.js";

assert.equal(TRAINERS.length, 40, "The demo must contain exactly 40 sourced trainers");
assert.equal(CLUBS.length, 16, "The demo must cover the 16 current clubs");
assert.equal(new Set(TRAINERS.map((trainer) => trainer.id)).size, 40, "Trainer IDs must be unique");
assert.equal(new Set(CLUBS.map((club) => club.id)).size, 16, "Club IDs must be unique");
const clubIds = new Set(CLUBS.map((club) => club.id));
assert.equal(new Set(LONDON_LOCATIONS.map((location) => location.id)).size, LONDON_LOCATIONS.length, "Location IDs must be unique");
for (const club of CLUBS) {
  assert.ok(TRAINERS.filter((trainer) => trainer.clubIds.includes(club.id)).length >= 2, `${club.name} needs two trainers`);
  assert.ok(club.address && club.sourceUrl.startsWith("https://www.thirdspace.london/"));
  assert.ok(club.latitude > 51.3 && club.latitude < 51.7 && club.longitude > -0.5 && club.longitude < 0.2, `${club.name} must have London coordinates`);
}
for (const trainer of TRAINERS) {
  assert.ok(trainer.name && trainer.bio && trainer.summary && trainer.expertise.length, `${trainer.id} is missing matching evidence`);
  assert.ok(trainer.clubIds.length && trainer.clubIds.every((id) => clubIds.has(id)), `${trainer.id} has invalid clubs`);
  assert.ok(trainer.sourceUrl.startsWith("https://www.thirdspace.london/trainer/"));
  assert.match(trainer.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  for (const field of ["price", "rating", "availability", "gender", "testimonials"]) {
    assert.equal(field in trainer, false, `${trainer.id} must not invent ${field}`);
  }
  if (trainer.photoUrl.startsWith("/third-space-demo/")) {
    await access(new URL(`../public${trainer.photoUrl}`, import.meta.url));
    await access(new URL(`../dist-third-space/${trainer.photoUrl.slice("/third-space-demo/".length)}`, import.meta.url));
  } else {
    assert.ok(trainer.photoUrl.startsWith("https://www.thirdspace.london/"), `${trainer.id} photo must have official provenance`);
  }
}
const html = await readFile(new URL("../dist-third-space/index.html", import.meta.url), "utf8");
assert.match(html, /noindex/);
assert.match(html, /\/third-space-demo\/assets\//);
const assets = await readdir(new URL("../dist-third-space/assets/", import.meta.url));
assert.ok(!assets.some((asset) => /^fixture-.*\.js$/.test(asset)), "Production must not ship fixture responses");
console.log("Third Space catalogue and build verified: 40 trainers, 16 clubs, sourced images, isolated assets, noindex.");
