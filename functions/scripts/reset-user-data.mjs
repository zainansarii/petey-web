#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { applicationDefault, deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export const DATABASE_ID = "(default)";
export const SEED_ID = "codex-demo-trainers-v1";
export const SEED_UIDS = Object.freeze([
  "petey-demo-trainer-maya-chen",
  "petey-demo-trainer-marcus-adebayo",
  "petey-demo-trainer-aliyah-rahman",
  "petey-demo-trainer-rohan-kapoor",
]);

const SEED_UID_SET = new Set(SEED_UIDS);
const AUTH_SEED_CLAIM = "peteyDemoSeed";
const ALLOWED_PROJECTS = Object.freeze({
  "petey-dev-getcass": "petey-dev-getcass.firebasestorage.app",
  "petey-prod-getcass": "petey-prod-getcass.firebasestorage.app",
});

const BLOCKING_COLLECTIONS = Object.freeze([
  "reports",
  "_moderationReports",
  "_moderationIdentityTombstones",
  "_moderationPairTombstones",
  "_storageModerationHolds",
  "legalHolds",
  "_legalHolds",
  "moderationEvidence",
  "_moderationEvidence",
]);

const EXACT_SEED_DOCUMENT_COLLECTIONS = new Set([
  "accounts",
  "trainerProfiles",
  "publicTrainers",
]);

const SEED_AWARE_COLLECTIONS = new Set([
  ...EXACT_SEED_DOCUMENT_COLLECTIONS,
  "consents",
  "trainerReviewDecisions",
  "_uploadTickets",
]);

// This is intentionally an allowlist. A new non-empty root collection makes
// the reset stop until its retention and seed-preservation policy is reviewed.
export const FULL_RESET_COLLECTIONS = Object.freeze([
  "accounts",
  "trainerProfiles",
  "publicTrainers",
  "clientProfiles",
  "clientHealth",
  "consents",
  "discoverySessions",
  "discoveryHistory",
  "chats",
  "blocks",
  "notificationEvents",
  "notifications",
  "introductionRequests",
  "trainerRequests",
  "requests",
  "_rateLimits",
  "_phoneNumberClaims",
  "_pushTokenClaims",
  "_emailClaims",
  "_uploadTickets",
  "_orphanUploadCandidates",
  "trainerReviewDecisions",
  "webOnboardingDrafts",
  "webOnboardingRateLimits",
  "webOnboardingDraftsV2",
  "webOnboardingRateLimitsV2",
  "_webOnboardingRateLimitsV2",
  "_webOnboardingConsumptionsV2",
  "webOnboardingDraftsV3",
  "_webOnboardingRateLimitsV3",
  "_webOnboardingConsumptionsV3",
  "webClientProfiles",
  "_webClientConciergeNotes",
  "webClientHealth",
  "webConsents",
  "webClientConsents",
  "webConsentRecords",
  "webClientConsentRecords",
  "_webConsentRecords",
]);

// This scope is intentionally Firestore-only. It removes web onboarding data
// without touching Auth, mobile/client data, trainers, chats, notifications,
// or Cloud Storage.
export const WEB_ONBOARDING_RESET_COLLECTIONS = Object.freeze([
  "webOnboardingDrafts",
  "webOnboardingRateLimits",
  "webOnboardingDraftsV2",
  "webOnboardingRateLimitsV2",
  "_webOnboardingRateLimitsV2",
  "_webOnboardingConsumptionsV2",
  "webOnboardingDraftsV3",
  "_webOnboardingRateLimitsV3",
  "_webOnboardingConsumptionsV3",
  "webClientProfiles",
  "_webClientConciergeNotes",
  "webClientHealth",
  "webConsents",
  "webClientConsents",
  "webConsentRecords",
  "webClientConsentRecords",
  "_webConsentRecords",
]);

const V1_SWEEP_COLLECTIONS = Object.freeze([
  "webOnboardingDrafts",
  "webOnboardingRateLimits",
]);

const KNOWN_ROOT_COLLECTIONS = new Set([
  ...FULL_RESET_COLLECTIONS,
  ...BLOCKING_COLLECTIONS,
]);

const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i;
const EMULATOR_VARIABLES = Object.freeze([
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
  "STORAGE_EMULATOR_HOST",
]);

class ResetAbort extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ResetAbort";
    this.code = code;
  }
}

const abort = (code, message) => {
  throw new ResetAbort(code, message);
};

const requireValue = (argv, index, option) => {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    abort("invalid-arguments", `${option} requires a value.`);
  }
  return value;
};

export const parseArgs = (argv) => {
  const result = {
    projectId: null,
    confirmationProjectId: null,
    execute: false,
    scope: "full",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--project") {
      result.projectId = requireValue(argv, index, option);
      index += 1;
    } else if (option === "--confirm-project") {
      result.confirmationProjectId = requireValue(argv, index, option);
      index += 1;
    } else if (option === "--execute") {
      result.execute = true;
    } else if (option === "--dry-run") {
      result.execute = false;
    } else if (option === "--scope") {
      result.scope = requireValue(argv, index, option);
      index += 1;
    } else if (option === "--help" || option === "-h") {
      result.help = true;
    } else {
      abort("invalid-arguments", `Unsupported option: ${option}`);
    }
  }

  if (result.help) return result;
  if (!result.projectId || !result.confirmationProjectId) {
    abort(
      "project-confirmation-required",
      "Pass the target project with both --project and --confirm-project.",
    );
  }
  if (result.projectId !== result.confirmationProjectId) {
    abort("project-confirmation-mismatch", "The two project IDs do not match.");
  }
  if (!Object.hasOwn(ALLOWED_PROJECTS, result.projectId)) {
    abort("project-not-allowed", "The requested project is not in the reset allowlist.");
  }
  if (!["full", "v1-web-drafts", "web-onboarding"].includes(result.scope)) {
    abort("invalid-scope", "--scope must be full, web-onboarding, or v1-web-drafts.");
  }
  return result;
};

export const parseDatabaseDescriptor = (payload, expectedProjectId) => {
  const result = payload?.result ?? payload;
  const name = typeof result?.name === "string" ? result.name : "";
  const expectedName = `projects/${expectedProjectId}/databases/${DATABASE_ID}`;
  if (name !== expectedName) {
    abort("database-target-mismatch", "Firebase returned a different database target.");
  }
  if (result?.type !== "FIRESTORE_NATIVE") {
    abort("database-type-unsupported", "The default database is not Firestore Native mode.");
  }
  const rawEdition = result?.databaseEdition ?? result?.edition;
  const edition = typeof rawEdition === "string" ? rawEdition.toUpperCase() : "";
  if (!["STANDARD", "ENTERPRISE"].includes(edition)) {
    abort("database-edition-unverified", "The Firestore database edition could not be verified.");
  }
  return { name, edition };
};

const parseFirebaseJson = (command) => {
  const execution = spawnSync(
    "npx",
    ["-y", "firebase-tools@latest", ...command, "--json"],
    {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      timeout: 120_000,
      env: process.env,
    },
  );
  if (execution.error || execution.status !== 0) {
    abort("firebase-cli-auth-failed", "Firebase CLI authentication or target verification failed.");
  }
  try {
    return JSON.parse(execution.stdout);
  } catch {
    abort("firebase-cli-invalid-response", "Firebase CLI returned an unreadable verification response.");
  }
};

const assertNoEmulators = () => {
  const configured = EMULATOR_VARIABLES.filter((name) => process.env[name]);
  if (configured.length > 0) {
    const allLoopback = configured.every((name) => LOOPBACK_HOST.test(process.env[name]));
    const suffix = allLoopback ? "" : " and at least one host is not loopback";
    abort(
      "emulator-environment-refused",
      `Unset Firebase emulator variables before running this live-project command${suffix}.`,
    );
  }
};

const verifyControlPlane = (projectId) => {
  const loginPayload = parseFirebaseJson(["login:list"]);
  const loginResult = loginPayload?.result ?? loginPayload;
  if (!Array.isArray(loginResult) || loginResult.length === 0) {
    abort("firebase-cli-auth-failed", "No authenticated Firebase CLI account is available.");
  }
  const databasePayload = parseFirebaseJson([
    "firestore:databases:get",
    DATABASE_ID,
    "--project",
    projectId,
  ]);
  return parseDatabaseDescriptor(databasePayload, projectId);
};

export const hasDemoSeedMarker = (data) => data?.demoSeed?.id === SEED_ID;

export const shouldPreserveRootDocument = (collectionName, documentId, data) => {
  if (EXACT_SEED_DOCUMENT_COLLECTIONS.has(collectionName)) {
    return SEED_UID_SET.has(documentId) && hasDemoSeedMarker(data);
  }
  if (collectionName === "consents") {
    // Seed consent parents can be virtual (only their records subcollection
    // exists), so their records are classified individually below.
    return SEED_UID_SET.has(documentId);
  }
  if (collectionName === "trainerReviewDecisions") {
    return SEED_UID_SET.has(data?.trainerId) && hasDemoSeedMarker(data);
  }
  if (collectionName === "_uploadTickets") {
    return SEED_UID_SET.has(data?.ownerUid) && data?.demoSeedId === SEED_ID;
  }
  return false;
};

const runLimited = async (items, limit, worker) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      await worker(items[current], current);
    }
  });
  await Promise.all(runners);
};

const listRootDocumentRefs = async (collectionRef) => collectionRef.listDocuments();

const countDocumentTree = async (documentRef) => {
  const [snapshot, subcollections] = await Promise.all([
    documentRef.get(),
    documentRef.listCollections(),
  ]);
  let count = snapshot.exists ? 1 : 0;
  for (const subcollection of subcollections) {
    const children = await subcollection.listDocuments();
    for (const child of children) count += await countDocumentTree(child);
  }
  return count;
};

const countCollectionTree = async (collectionRef) => {
  const refs = await collectionRef.listDocuments();
  let count = 0;
  for (const ref of refs) count += await countDocumentTree(ref);
  return count;
};

const markerProjection = (collectionName, collectionRef) => {
  if (EXACT_SEED_DOCUMENT_COLLECTIONS.has(collectionName) || collectionName === "consents") {
    return collectionRef.select("demoSeed.id");
  }
  if (collectionName === "trainerReviewDecisions") {
    return collectionRef.select("trainerId", "demoSeed.id");
  }
  if (collectionName === "_uploadTickets") {
    return collectionRef.select(
      "ownerUid",
      "demoSeedId",
      "objectPath",
      "category",
    );
  }
  return collectionRef;
};

const loadMarkerData = async (collectionName, db) => {
  if (!SEED_AWARE_COLLECTIONS.has(collectionName)) return new Map();
  const snapshot = await markerProjection(collectionName, db.collection(collectionName)).get();
  return new Map(snapshot.docs.map((document) => [document.id, document.data()]));
};

const addOperation = async (operations, rootName, ref, recursive = true) => {
  const documentCount = recursive
    ? await countDocumentTree(ref)
    : (await ref.get()).exists ? 1 : 0;
  if (documentCount === 0) return;
  operations.push({ ref, recursive, rootName, documentCount });
};

const addAllSubcollectionOperations = async (operations, rootName, documentRef) => {
  const subcollections = await documentRef.listCollections();
  for (const subcollection of subcollections) {
    const refs = await subcollection.listDocuments();
    for (const ref of refs) await addOperation(operations, rootName, ref, true);
  }
};

const classifySeedConsent = async (operations, rootName, parentRef, parentData) => {
  if (parentData && !hasDemoSeedMarker(parentData)) {
    await addOperation(operations, rootName, parentRef, false);
  }
  const subcollections = await parentRef.listCollections();
  for (const subcollection of subcollections) {
    const refs = await subcollection.listDocuments();
    if (subcollection.id !== "records") {
      for (const ref of refs) await addOperation(operations, rootName, ref, true);
      continue;
    }
    for (const ref of refs) {
      const snapshot = await ref.get();
      const data = snapshot.data();
      const preserve = data?.uid === parentRef.id && hasDemoSeedMarker(data);
      if (preserve) {
        await addAllSubcollectionOperations(operations, rootName, ref);
      } else {
        await addOperation(operations, rootName, ref, true);
      }
    }
  }
};

const inventoryFirestore = async (db, collectionNames) => {
  const operations = [];
  for (const collectionName of collectionNames) {
    const collectionRef = db.collection(collectionName);
    const refs = await listRootDocumentRefs(collectionRef);
    const markerData = await loadMarkerData(collectionName, db);
    for (const ref of refs) {
      const data = markerData.get(ref.id);
      const preserve = shouldPreserveRootDocument(collectionName, ref.id, data);
      if (!preserve) {
        await addOperation(operations, collectionName, ref, true);
      } else if (collectionName === "consents") {
        await classifySeedConsent(operations, collectionName, ref, data);
      } else {
        // Seed top-level documents are preserved, but unexpected operational
        // child data (for example devices) is still part of the reset.
        await addAllSubcollectionOperations(operations, collectionName, ref);
      }
    }
  }
  return operations;
};

export const assertEmptyBlockingCollections = async (db) => {
  const blockers = [];
  for (const collectionName of BLOCKING_COLLECTIONS) {
    const count = await countCollectionTree(db.collection(collectionName));
    if (count > 0) blockers.push({ collectionName, count });
  }
  if (blockers.length > 0) {
    const counts = Object.fromEntries(blockers.map(({ collectionName, count }) => [collectionName, count]));
    const error = new ResetAbort(
      "retention-hold-present",
      "Moderation evidence or legal-hold records are present; reset is prohibited.",
    );
    error.counts = counts;
    throw error;
  }
};

const assertKnownRootCollections = async (db) => {
  const rootCollections = await db.listCollections();
  const unknown = rootCollections
    .map((collectionRef) => collectionRef.id)
    .filter((name) => !KNOWN_ROOT_COLLECTIONS.has(name));
  if (unknown.length === 0) return;
  const counts = {};
  for (const collectionName of unknown) {
    counts[collectionName] = await countCollectionTree(db.collection(collectionName));
  }
  const populated = Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));
  if (Object.keys(populated).length === 0) return;
  const error = new ResetAbort(
    "unclassified-root-collections",
    "Unclassified root collections contain data; update the reset policy before proceeding.",
  );
  error.counts = populated;
  throw error;
};

const listAllAuthUsers = async (auth) => {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1_000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
};

const inventoryAuth = async (auth) => {
  const users = await listAllAuthUsers(auth);
  const byUid = new Map(users.map((user) => [user.uid, user]));
  for (const uid of SEED_UIDS) {
    const user = byUid.get(uid);
    if (!user || user.customClaims?.[AUTH_SEED_CLAIM] !== SEED_ID) {
      abort("seed-auth-invalid", "A required demo trainer Auth seed marker is missing.");
    }
  }
  for (const user of users) {
    if (user.customClaims?.[AUTH_SEED_CLAIM] === SEED_ID && !SEED_UID_SET.has(user.uid)) {
      abort("unexpected-auth-seed", "An unexpected Auth user carries the protected seed marker.");
    }
  }
  return users.filter((user) => !SEED_UID_SET.has(user.uid)).map((user) => user.uid);
};

const assertSeedFirestore = async (db) => {
  for (const uid of SEED_UIDS) {
    const required = [
      db.collection("accounts").doc(uid),
      db.collection("trainerProfiles").doc(uid),
      db.collection("publicTrainers").doc(uid),
      db.collection("trainerReviewDecisions").doc(`${uid}_1`),
      db.collection("consents").doc(uid).collection("records")
        .doc(`${SEED_ID}-references-v1`),
    ];
    const snapshots = await db.getAll(...required);
    const [account, trainer, publicTrainer, review, consent] = snapshots;
    const coreDocumentsAreValid = [account, trainer, publicTrainer]
      .every((snapshot) => snapshot?.exists && hasDemoSeedMarker(snapshot.data()));
    const reviewData = review?.data();
    const consentData = consent?.data();
    if (
      !coreDocumentsAreValid
      || !review?.exists
      || !hasDemoSeedMarker(reviewData)
      || reviewData?.trainerId !== uid
      || !consent?.exists
      || !hasDemoSeedMarker(consentData)
      || consentData?.uid !== uid
    ) {
      abort("seed-firestore-invalid", "A required demo trainer Firestore seed marker is missing.");
    }
  }
};

export const assertBucketDeletionPolicies = (metadata) => {
  if (metadata?.versioning?.enabled === true) {
    abort("storage-versioning-enabled", "Disable Cloud Storage Object Versioning before the irreversible reset.");
  }
  const softDeleteSeconds = metadata?.softDeletePolicy?.retentionDurationSeconds;
  if (softDeleteSeconds === undefined || !Number.isFinite(Number(softDeleteSeconds))) {
    abort("storage-soft-delete-unverified", "Cloud Storage soft-delete status could not be verified.");
  }
  if (Number(softDeleteSeconds) > 0) {
    abort("storage-soft-delete-enabled", "Disable Cloud Storage soft delete before the irreversible reset.");
  }
  if (Number(metadata?.retentionPolicy?.retentionPeriod ?? 0) > 0) {
    abort("storage-retention-policy-active", "Remove or satisfy the bucket retention policy before the reset.");
  }
};

export const assertObjectDeletionAllowed = (metadata) => {
  const held = metadata?.temporaryHold === true
    || metadata?.temporaryHold === "true"
    || metadata?.eventBasedHold === true
    || metadata?.eventBasedHold === "true";
  const retainedUntil = Date.parse(metadata?.retentionExpirationTime ?? "");
  if (held || (Number.isFinite(retainedUntil) && retainedUntil > Date.now())) {
    abort("storage-object-held", "An onboarding object is held or still under retention; reset is prohibited.");
  }
};

export const storageOwnerFromPath = (objectName) => {
  const match = /^onboarding\/([^/]+)\//.exec(objectName);
  return match?.[1] ?? null;
};

const listOnboardingFiles = async (bucket) => {
  const files = [];
  let query = {
    prefix: "onboarding/",
    autoPaginate: false,
    maxResults: 1_000,
    versions: true,
  };
  while (query) {
    const [page, nextQuery] = await bucket.getFiles(query);
    files.push(...page);
    query = nextQuery ?? null;
  }
  return files;
};

const inventoryStorage = async (bucket, db) => {
  const files = await listOnboardingFiles(bucket);
  const targetFiles = [];
  const seedCounts = Object.fromEntries(SEED_UIDS.map((uid) => [uid, 0]));
  const expectedSeedPaths = new Map();
  const seenSeedPaths = new Map(SEED_UIDS.map((uid) => [uid, new Set()]));
  for (const uid of SEED_UIDS) {
    const profile = await db.collection("trainerProfiles").doc(uid).get();
    const manifest = profile.data()?.approvedUploadManifest;
    if (!Array.isArray(manifest) || manifest.length === 0) {
      abort("seed-storage-manifest-invalid", "A protected demo trainer has no approved upload manifest.");
    }
    const paths = manifest.map((entry) => entry?.objectPath);
    if (paths.some((path) => typeof path !== "string" || storageOwnerFromPath(path) !== uid)) {
      abort("seed-storage-manifest-invalid", "A protected demo trainer upload manifest has an invalid owner path.");
    }
    expectedSeedPaths.set(uid, new Set(paths));
  }
  for (const file of files) {
    const [metadata] = await file.getMetadata();
    assertObjectDeletionAllowed(metadata);
    const ownerUid = storageOwnerFromPath(file.name);
    if (!ownerUid || !SEED_UID_SET.has(ownerUid)) {
      targetFiles.push(file);
      continue;
    }
    if (!expectedSeedPaths.get(ownerUid)?.has(file.name)) {
      abort("seed-storage-unexpected", "A protected demo trainer object is absent from its approved manifest.");
    }
    const customMetadata = Object.fromEntries(
      Object.entries(metadata.metadata ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );
    if (customMetadata.owneruid !== ownerUid || !customMetadata.uploadticketid) {
      abort("seed-storage-invalid", "A protected demo trainer object has invalid ownership metadata.");
    }
    const ticket = await db.collection("_uploadTickets").doc(customMetadata.uploadticketid).get();
    const ticketData = ticket.data();
    if (
      !ticket.exists
      || ticketData?.ownerUid !== ownerUid
      || ticketData?.demoSeedId !== SEED_ID
      || ticketData?.objectPath !== file.name
    ) {
      abort("seed-storage-ticket-invalid", "A protected demo trainer object lacks its seeded upload ticket.");
    }
    seedCounts[ownerUid] += 1;
    seenSeedPaths.get(ownerUid).add(file.name);
  }
  for (const uid of SEED_UIDS) {
    const expected = expectedSeedPaths.get(uid);
    const seen = seenSeedPaths.get(uid);
    if (seedCounts[uid] === 0 || expected.size !== seen.size || [...expected].some((path) => !seen.has(path))) {
      abort("seed-storage-missing", "A protected demo trainer is missing approved seeded Storage objects.");
    }
  }
  return { filesToDelete: targetFiles, preservedCount: files.length - targetFiles.length };
};

export const operationsByRoot = (operations) => {
  const counts = {};
  for (const operation of operations) {
    counts[operation.rootName] = (counts[operation.rootName] ?? 0) + operation.documentCount;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
};

const executeAuthDeletes = async (auth, uids) => {
  for (let index = 0; index < uids.length; index += 1_000) {
    const batch = uids.slice(index, index + 1_000);
    const result = await auth.deleteUsers(batch);
    if (result.failureCount > 0) {
      abort("auth-delete-failed", "At least one non-seed Auth user could not be deleted.");
    }
  }
};

const executeFirestoreDeletes = async (db, operations) => {
  await runLimited(operations, 4, async ({ ref, recursive }) => {
    if (recursive) await db.recursiveDelete(ref);
    else await ref.delete();
  });
};

const executeStorageDeletes = async (files) => {
  await runLimited(files, 20, async (file) => {
    await file.delete({ ignoreNotFound: true });
  });
};

const initializeConnections = async (projectId) => {
  const storageBucket = ALLOWED_PROJECTS[projectId];
  let app;
  try {
    app = initializeApp({
      credential: applicationDefault(),
      projectId,
      storageBucket,
    }, `petey-web-reset-${Date.now()}`);
    if (app.options.projectId !== projectId || app.options.storageBucket !== storageBucket) {
      await deleteApp(app);
      abort("admin-target-mismatch", "Firebase Admin target verification failed.");
    }
  } catch (error) {
    if (app) await deleteApp(app).catch(() => undefined);
    if (error instanceof ResetAbort) throw error;
    abort(
      "admin-auth-failed",
      "Firebase Admin credentials are unavailable. Run gcloud auth application-default login and retry the dry run.",
    );
  }
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app, DATABASE_ID),
    bucket: getStorage(app).bucket(storageBucket),
  };
};

const assertAdminAccess = async ({ auth, db, bucket }, scope) => {
  let bucketMetadata;
  try {
    await db.listCollections();
    if (scope === "full") {
      const [, metadataResponse] = await Promise.all([auth.listUsers(1), bucket.getMetadata()]);
      [bucketMetadata] = metadataResponse;
    }
  } catch {
    abort(
      "admin-auth-failed",
      "Firebase Admin authentication or service access verification failed. Refresh Application Default Credentials with gcloud auth application-default login, then verify IAM access.",
    );
  }
  if (scope === "full") assertBucketDeletionPolicies(bucketMetadata);
};

export const buildResetPlan = async (connections, scope = "full") => {
  await assertAdminAccess(connections, scope);
  await assertEmptyBlockingCollections(connections.db);

  if (scope === "v1-web-drafts") {
    return {
      authUids: [],
      firestoreOperations: await inventoryFirestore(
        connections.db,
        V1_SWEEP_COLLECTIONS,
      ),
      storageInventory: { filesToDelete: [], preservedCount: 0 },
    };
  }

  if (scope === "web-onboarding") {
    return {
      authUids: [],
      firestoreOperations: await inventoryFirestore(
        connections.db,
        WEB_ONBOARDING_RESET_COLLECTIONS,
      ),
      storageInventory: { filesToDelete: [], preservedCount: 0 },
    };
  }

  if (scope !== "full") abort("invalid-scope", "Unsupported reset scope.");
  await assertKnownRootCollections(connections.db);
  await assertSeedFirestore(connections.db);
  const authUids = await inventoryAuth(connections.auth);
  const storageInventory = await inventoryStorage(connections.bucket, connections.db);
  const firestoreOperations = await inventoryFirestore(
    connections.db,
    FULL_RESET_COLLECTIONS,
  );
  return { authUids, firestoreOperations, storageInventory };
};

const summary = ({
  args,
  database,
  authDeleteCount,
  firestoreOperations,
  storageDeleteCount,
  storagePreservedCount,
}) => ({
  status: args.execute ? "executed" : "dry-run",
  scope: args.scope,
  projectId: args.projectId,
  databaseId: DATABASE_ID,
  databaseEdition: database.edition,
  preservedSeedIds: SEED_UIDS,
  counts: {
    authUsersToDelete: authDeleteCount,
    authUsersPreserved: args.scope === "full" ? SEED_UIDS.length : 0,
    firestoreDocumentsToDeleteByRootCollection: operationsByRoot(firestoreOperations),
    storageObjectsToDelete: storageDeleteCount,
    storageObjectsPreserved: storagePreservedCount,
  },
});

export const run = async (argv) => {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(
      "Usage: npm run reset:user-data -- --project <id> --confirm-project <id> "
      + "[--dry-run|--execute] [--scope full|web-onboarding|v1-web-drafts]\n",
    );
    return;
  }

  assertNoEmulators();
  const database = verifyControlPlane(args.projectId);
  const connections = await initializeConnections(args.projectId);
  try {
    const {
      authUids,
      firestoreOperations,
      storageInventory,
    } = await buildResetPlan(connections, args.scope);

    const result = summary({
      args,
      database,
      authDeleteCount: authUids.length,
      firestoreOperations,
      storageDeleteCount: storageInventory.filesToDelete.length,
      storagePreservedCount: storageInventory.preservedCount,
    });

    if (args.execute) {
      // Inventory and every preservation/hold check completes before the first
      // destructive operation. The rollout runbook requires a maintenance window.
      await executeAuthDeletes(connections.auth, authUids);
      await executeFirestoreDeletes(connections.db, firestoreOperations);
      await executeStorageDeletes(storageInventory.filesToDelete);
      const verification = await buildResetPlan(connections, args.scope);
      if (
        verification.authUids.length > 0
        || verification.firestoreOperations.length > 0
        || verification.storageInventory.filesToDelete.length > 0
      ) {
        abort(
          "post-reset-verification-failed",
          "The post-reset inventory still contains non-seed targets; keep maintenance enabled and rerun the dry-run.",
        );
      }
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await deleteApp(connections.app);
  }
};

const isDirectInvocation = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectInvocation) {
  run(process.argv.slice(2)).catch((error) => {
    const payload = {
      status: "aborted",
      code: error instanceof ResetAbort ? error.code : "unexpected-error",
      message: error instanceof ResetAbort
        ? error.message
        : "The reset stopped before completion. Review service logs without exporting user data.",
      ...(error instanceof ResetAbort && error.counts ? { counts: error.counts } : {}),
    };
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exitCode = 1;
  });
}
