import assert from "node:assert/strict";
import test from "node:test";
import { deserialize, serialize } from "node:v8";
import { checkExistingTrainer, createRestConnection, loadSeed, migrate } from "./migrate-demo-web-trainers.mjs";

const seed = await loadSeed();
const clone = (value) => deserialize(serialize(value));

const documentsFor = (trainer) => ({
  [`publicTrainers/${trainer.id}`]: {
    trainerId: trainer.id, fullName: trainer.name,
    published: true, approvalStatus: "approved", profileVersion: 1,
    primaryPhotoPath: trainer.photo, exposureCount: 9,
    demoSeed: { id: "codex-demo-trainers-v1" },
  },
  [`trainerProfiles/${trainer.id}`]: {
    approvalStatus: "approved", approvedProfileVersion: 1,
    approvedProfile: { primaryPhotoPath: trainer.photo },
    demoSeed: { id: "codex-demo-trainers-v1" },
  },
  [`accounts/${trainer.id}`]: {
    role: "trainer", status: "active", demoSeed: { id: "codex-demo-trainers-v1" },
  },
});

const snapshot = (path, data) => ({ ref: { path }, exists: Boolean(data), data: () => data });
const snapshotsFor = (trainer, documents) => ["publicTrainers", "trainerProfiles", "accounts"]
  .map((collection) => snapshot(`${collection}/${trainer.id}`, documents[`${collection}/${trainer.id}`]));

const harness = () => {
  const documents = Object.assign({}, ...seed.map(documentsFor));
  let writes = 0;
  const getAll = async (...refs) => refs.map(({ path }) => snapshot(path, clone(documents[path])));
  return {
    documents,
    writes: () => writes,
    connection: {
      Timestamp: { now: () => "server-time" },
      bucket: { file: () => ({ exists: async () => [true] }) },
      db: {
        collection: (collection) => ({ doc: (id) => ({ path: `${collection}/${id}` }) }),
        getAll,
        runTransaction: async (callback) => callback({
          getAll,
          update: ({ path }, fields) => {
            writes += 1;
            documents[path] = { ...documents[path], ...fields };
          },
        }),
      },
    },
  };
};

test("web catalog seed has all eight complete demo profiles without fabricated distances", () => {
  assert.equal(seed.length, 8);
  assert(seed.every((trainer) => trainer.isDemo === true && !("distanceMiles" in trainer)));
});

test("migration refuses non-seed, suspended and inconsistent approved versions", () => {
  const trainer = seed[0];
  for (const change of [
    (docs) => { docs[`publicTrainers/${trainer.id}`].demoSeed.id = "someone-else"; },
    (docs) => { docs[`accounts/${trainer.id}`].status = "suspended"; },
    (docs) => { docs[`trainerProfiles/${trainer.id}`].approvedProfileVersion = 2; },
  ]) {
    const documents = documentsFor(trainer);
    change(documents);
    assert.throws(() => checkExistingTrainer(trainer, snapshotsFor(trainer, documents)));
  }
});

test("dry-run writes nothing; apply preserves mobile records; repeat is a no-op", async () => {
  const setup = harness();
  const before = clone(setup.documents);
  const dryRun = await migrate(setup.connection, seed);
  assert.equal(setup.writes(), 0);
  assert.equal(dryRun.trainers.filter((trainer) => trainer.wouldChange).length, 8);
  assert.deepEqual(setup.documents, before);

  const result = await migrate(setup.connection, seed, { apply: true });
  assert.equal(result.changed.length, 8);
  assert.equal(setup.writes(), 8);
  for (const [path, fields] of Object.entries(before)) {
    if (!path.startsWith("publicTrainers/")) {
      assert.deepEqual(setup.documents[path], fields);
      continue;
    }
    for (const [key, value] of Object.entries(fields)) assert.deepEqual(setup.documents[path][key], value);
  }
  const repeat = await migrate(setup.connection, seed, { apply: true });
  assert.deepEqual(repeat.changed, []);
  assert.equal(setup.writes(), 8);
});

test("a missing protected photo aborts before any migration write", async () => {
  const setup = harness();
  setup.connection.bucket.file = () => ({ exists: async () => [false] });
  await assert.rejects(() => migrate(setup.connection, seed, { apply: true }), /photo missing/);
  assert.equal(setup.writes(), 0);
});

test("REST commit is scoped to read documents, exact fields and update-time preconditions", async () => {
  const requests = [];
  const documentName = `projects/petey-dev-getcass/databases/(default)/documents/publicTrainers/${seed[0].id}`;
  const updateTime = "2026-09-05T10:00:00.123456Z";
  const connection = createRestConnection("test-token", async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url, body });
    let payload = {};
    if (url.endsWith(":beginTransaction")) payload = { transaction: "transaction-one" };
    if (url.endsWith(":batchGet")) payload = [{ found: {
      name: documentName, updateTime, fields: { fullName: { stringValue: seed[0].name } },
    } }];
    return { ok: true, status: 200, json: async () => payload };
  });
  const ref = connection.db.collection("publicTrainers").doc(seed[0].id);
  await connection.db.runTransaction(async (transaction) => {
    await transaction.getAll(ref);
    transaction.update(ref, { webProfile: seed[0], webProfileSchemaVersion: 1 });
  });
  const commit = requests.find(({ url }) => url.endsWith(":commit")).body;
  assert.equal(commit.transaction, "transaction-one");
  assert.equal(commit.writes.length, 1);
  assert.equal(commit.writes[0].update.name, documentName);
  assert.deepEqual(commit.writes[0].updateMask.fieldPaths, ["webProfile", "webProfileSchemaVersion"]);
  assert.deepEqual(commit.writes[0].currentDocument, { updateTime });
  assert.equal(requests.find(({ url }) => url.endsWith(":batchGet")).body.transaction, "transaction-one");

  await assert.rejects(() => connection.db.runTransaction(async (transaction) => {
    transaction.update(ref, { webProfile: seed[0] });
  }), /transaction-read/);
  assert.equal(requests.filter(({ url }) => url.endsWith(":commit")).length, 1);
  assert.equal(requests.filter(({ url }) => url.endsWith(":rollback")).length, 1);
});
