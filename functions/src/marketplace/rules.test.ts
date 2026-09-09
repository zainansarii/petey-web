import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const emulator = /^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "");
describe.skipIf(!emulator)("web marketplace Firestore read rules", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    env = await initializeTestEnvironment({ projectId: "demo-web-marketplace-rules", firestore: { host, port: Number(port), rules: readFileSync(new URL("../../../../mobile-app/firestore.rules", import.meta.url), "utf8") } });
  });
  beforeEach(async () => { await env.clearFirestore(); await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await Promise.all([
      ...["trainer", "trainee", "stranger"].map(uid => setDoc(doc(db, "webMarketplaceUsers", uid), { active: true })),
      setDoc(doc(db, "webTrainerMemberships", "trainer"), { trainerId: "catalogue", status: "active" }),
      setDoc(doc(db, "webEnquiries", "lead"), { traineeId: "trainee", trainerUid: "trainer", unlockedAt: null }),
      setDoc(doc(db, "webEnquiries", "lead", "messages", "message"), { text: "PRIVATE MESSAGE", seq: 1 }),
      setDoc(doc(db, "webEnquiryContent", "lead"), { fullName: "PRIVATE FULL NAME", introduction: "PRIVATE INTRO" }),
      setDoc(doc(db, "webMarketplaceUsers", "trainer", "inbox", "lead"), { traineeLabel: "Sam E.", latestAt: "2026-09-09" }),
      setDoc(doc(db, "webLeadTracking", "trainer", "leads", "lead"), { notes: "PRIVATE NOTES" }),
    ]);
  }); });
  afterAll(async () => { await env?.cleanup(); });
  const signed = (uid: string, verified = true) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: verified }).firestore();
  it("allows only verified active owners to list previews and never exposes private introductions directly", async () => {
    const trainer = signed("trainer");
    const previews = await assertSucceeds(getDocs(query(collection(trainer, "webMarketplaceUsers", "trainer", "inbox"), orderBy("latestAt", "desc"))));
    expect(JSON.stringify(previews.docs.map(item => item.data()))).not.toContain("PRIVATE");
    await assertFails(getDocs(collection(signed("stranger"), "webMarketplaceUsers", "trainer", "inbox")));
    await assertFails(getDocs(collection(signed("trainer", false), "webMarketplaceUsers", "trainer", "inbox")));
    await assertFails(getDoc(doc(trainer, "webEnquiryContent", "lead")));
    await assertFails(getDoc(doc(signed("trainee"), "webEnquiryContent", "lead")));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "webEnquiryContent", "lead")));
  });
  it("denies locked messages through get and query; unlock grants only participant access", async () => {
    const trainer = signed("trainer");
    await assertFails(getDoc(doc(trainer, "webEnquiries", "lead", "messages", "message")));
    await assertFails(getDocs(collection(trainer, "webEnquiries", "lead", "messages")));
    await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), "webEnquiries", "lead"), { unlockedAt: "2026-09-09" }));
    await assertSucceeds(getDocs(query(collection(trainer, "webEnquiries", "lead", "messages"), orderBy("seq", "desc"))));
    await assertSucceeds(getDoc(doc(signed("trainee"), "webEnquiries", "lead", "messages", "message")));
    await assertFails(getDoc(doc(signed("stranger"), "webEnquiries", "lead", "messages", "message")));
  });
  it("denies browser mutations, forged ownership, credential edits and trainee access to private notes", async () => {
    const trainer = signed("trainer");
    await assertSucceeds(getDoc(doc(trainer, "webLeadTracking", "trainer", "leads", "lead")));
    await assertFails(getDoc(doc(signed("trainee"), "webLeadTracking", "trainer", "leads", "lead")));
    await assertFails(updateDoc(doc(trainer, "webMarketplaceUsers", "trainer", "inbox", "lead"), { unlockedAt: "now" }));
    await assertFails(setDoc(doc(signed("stranger"), "webTrainerMemberships", "stranger"), { trainerId: "catalogue", status: "active" }));
    await assertFails(setDoc(doc(trainer, "webTrainerVerifiedCredentials", "catalogue"), { approved: true }));
    await assertFails(setDoc(doc(trainer, "webEnquiries", "lead", "messages", "forged"), { text: "forged" }));
  });
  it("revokes an active listener when trainer access changes", async () => {
    const trainer = signed("trainer");
    let stop = () => {};
    const revoked = new Promise<string>((resolve, reject) => {
      stop = onSnapshot(collection(trainer, "webMarketplaceUsers", "trainer", "inbox"), () => {
        void env.withSecurityRulesDisabled(async context => {
          await updateDoc(doc(context.firestore(), "webTrainerMemberships", "trainer"), { status: "revoked" });
          // Exercise the next snapshot too; the emulator does not proactively
          // re-evaluate every external rule dependency until the target changes.
          await updateDoc(doc(context.firestore(), "webMarketplaceUsers", "trainer", "inbox", "lead"), { latestAt: "2026-09-10" });
        }).catch(reject);
      }, error => resolve(error.code));
    });
    expect(await revoked).toBe("permission-denied"); stop();
    await assertFails(getDoc(doc(trainer, "webLeadTracking", "trainer", "leads", "lead")));
  });
});
