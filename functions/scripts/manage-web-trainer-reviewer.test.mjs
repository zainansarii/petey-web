import assert from "node:assert/strict";
import test from "node:test";
import { manageReviewer, parseArgs, validateReviewer } from "./manage-web-trainer-reviewer.mjs";

const args = ["grant", "--project=petey-dev-getcass", "--uid=reviewer-one", "--email=reviewer@example.com",
  "--actor=operator@example.com", "--reason=Initial reviewer setup", "--mfa-confirmed", "--individual-account-confirmed"];
const user = { uid: "reviewer-one", email: "reviewer@example.com", emailVerified: true,
  providerData: [{ providerId: "google.com" }], customClaims: { unrelatedClaim: "keep", admin: false } };

function harness(failAt) {
  const documents = {};
  const events = [];
  const connection = {
    now: () => "server-time",
    auth: {
      getUser: async () => globalThis.structuredClone(user),
      setCustomUserClaims: async (uid, claims) => {
        assert.equal(documents[`webTrainerReviewers/${uid}`].active, false);
        events.push(["claims", claims]);
        if (failAt === "claims") throw new Error("Simulated sensitive SDK response");
      },
      revokeRefreshTokens: async () => { events.push(["revokeTokens"]); if (failAt === "tokens") throw new Error("failure"); },
    },
    db: {
      collection: (name) => ({ doc: (id = "audit-id") => ({ id, path: `${name}/${id}`,
        get: async () => ({ data: () => documents[`${name}/${id}`] }),
        set: async (data) => { documents[`${name}/${id}`] = { ...documents[`${name}/${id}`], ...data }; },
      }) }),
      batch: () => {
        const writes = [];
        return {
          set: (ref, data) => writes.push([ref.path, data]),
          commit: async () => {
            events.push(["batch", writes]);
            for (const [path, data] of writes) documents[path] = { ...documents[path], ...data };
          },
        };
      },
      runTransaction: async (callback) => {
        const writes = [];
        await callback({ get: async (ref) => ({ data: () => documents[ref.path] }),
          set: (ref, data) => writes.push([ref.path, data]) });
        events.push(["transaction", writes]);
        for (const [path, data] of writes) documents[path] = { ...documents[path], ...data };
      },
    },
  };
  return { connection, events, documents };
}

test("reviewer CLI requires explicit identity, project and security attestations", () => {
  assert.equal(parseArgs(args).apply, false);
  for (const bad of [args.slice(0, -1), args.filter((arg) => !arg.startsWith("--project")),
    [...args, "--project=petey-prod-getcass"], [...args, "--unknown"],
    args.map((arg) => arg.startsWith("--project") ? "--project=someone-else" : arg)]) {
    assert.throws(() => parseArgs(bad));
  }
  assert.throws(() => validateReviewer({ ...user, emailVerified: false }, parseArgs(args)));
  assert.throws(() => validateReviewer({ ...user, email: "someone@example.com" }, parseArgs(args)));
  assert.throws(() => validateReviewer({ ...user, providerData: [] }, parseArgs(args)));
});

test("dry-run performs no writes or claim changes", async () => {
  const setup = harness();
  const result = await manageReviewer(setup.connection, parseArgs(args));
  assert.equal(result.mode, "dry-run");
  assert.deepEqual(setup.events, []);
  assert.deepEqual(setup.documents, {});
});

test("grant preserves unrelated claims and activates only after tokens are revoked", async () => {
  const setup = harness();
  await manageReviewer(setup.connection, parseArgs([...args, "--apply"]));
  assert.deepEqual(setup.events.map(([name]) => name), ["batch", "claims", "revokeTokens", "transaction"]);
  assert.deepEqual(setup.events[1][1], { unrelatedClaim: "keep", admin: false, webTrainerReviewer: true });
  assert.equal(setup.documents["webTrainerReviewers/reviewer-one"].active, true);
  assert.equal(setup.documents["webTrainerReviewers/reviewer-one"].mfaPolicyAttested, true);
  assert.equal(setup.documents["webTrainerReviewerAudit/audit-id"].status, "completed");
});

test("revoke disables registry first, preserves other claims and audits reason", async () => {
  const setup = harness();
  const revoke = parseArgs(["revoke", ...args.slice(1), "--apply"]);
  setup.connection.auth.getUser = async () => ({ ...user, disabled: true, customClaims: { ...user.customClaims, webTrainerReviewer: true } });
  await manageReviewer(setup.connection, revoke);
  assert.equal(setup.documents["webTrainerReviewers/reviewer-one"].active, false);
  assert.deepEqual(setup.events[1][1], user.customClaims);
  assert.equal(setup.documents["webTrainerReviewerAudit/audit-id"].reason, "Initial reviewer setup");
});

test("claim or token failure leaves reviewer inactive with a fixed failure audit", async () => {
  for (const failure of ["claims", "tokens"]) {
    const setup = harness(failure);
    await assert.rejects(() => manageReviewer(setup.connection, parseArgs([...args, "--apply"])), /allowlist remains disabled/);
    assert.equal(setup.documents["webTrainerReviewers/reviewer-one"].active, false);
    assert.equal(setup.documents["webTrainerReviewerAudit/audit-id"].status, "failed");
    assert.equal(setup.documents["webTrainerReviewerAudit/audit-id"].failureCode, "REVIEWER_UPDATE_FAILED");
  }
});

test("a concurrent revocation cannot be undone by completing an older grant", async () => {
  const setup = harness();
  setup.connection.auth.revokeRefreshTokens = async () => {
    setup.documents["webTrainerReviewers/reviewer-one"].operationId = "newer-revocation";
    setup.documents["webTrainerReviewers/reviewer-one"].active = false;
  };
  await assert.rejects(() => manageReviewer(setup.connection, parseArgs([...args, "--apply"])));
  assert.equal(setup.documents["webTrainerReviewers/reviewer-one"].active, false);
  assert.equal(setup.documents["webTrainerReviewerAudit/audit-id"].status, "failed");
});
