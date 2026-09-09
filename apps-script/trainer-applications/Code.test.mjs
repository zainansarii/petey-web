import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import test from "node:test";
import vm from "node:vm";

const code = readFileSync(new URL("./Code.gs", import.meta.url), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));
const bytes = (value) => typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value.map((byte) => byte & 255));

function harness() {
  let now = Date.parse("2026-09-07T10:00:00Z");
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const properties = { PETEY_FORM_ID: "form-one", PETEY_FUNCTION_BASE_URL: "https://europe-west2-petey-dev-getcass.cloudfunctions.net",
    PETEY_IMPORT_SECRET: "a-secret-that-is-at-least-32-characters", PETEY_BRIDGE_ENABLED: "true" };
  const requests = [];
  let failPhoto = false;
  let photoAck = { ready: true };
  let importAck = {};
  let locked = false;
  let canonicalReads = 0;
  const file = {
    getId: () => "photo-one", getLastUpdated: () => new Clock("2026-09-07T09:59:00Z"),
    getSize: () => 4, getMimeType: () => "image/png",
    getBlob: () => ({ getBytes: () => [1, 2, 3, 4], getContentType: () => "image/png" }),
  };
  const values = { fullName: "Sample Trainer", email: "person@example.com", photo: ["photo-one"], sessionPrice: "65.50" };
  const responses = [];
  const form = { getId: () => "form-one", getItems: () => items, getResponses: () => responses,
    getResponse: (id) => { canonicalReads += 1; return responses.find((entry) => entry.getId() === id); } };
  const context = vm.createContext({ Date: Clock, JSON, Number, String, Array, Math,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties[key] ?? null,
      setProperty: (key, value) => { properties[key] = value; },
      getProperties: () => ({ ...properties }),
      deleteProperty: (key) => { delete properties[key]; },
    }) },
    FormApp: { getActiveForm: () => form },
    DriveApp: { getFileById: () => file },
    LockService: { getScriptLock: () => ({ tryLock: () => !locked, releaseLock: () => {} }) },
    Utilities: { Charset: { UTF_8: "UTF_8" }, DigestAlgorithm: { SHA_256: "SHA_256" },
      computeDigest: (_algorithm, body) => [...createHash("sha256").update(bytes(body)).digest()],
      computeHmacSha256Signature: (body, key) => [...createHmac("sha256", key).update(body).digest()],
    },
    UrlFetchApp: { fetch: (url, options) => {
      requests.push({ url, options });
      const isPhoto = url.endsWith("PhotoV1");
      return { getResponseCode: () => isPhoto && failPhoto ? 503 : 200,
        getContentText: () => JSON.stringify(isPhoto ? photoAck : url.endsWith("SyncV1") ? { ok: true }
          : { applicationId: "application-one", revision: 1, contentHash: "server-hash", photoNeeded: true, ...importAck }) };
    } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({
      forForm: () => ({ onFormSubmit: () => ({ create: () => {} }) }),
      timeBased: () => ({ everyMinutes: (minutes) => { assert.equal(minutes, 15); return { create: () => {} }; } }),
    }) },
  });
  vm.runInContext(code, context);
  const items = context.PETEY_FIELDS.map(([key, title, type], index) => ({
    key, getId: () => index + 100, getTitle: () => title, getType: () => type,
  }));
  const response = { getId: () => "response-one", getTimestamp: () => new Clock("2026-09-07T09:00:00Z"),
    getEditResponseUrl: () => "https://docs.google.com/forms/edit-response?private",
    getItemResponses: () => items.filter((item) => item.key in values).map((item) => ({ getItem: () => item, getResponse: () => values[item.key] })),
  };
  responses.push(response);
  return { context, properties, requests, values, items, file, response, responses, form,
    advance: (ms) => { now += ms; }, failPhoto: (value) => { failPhoto = value; },
    photoAck: (value) => { photoAck = value; }, importAck: (value) => { importAck = value; },
    lock: () => { locked = true; }, canonicalReads: () => canonicalReads };
}

test("setup seeds exact stable item IDs and refuses recreated, renamed or added questions", () => {
  const h = harness();
  const result = h.context.setupPeteyTrainerBridge();
  assert.equal(result.questionCount, 21);
  assert.equal(JSON.parse(h.properties.PETEY_MAPPING_V1).fields.fullName.itemId, "100");
  h.items[0].getId = () => 999;
  assert.throws(() => h.context.setupPeteyTrainerBridge(), /MAPPING_DRIFT/);
  const extra = harness();
  extra.items.push({ getId: () => 999, getTitle: () => "Extra question", getType: () => "TEXT" });
  assert.throws(() => extra.context.setupPeteyTrainerBridge(), /COUNT_CHANGED/);
});

test("mapping preserves free text and original raw answers and supplies missing optional values", () => {
  const h = harness();
  const mapping = h.context.peteySeedMapping_(h.form);
  const result = clone(h.context.peteyResponsePayload_("form-one", h.response, mapping));
  assert.equal(result.answers.sessionPrice, "65.50");
  assert.equal(result.answers.professionalUrl, "");
  assert.deepEqual(result.answers.specialties, []);
  assert.equal(result.items.find((item) => item.itemId === "113").value, "65.50");
  assert.equal(result.items.length, 21);
});

test("canonical import and binary photo share backend-compatible raw-body HMAC without redirects", () => {
  const h = harness();
  h.context.setupPeteyTrainerBridge();
  h.context.peteyOnFormSubmit({ response: { getId: () => "response-one" } });
  assert.equal(h.canonicalReads(), 1);
  assert.equal(h.requests.length, 2);
  for (const { url, options } of h.requests) {
    const kind = url.endsWith("PhotoV1") ? "photo" : url.endsWith("SyncV1") ? "sync" : "import";
    const body = kind === "photo" ? bytes(options.payload.getBytes()) : Buffer.from(options.payload);
    const headers = options.headers;
    const message = [headers["X-Petey-Timestamp"], kind, headers["X-Petey-Application"] || "",
      headers["X-Petey-Revision"] || "", headers["X-Petey-File"] || "", createHash("sha256").update(body).digest("hex")].join("\n");
    assert.equal(headers["X-Petey-Signature"], createHmac("sha256", h.properties.PETEY_IMPORT_SECRET).update(message).digest("hex"));
    assert.equal(options.followRedirects, false);
  }
  const serialized = JSON.stringify(Object.fromEntries(Object.entries(h.properties).filter(([key]) => key.startsWith("PETEY_ACK"))));
  for (const secretValue of ["Sample Trainer", "person@example.com", "edit-response", "photo-one"]) assert(!serialized.includes(secretValue));
  assert(serialized.includes("server-hash"));
});

test("acknowledged response is skipped; edited canonical answers import even with unchanged timestamp", () => {
  const h = harness();
  h.context.setupPeteyTrainerBridge();
  h.context.reconcilePeteyTrainerApplications();
  h.advance(900000);
  h.context.reconcilePeteyTrainerApplications();
  assert.equal(h.requests.filter(({ url }) => url.endsWith("ApplicationV1")).length, 1);
  h.values.bio = "An edited biography";
  h.advance(900000);
  h.context.reconcilePeteyTrainerApplications();
  assert.equal(h.requests.filter(({ url }) => url.endsWith("ApplicationV1")).length, 2);
  assert.equal(h.canonicalReads(), 3);
});

test("failed photo is retried after backoff and never acknowledged as complete", () => {
  const h = harness();
  h.context.setupPeteyTrainerBridge();
  h.failPhoto(true);
  const first = h.context.reconcilePeteyTrainerApplications();
  assert.equal(first.errorCount, 1);
  const ackKey = Object.keys(h.properties).find((key) => key.startsWith("PETEY_ACK"));
  assert.equal(JSON.parse(h.properties[ackKey]).complete, false);
  h.failPhoto(false);
  h.context.reconcilePeteyTrainerApplications();
  assert.equal(h.requests.filter(({ url }) => url.endsWith("PhotoV1")).length, 1);
  h.advance(900000);
  h.context.reconcilePeteyTrainerApplications();
  assert.equal(h.requests.filter(({ url }) => url.endsWith("PhotoV1")).length, 2);
  assert.equal(JSON.parse(h.properties[ackKey]).complete, true);
});

test("exported unsupported-photo validation issue does not prevent a healthy sync", () => {
  const h = harness();
  h.file.getMimeType = () => "application/pdf";
  h.importAck({ photoNeeded: false });
  h.context.setupPeteyTrainerBridge();
  h.context.reconcilePeteyTrainerApplications();
  assert.equal(h.requests.length, 2);
  assert.equal(JSON.parse(h.requests[0].options.payload).photo.mimeType, "application/pdf");
  const sync = JSON.parse(h.requests[1].options.payload);
  assert.equal(sync.success, true);
  assert.equal(sync.errorCount, 0);
  const key = Object.keys(h.properties).find((name) => name.startsWith("PETEY_ACK"));
  assert.equal(JSON.parse(h.properties[key]).complete, true);
  assert.equal(JSON.parse(h.properties[key]).issue, "PHOTO_TYPE_UNSUPPORTED");
});

test("disabled bridge and held script lock perform no network requests", () => {
  const h = harness();
  h.properties.PETEY_BRIDGE_ENABLED = "false";
  assert.equal(h.context.reconcilePeteyTrainerApplications().disabled, true);
  h.properties.PETEY_BRIDGE_ENABLED = "true";
  h.lock();
  assert.equal(h.context.reconcilePeteyTrainerApplications().busy, true);
  assert.equal(h.requests.length, 0);
});

test("metadata/photo identity cannot leak shared secret to an arbitrary endpoint", () => {
  const h = harness();
  h.properties.PETEY_FUNCTION_BASE_URL = "https://example.com";
  assert.throws(() => h.context.setupPeteyTrainerBridge(), /CONFIGURATION_INVALID/);
  assert.equal(h.requests.length, 0);
});

test("chunked reconciliation advances a persisted sweep and reports full success only at its end", () => {
  const h = harness();
  h.responses.push({ ...h.response, getId: () => "response-two" });
  h.responses.push({ ...h.response, getId: () => "response-three" });
  h.context.PETEY_RUN_BUDGET_MS = 1;
  const canonical = h.form.getResponse;
  h.form.getResponse = (id) => { h.advance(2); return canonical(id); };
  h.context.setupPeteyTrainerBridge();
  for (let index = 1; index <= 3; index += 1) {
    const result = h.context.reconcilePeteyTrainerApplications();
    assert.equal(JSON.parse(h.properties.PETEY_SCAN_STATE).nextIndex, index);
    assert.equal(result.completed, index === 3);
    const sync = JSON.parse(h.requests.at(-1).options.payload);
    assert.equal(sync.success, index === 3);
  }
  assert.equal(h.requests.filter(({ url }) => url.endsWith("ApplicationV1")).length, 3);
});

test("partial sweep retains earlier failures, and a successful submit does not clear health", () => {
  const h = harness();
  h.responses.push({ ...h.response, getId: () => "response-two" });
  h.context.PETEY_RUN_BUDGET_MS = 1;
  const canonical = h.form.getResponse;
  h.form.getResponse = (id) => { h.advance(2); return canonical(id); };
  h.context.setupPeteyTrainerBridge();
  h.failPhoto(true);
  h.context.reconcilePeteyTrainerApplications();
  h.failPhoto(false);
  const firstSyncCount = h.requests.filter(({ url }) => url.endsWith("SyncV1")).length;
  h.context.peteyOnFormSubmit({ response: h.responses[1] });
  assert.equal(h.requests.filter(({ url }) => url.endsWith("SyncV1")).length, firstSyncCount);
  const second = h.context.reconcilePeteyTrainerApplications();
  assert.equal(second.completed, true);
  assert.equal(second.errorCount, 1);
  assert.equal(JSON.parse(h.requests.at(-1).options.payload).success, false);
});

test("corrupt or old acknowledgement state safely causes canonical reimport", () => {
  const h = harness();
  h.context.setupPeteyTrainerBridge();
  h.context.reconcilePeteyTrainerApplications();
  const key = Object.keys(h.properties).find((name) => name.startsWith("PETEY_ACK"));
  h.properties[key] = "{broken JSON";
  h.properties.PETEY_SCAN_STATE = JSON.stringify({ version: 999, nextIndex: 800, total: 1000 });
  h.advance(900000);
  const result = h.context.reconcilePeteyTrainerApplications();
  assert.equal(result.errorCount, 0);
  assert.equal(h.requests.filter(({ url }) => url.endsWith("ApplicationV1")).length, 2);
  assert.equal(JSON.parse(h.properties[key]).version, 2);
});

test("bounded acknowledgement cache preserves configuration and preferentially evicts old successes", () => {
  const h = harness();
  h.context.PETEY_ACK_LIMIT = 2;
  h.properties.PETEY_ACK_old = JSON.stringify({ version: 1, complete: true, acknowledgedAt: 1 });
  h.properties.PETEY_ACK_retry = JSON.stringify({ version: 1, complete: false, lastAttemptAt: 2 });
  h.context.setupPeteyTrainerBridge();
  h.context.reconcilePeteyTrainerApplications();
  assert.equal(Object.keys(h.properties).filter((key) => key.startsWith("PETEY_ACK")).length, 2);
  assert.equal(h.properties.PETEY_ACK_old, undefined);
  assert(h.properties.PETEY_ACK_retry);
  assert.equal(h.properties.PETEY_IMPORT_SECRET, "a-secret-that-is-at-least-32-characters");
});

test("superseded import and unconfirmed photo responses are not acknowledged as complete", () => {
  for (const kind of ["superseded", "photo"]) {
    const h = harness();
    if (kind === "superseded") h.importAck({ superseded: true, photoNeeded: false });
    else h.photoAck({});
    h.context.setupPeteyTrainerBridge();
    assert.equal(h.context.reconcilePeteyTrainerApplications().errorCount, 1);
    const key = Object.keys(h.properties).find((name) => name.startsWith("PETEY_ACK"));
    assert.equal(JSON.parse(h.properties[key]).complete, false);
  }
});

test("changed photo metadata reimports and transfers after a terminal validation acknowledgement", () => {
  const h = harness();
  h.file.getMimeType = () => "image/gif";
  h.importAck({ photoNeeded: false });
  h.context.setupPeteyTrainerBridge();
  assert.equal(h.context.reconcilePeteyTrainerApplications().errorCount, 0);
  h.advance(900000);
  assert.equal(h.context.reconcilePeteyTrainerApplications().errorCount, 0);
  assert.equal(h.requests.filter(({ url }) => url.endsWith("ApplicationV1")).length, 1);
  assert.equal(h.requests.filter(({ url }) => url.endsWith("PhotoV1")).length, 0);
  h.file.getMimeType = () => "image/png";
  h.file.getLastUpdated = () => new Date("2026-09-07T10:10:00Z");
  h.importAck({ photoNeeded: true, revision: 2, contentHash: "replacement-photo-hash" });
  h.advance(900000);
  assert.equal(h.context.reconcilePeteyTrainerApplications().errorCount, 0);
  assert.equal(h.requests.filter(({ url }) => url.endsWith("ApplicationV1")).length, 2);
  const photo = h.requests.find(({ url }) => url.endsWith("PhotoV1"));
  assert.equal(photo.options.headers["X-Petey-Revision"], "2");
  const key = Object.keys(h.properties).find((name) => name.startsWith("PETEY_ACK"));
  assert.equal(JSON.parse(h.properties[key]).issue, null);
});

test("missing and oversized photo metadata can be exported without hiding transfer failures", () => {
  for (const kind of ["missing", "oversized"]) {
    const h = harness();
    if (kind === "missing") h.values.photo = [];
    else h.file.getSize = () => 11 * 1024 * 1024;
    h.importAck({ photoNeeded: false });
    h.context.setupPeteyTrainerBridge();
    assert.equal(h.context.reconcilePeteyTrainerApplications().errorCount, 0);
    const key = Object.keys(h.properties).find((name) => name.startsWith("PETEY_ACK"));
    assert.equal(JSON.parse(h.properties[key]).complete, true);
  }
  const inaccessible = harness();
  inaccessible.file.getLastUpdated = () => { throw new Error("Drive unavailable"); };
  inaccessible.importAck({ photoNeeded: false });
  inaccessible.context.setupPeteyTrainerBridge();
  assert.equal(inaccessible.context.reconcilePeteyTrainerApplications().errorCount, 1);
  const key = Object.keys(inaccessible.properties).find((name) => name.startsWith("PETEY_ACK"));
  assert.equal(JSON.parse(inaccessible.properties[key]).complete, false);
});

test("an unconfirmed validation issue stays retryable if backend still requests its photo", () => {
  const h = harness();
  h.file.getMimeType = () => "image/gif";
  h.context.setupPeteyTrainerBridge();
  assert.equal(h.context.reconcilePeteyTrainerApplications().errorCount, 1);
  assert.equal(h.requests.filter(({ url }) => url.endsWith("PhotoV1")).length, 0);
  const key = Object.keys(h.properties).find((name) => name.startsWith("PETEY_ACK"));
  assert.equal(JSON.parse(h.properties[key]).complete, false);
});
