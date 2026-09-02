import assert from "node:assert/strict";
import test from "node:test";
import {
  DATABASE_ID,
  FULL_RESET_COLLECTIONS,
  WEB_ONBOARDING_RESET_COLLECTIONS,
  SEED_ID,
  SEED_UIDS,
  assertBucketDeletionPolicies,
  assertEmptyBlockingCollections,
  assertObjectDeletionAllowed,
  hasDemoSeedMarker,
  parseArgs,
  parseDatabaseDescriptor,
  shouldPreserveRootDocument,
  storageOwnerFromPath,
} from "./reset-user-data.mjs";

const devArgs = [
  "--project",
  "petey-dev-getcass",
  "--confirm-project",
  "petey-dev-getcass",
];

test("dry-run is the default and the project must be supplied twice", () => {
  assert.deepEqual(parseArgs(devArgs), {
    projectId: "petey-dev-getcass",
    confirmationProjectId: "petey-dev-getcass",
    execute: false,
    scope: "full",
    help: false,
  });
  assert.throws(
    () => parseArgs(["--project", "petey-dev-getcass"]),
    (error) => error.code === "project-confirmation-required",
  );
  assert.throws(
    () => parseArgs([
      "--project",
      "petey-dev-getcass",
      "--confirm-project",
      "petey-prod-getcass",
    ]),
    (error) => error.code === "project-confirmation-mismatch",
  );
});

test("execute mode is explicit and targets remain allowlisted", () => {
  assert.equal(parseArgs([...devArgs, "--execute"]).execute, true);
  assert.equal(parseArgs([...devArgs, "--execute", "--dry-run"]).execute, false);
  assert.throws(
    () => parseArgs([
      "--project",
      "some-other-project",
      "--confirm-project",
      "some-other-project",
    ]),
    (error) => error.code === "project-not-allowed",
  );
});

test("the database descriptor must prove the exact default Native database and edition", () => {
  assert.deepEqual(
    parseDatabaseDescriptor({
      result: {
        name: `projects/petey-dev-getcass/databases/${DATABASE_ID}`,
        type: "FIRESTORE_NATIVE",
        databaseEdition: "STANDARD",
      },
    }, "petey-dev-getcass"),
    {
      name: "projects/petey-dev-getcass/databases/(default)",
      edition: "STANDARD",
    },
  );
  assert.throws(
    () => parseDatabaseDescriptor({
      result: {
        name: "projects/petey-dev-getcass/databases/secondary",
        databaseEdition: "STANDARD",
      },
    }, "petey-dev-getcass"),
    (error) => error.code === "database-target-mismatch",
  );
  assert.throws(
    () => parseDatabaseDescriptor({
      result: {
        name: "projects/petey-dev-getcass/databases/(default)",
        type: "FIRESTORE_NATIVE",
      },
    }, "petey-dev-getcass"),
    (error) => error.code === "database-edition-unverified",
  );
  assert.throws(
    () => parseDatabaseDescriptor({
      result: {
        name: "projects/petey-dev-getcass/databases/(default)",
        databaseEdition: "STANDARD",
      },
    }, "petey-dev-getcass"),
    (error) => error.code === "database-type-unsupported",
  );
});

test("only the four marked demo trainers qualify for preservation", () => {
  const uid = SEED_UIDS[0];
  const marker = { demoSeed: { id: SEED_ID } };
  assert.equal(hasDemoSeedMarker(marker), true);
  assert.equal(shouldPreserveRootDocument("accounts", uid, marker), true);
  assert.equal(shouldPreserveRootDocument("accounts", uid, {}), false);
  assert.equal(shouldPreserveRootDocument("accounts", "petey-demo-trainer-extra", marker), false);
  assert.equal(shouldPreserveRootDocument("consents", uid, undefined), true);
  assert.equal(shouldPreserveRootDocument(
    "trainerReviewDecisions",
    "opaque-review-id",
    { trainerId: uid, ...marker },
  ), true);
  assert.equal(shouldPreserveRootDocument(
    "_uploadTickets",
    "opaque-ticket-id",
    { ownerUid: uid, demoSeedId: SEED_ID },
  ), true);
});

test("Storage preservation uses the exact onboarding owner segment", () => {
  assert.equal(
    storageOwnerFromPath("onboarding/petey-demo-trainer-maya-chen/profile/photo.png"),
    "petey-demo-trainer-maya-chen",
  );
  assert.equal(storageOwnerFromPath("onboarding/petey-demo-trainer-maya-chen"), null);
  assert.equal(storageOwnerFromPath("other/petey-demo-trainer-maya-chen/photo.png"), null);
});

test("Storage reset refuses recoverable or held deletion states", () => {
  assert.doesNotThrow(() => assertBucketDeletionPolicies({
    versioning: { enabled: false },
    softDeletePolicy: { retentionDurationSeconds: "0" },
  }));
  assert.throws(
    () => assertBucketDeletionPolicies({ softDeletePolicy: { retentionDurationSeconds: "604800" } }),
    (error) => error.code === "storage-soft-delete-enabled",
  );
  assert.throws(
    () => assertBucketDeletionPolicies({}),
    (error) => error.code === "storage-soft-delete-unverified",
  );
  assert.throws(
    () => assertBucketDeletionPolicies({ versioning: { enabled: true } }),
    (error) => error.code === "storage-versioning-enabled",
  );
  assert.throws(
    () => assertObjectDeletionAllowed({ temporaryHold: true }),
    (error) => error.code === "storage-object-held",
  );
});

test("descendant-only moderation or legal-hold records block the reset", async () => {
  const leaf = {
    get: async () => ({ exists: true }),
    listCollections: async () => [],
  };
  const virtualParent = {
    get: async () => ({ exists: false }),
    listCollections: async () => [{ listDocuments: async () => [leaf] }],
  };
  const emptyCollection = { listDocuments: async () => [] };
  const db = {
    collection: (name) => name === "legalHolds"
      ? { listDocuments: async () => [virtualParent] }
      : emptyCollection,
  };

  await assert.rejects(
    () => assertEmptyBlockingCollections(db),
    (error) => error.code === "retention-hold-present" && error.counts.legalHolds === 1,
  );
});

test("the reset manifest includes legacy and v2 web data", () => {
  for (const collectionName of [
    "webOnboardingDrafts",
    "webOnboardingDraftsV2",
    "_webOnboardingRateLimitsV2",
    "_webOnboardingConsumptionsV2",
    "webClientProfiles",
    "_webClientConciergeNotes",
    "webClientHealth",
  ]) {
    assert.equal(FULL_RESET_COLLECTIONS.includes(collectionName), true);
  }
});

test("the web-onboarding scope is dry-run-first and Firestore-only", () => {
  const parsed = parseArgs([...devArgs, "--scope", "web-onboarding"]);
  assert.equal(parsed.execute, false);
  assert.equal(parsed.scope, "web-onboarding");

  assert.deepEqual(WEB_ONBOARDING_RESET_COLLECTIONS, [
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

  for (const preserved of [
    "accounts",
    "clientProfiles",
    "clientHealth",
    "chats",
    "trainerProfiles",
    "publicTrainers",
    "notificationEvents",
    "notifications",
  ]) {
    assert.equal(WEB_ONBOARDING_RESET_COLLECTIONS.includes(preserved), false);
  }
});
