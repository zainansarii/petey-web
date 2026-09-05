#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import console from "node:console";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL, URL } from "node:url";
import { trainerSchema } from "../lib/src/features/discovery/model/trainer.js";

export const PROJECT_ID = "petey-dev-getcass";
export const DATABASE_ID = "(default)";
const SEED_ID = "codex-demo-trainers-v1";
const MIGRATION_ID = "web-demo-catalog-v1";

export const loadSeed = async () => {
  const input = JSON.parse(await readFile(new URL("./demo-web-trainers.json", import.meta.url), "utf8"));
  const entries = input.map((value) => trainerSchema.parse(value));
  if (entries.length !== 8 || new Set(entries.map(({ id }) => id)).size !== 8) {
    throw new Error("The migration must contain eight distinct demo trainers.");
  }
  for (const entry of entries) {
    if (!entry.id.startsWith("petey-demo-trainer-") || entry.isDemo !== true || "distanceMiles" in entry) {
      throw new Error("Migration entries must be demo trainers without a client-specific distance.");
    }
  }
  return entries;
};

export const checkExistingTrainer = (seed, snapshots) => {
  const [publicSnapshot, profileSnapshot, accountSnapshot] = snapshots;
  for (const snapshot of snapshots) {
    if (!snapshot.exists || snapshot.data()?.demoSeed?.id !== SEED_ID) {
      throw new Error(`Refusing to change missing or non-seed document ${snapshot.ref.path}.`);
    }
  }
  const projection = publicSnapshot.data();
  const privateProfile = profileSnapshot.data();
  const account = accountSnapshot.data();
  if (
    projection.trainerId !== seed.id
    || projection.fullName !== seed.name
    || projection.published !== true
    || projection.approvalStatus !== "approved"
    || privateProfile.approvalStatus !== "approved"
    || privateProfile.approvedProfileVersion !== projection.profileVersion
    || privateProfile.approvedProfile?.primaryPhotoPath !== projection.primaryPhotoPath
    || account.role !== "trainer"
    || account.status !== "active"
  ) {
    throw new Error(`The approved published seed state is inconsistent for ${seed.id}.`);
  }
  if (
    typeof projection.primaryPhotoPath !== "string"
    || !projection.primaryPhotoPath.startsWith(`onboarding/${seed.id}/profile/`)
    || projection.primaryPhotoPath.slice(`onboarding/${seed.id}/profile/`.length).includes("/")
  ) {
    throw new Error(`The existing photo does not belong to ${seed.id}.`);
  }
  if (projection.webProfile && projection.webProfileSource !== MIGRATION_ID) {
    throw new Error(`A different publisher already owns the web profile for ${seed.id}.`);
  }
  // Reuse approved photos already present in Storage. Never publish Vite asset
  // paths, upload private evidence, or grant public bucket access.
  return trainerSchema.parse({ ...seed, photo: projection.primaryPhotoPath });
};

const decodeValue = (value) => {
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {})
    .map(([key, nested]) => [key, decodeValue(nested)]));
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("timestampValue" in value) return new Date(value.timestampValue);
  if ("nullValue" in value) return null;
  return Object.values(value)[0];
};

const encodeValue = (value) => {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, encodeValue(nested)]),
  ) } };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "string") return { stringValue: value };
  throw new Error("Unsupported migration field value.");
};

export const createRestConnection = (token, request = globalThis.fetch) => {
  const database = `projects/${PROJECT_ID}/databases/${DATABASE_ID}`;
  const baseUrl = `https://firestore.googleapis.com/v1/${database}/documents`;
  const fetchJson = async (url, body) => {
    const response = await request(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(`Google API request failed (${response.status}): ${payload.error?.message ?? "unknown error"}`);
    return payload;
  };
  const readDocuments = async (refs, transaction) => {
    const payload = await fetchJson(`${baseUrl}:batchGet`, {
      documents: refs.map(({ path }) => `${database}/documents/${path}`),
      ...(transaction ? { transaction } : {}),
    });
    const byName = new Map(payload.map((item) => [item.found?.name ?? item.missing, item.found]));
    return refs.map((ref) => {
      const document = byName.get(`${database}/documents/${ref.path}`);
      const data = document ? decodeValue({ mapValue: { fields: document.fields ?? {} } }) : undefined;
      return { ref, exists: Boolean(document), updateTime: document?.updateTime, data: () => data };
    });
  };
  return {
    Timestamp: { now: () => new Date() },
    db: {
      collection: (collection) => ({ doc: (id) => ({ path: `${collection}/${id}` }) }),
      getAll: (...refs) => readDocuments(refs),
      terminate: async () => {},
      runTransaction: async (callback) => {
        const { transaction } = await fetchJson(`${baseUrl}:beginTransaction`, { options: { readWrite: {} } });
        const writes = [];
        const readVersions = new Map();
        try {
          const result = await callback({
            getAll: async (...refs) => {
              const snapshots = await readDocuments(refs, transaction);
              snapshots.forEach((snapshot) => readVersions.set(snapshot.ref.path, snapshot.updateTime));
              return snapshots;
            },
            update: (ref, fields) => {
              const updateTime = readVersions.get(ref.path);
              if (!updateTime) throw new Error("Only existing transaction-read documents may be updated.");
              writes.push({
                update: { name: `${database}/documents/${ref.path}`, fields: encodeValue(fields).mapValue.fields },
                updateMask: { fieldPaths: Object.keys(fields) },
                currentDocument: { updateTime },
              });
            },
          });
          await fetchJson(`${baseUrl}:commit`, { transaction, writes });
          return result;
        } catch (error) {
          await fetchJson(`${baseUrl}:rollback`, { transaction }).catch(() => {});
          throw error;
        }
      },
    },
    bucket: {
      file: (path) => ({
        exists: async () => {
          const response = await request(`https://storage.googleapis.com/storage/v1/b/${PROJECT_ID}.firebasestorage.app/o/${encodeURIComponent(path)}?fields=name`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.status === 404) return [false];
          if (!response.ok) throw new Error(`Storage metadata check failed (${response.status}).`);
          return [true];
        },
      }),
    },
  };
};

const connect = async () => {
  if (["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]
    .some((key) => process.env[key])) {
    throw new Error("Unset emulator hosts before running the live dev catalog migration.");
  }
  // Use REST with the explicit existing gcloud token. This avoids local ADC
  // selection by GoogleAuth while keeping all tokens in memory.
  const token = execFileSync("gcloud", ["auth", "print-access-token", "--project", PROJECT_ID], {
    encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  return createRestConnection(token);

};

const refsFor = (db, id) => [
  db.collection("publicTrainers").doc(id),
  db.collection("trainerProfiles").doc(id),
  db.collection("accounts").doc(id),
];

const unchangedMobileFields = (data) => Object.fromEntries(
  Object.entries(data).filter(([key]) => ![
    "webProfile", "webProfileSchemaVersion", "webProfileSource", "webProfileUpdatedAt",
  ].includes(key)),
);

export const migrate = async ({ db, bucket, Timestamp }, seed, { apply = false } = {}) => {
  const before = new Map();
  // Preflight the complete migration before any write, including every existing
  // protected image. A missing demo is an error rather than a partial import.
  for (const trainer of seed) {
    const snapshots = await db.getAll(...refsFor(db, trainer.id));
    const profile = checkExistingTrainer(trainer, snapshots);
    const [photoExists] = await bucket.file(profile.photo).exists();
    if (!photoExists) throw new Error(`Approved photo missing from Storage for ${trainer.id}.`);
    before.set(trainer.id, snapshots[0].data());
  }

  const changed = [];
  if (apply) {
    await db.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(...seed.flatMap(({ id }) => refsFor(db, id)));
      const writes = seed.map((trainer, index) => {
        const group = snapshots.slice(index * 3, index * 3 + 3);
        const webProfile = checkExistingTrainer(trainer, group);
        if (!isDeepStrictEqual(unchangedMobileFields(before.get(trainer.id)), unchangedMobileFields(group[0].data()))) {
          throw new Error(`The trainer changed during preflight: ${trainer.id}. Retry the migration.`);
        }
        return { trainer, snapshot: group[0], webProfile };
      });
      for (const { trainer, snapshot, webProfile } of writes) {
        if (isDeepStrictEqual(snapshot.data().webProfile, webProfile)
          && snapshot.data().webProfileSchemaVersion === 1
          && snapshot.data().webProfileSource === MIGRATION_ID) continue;
        transaction.update(snapshot.ref, {
          webProfile,
          webProfileSchemaVersion: 1,
          webProfileSource: MIGRATION_ID,
          webProfileUpdatedAt: Timestamp.now(),
        });
        changed.push(trainer.id);
      }
    });
  }

  const results = [];
  for (const trainer of seed) {
    const snapshots = await db.getAll(...refsFor(db, trainer.id));
    const expected = checkExistingTrainer(trainer, snapshots);
    const after = snapshots[0].data();
    if (!isDeepStrictEqual(unchangedMobileFields(before.get(trainer.id)), unchangedMobileFields(after))) {
      throw new Error(`Mobile fields changed unexpectedly for ${trainer.id}.`);
    }
    const migrated = isDeepStrictEqual(after.webProfile, expected)
      && after.webProfileSchemaVersion === 1 && after.webProfileSource === MIGRATION_ID;
    if (apply && !migrated) throw new Error(`Read-back verification failed for ${trainer.id}.`);
    results.push({ id: trainer.id, migrated, wouldChange: !migrated });
  }
  return { projectId: PROJECT_ID, databaseId: DATABASE_ID, mode: apply ? "apply" : "dry-run", changed, trainers: results };
};

const main = async () => {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => !["--apply", "--validate", `--project=${PROJECT_ID}`].includes(argument))) {
    throw new Error(`Usage: node scripts/migrate-demo-web-trainers.mjs [--validate | --apply --project=${PROJECT_ID}]`);
  }
  const seed = await loadSeed();
  if (arguments_.includes("--validate")) {
    if (arguments_.includes("--apply")) throw new Error("Choose validation or apply.");
    console.log(JSON.stringify({ mode: "validate", valid: true, trainers: seed.map(({ id }) => id) }, null, 2));
    return;
  }
  const apply = arguments_.includes("--apply");
  if (apply && !arguments_.includes(`--project=${PROJECT_ID}`)) {
    throw new Error(`Writes require --project=${PROJECT_ID}; production is intentionally unsupported.`);
  }
  const connection = await connect();
  try {
    console.log(JSON.stringify(await migrate(connection, seed, { apply }), null, 2));
  } finally {
    await connection.db.terminate();
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
