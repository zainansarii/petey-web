#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import process from "node:process";

const PROJECTS = new Set(["petey-dev-getcass", "petey-prod-getcass"]);

export function parseArgs(args) {
  const [action, ...rest] = args;
  if (!["grant", "revoke"].includes(action)) throw new Error("Choose grant or revoke.");
  const options = { action, apply: false, mfaConfirmed: false, individualAccountConfirmed: false };
  const named = { project: "project", uid: "uid", email: "email", actor: "actor", reason: "reason" };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--apply") { options.apply = true; continue; }
    if (arg === "--mfa-confirmed") { options.mfaConfirmed = true; continue; }
    if (arg === "--individual-account-confirmed") { options.individualAccountConfirmed = true; continue; }
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match || !named[match[1]]) throw new Error("Unknown argument.");
    const value = match[2] ?? rest[++index];
    if (!value || value.startsWith("--") || options[named[match[1]]] !== undefined) throw new Error("Missing or repeated argument.");
    options[named[match[1]]] = value;
  }
  if (!PROJECTS.has(options.project)) throw new Error("An explicit Petey dev or prod --project is required.");
  if (!options.uid || options.uid.length > 128 || options.uid.includes("/")) throw new Error("A known Firebase --uid is required.");
  if (!options.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email)) throw new Error("A known --email is required.");
  if (!options.actor?.trim() || !options.reason?.trim() || options.reason.length > 1000) throw new Error("Supply --actor and a short --reason for the audit.");
  if (action === "grant" && (!options.mfaConfirmed || !options.individualAccountConfirmed)) {
    throw new Error("Grant requires --mfa-confirmed and --individual-account-confirmed after checking the Google account policy.");
  }
  return options;
}

export function validateReviewer(user, options) {
  if (user.uid !== options.uid || user.email?.toLowerCase() !== options.email.toLowerCase()) {
    throw new Error("Firebase UID and email do not match the requested reviewer.");
  }
  if (options.action === "grant" && (user.disabled || !user.emailVerified
    || !user.providerData?.some((provider) => provider.providerId === "google.com"))) {
    throw new Error("Reviewer must be an enabled, verified Google account.");
  }
}

/** Dependency injection keeps dry-run and failure-order tests credential free. */
export async function manageReviewer({ auth, db, now }, options) {
  const user = await auth.getUser(options.uid);
  validateReviewer(user, options);
  const ref = db.collection("webTrainerReviewers").doc(options.uid);
  const current = await ref.get();
  const claims = { ...(user.customClaims ?? {}) };
  if (options.action === "grant") claims.webTrainerReviewer = true;
  else delete claims.webTrainerReviewer;
  const summary = { project: options.project, uid: user.uid, action: options.action,
    mode: options.apply ? "apply" : "dry-run", wasActive: current.data()?.active === true };
  if (!options.apply) return summary;

  const operation = db.collection("webTrainerReviewerAudit").doc();
  const base = { actor: options.actor, reason: options.reason, reviewerUid: options.uid,
    action: options.action, project: options.project };
  // Fail closed during both grant and revoke: the server-owned allowlist is
  // disabled first, before modifying any authentication claim.
  const batch = db.batch();
  batch.set(ref, { uid: user.uid, email: user.email, active: false,
    updatedAt: now(), updatedBy: options.actor, operationId: operation.id }, { merge: true });
  batch.set(operation, { ...base, status: "started", startedAt: now() });
  await batch.commit();
  try {
    await auth.setCustomUserClaims(user.uid, claims);
    // Invalidates refresh tokens even on a grant, requiring a fresh Google login
    // for the new reviewer session. Backend still checks active registry per call.
    await auth.revokeRefreshTokens(user.uid);
    await db.runTransaction(async (finish) => {
      const latest = await finish.get(ref);
      if (latest.data()?.operationId !== operation.id) throw new Error("Reviewer operation superseded.");
      if (options.action === "grant") {
        finish.set(ref, { active: true, mfaPolicyAttested: true, individualAccountAttested: true,
          grantedAt: now(), grantedBy: options.actor, updatedAt: now(), updatedBy: options.actor }, { merge: true });
      } else {
        finish.set(ref, { active: false, revokedAt: now(), revokedBy: options.actor,
          updatedAt: now(), updatedBy: options.actor }, { merge: true });
      }
      finish.set(operation, { status: "completed", completedAt: now() }, { merge: true });
    });
  } catch (error) {
    // An interruption leaves access disabled. Log a fixed code rather than an
    // SDK response that could contain credentials or unrelated account details.
    await operation.set({ status: "failed", failureCode: "REVIEWER_UPDATE_FAILED", failedAt: now() }, { merge: true }).catch(() => {});
    throw new Error("Reviewer update failed; allowlist remains disabled. Re-run after resolving credentials or API access.", { cause: error });
  }
  return { ...summary, active: options.action === "grant", auditId: operation.id };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"].some((key) => process.env[key])) {
    throw new Error("Unset emulator hosts before managing a live reviewer.");
  }
  const [{ initializeApp, applicationDefault, deleteApp }, { getAuth }, { getFirestore, FieldValue }] = await Promise.all([
    import("firebase-admin/app"), import("firebase-admin/auth"), import("firebase-admin/firestore"),
  ]);
  const app = initializeApp({ projectId: options.project, credential: applicationDefault() }, "petey-reviewer-management");
  try {
    const result = await manageReviewer({ auth: getAuth(app), db: getFirestore(app), now: () => FieldValue.serverTimestamp() }, options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally { await deleteApp(app); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
