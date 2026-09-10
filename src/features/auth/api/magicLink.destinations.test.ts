/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import process from "node:process";
import { connectAuthEmulator, signOut } from "firebase/auth";
const emulator = /^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "");
describe.skipIf(!emulator)("email-link destinations against the Auth emulator", () => {
  beforeEach(async () => {
    vi.resetModules(); localStorage.clear();
    for (const [key, value] of Object.entries({ API_KEY: "fake-api-key", AUTH_DOMAIN: "demo-petey-auth.firebaseapp.com", PROJECT_ID: "demo-petey-auth", STORAGE_BUCKET: "demo-petey-auth.appspot.com", MESSAGING_SENDER_ID: "1234", APP_ID: "demo-app" })) vi.stubEnv(`VITE_FIREBASE_${key}`, value);
    history.replaceState(null, "", "/petey-web/trainer/?invite=token#enquiries/lead");
    const { getFirebaseAuth } = await import("./magicLink"); const auth = await getFirebaseAuth();
    if (!auth.emulatorConfig) connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    await signOut(auth);
  });
  afterEach(() => vi.unstubAllEnvs());
  async function codes() { return (await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/demo-petey-auth/oobCodes`)).json()).oobCodes as { email: string; oobCode: string; oobLink: string }[]; }
  it("preserves a trainer invitation and conversation target and rejects external return destinations", async () => {
    const { requestMagicLink } = await import("./magicLink");
    await expect(requestMagicLink("TRAINER@example.com", "/petey-web/trainer/?invite=token#enquiries/lead")).resolves.toBe("sent");
    const link = (await codes()).reverse().find(code => code.email === "trainer@example.com")!;
    expect(new URL(link.oobLink).searchParams.get("continueUrl")).toContain("invite=token&finishSignUp=1#enquiries/lead");
    await expect(requestMagicLink("trainer@example.com", "https://evil.example/path")).rejects.toThrow("Invalid sign-in destination");
  });
  it("finishes on another device after confirming the invited email", async () => {
    const { requestMagicLink, finishMagicLink, getFirebaseAuth } = await import("./magicLink");
    await requestMagicLink("cross-device@example.com", "/petey-web/trainer/?invite=token#enquiries/lead");
    const link = (await codes()).reverse().find(code => code.email === "cross-device@example.com")!;
    localStorage.clear();
    history.replaceState(null, "", `/petey-web/trainer/?invite=token&mode=signIn&oobCode=${encodeURIComponent(link.oobCode)}&apiKey=fake-api-key&finishSignUp=1#enquiries/lead`);
    expect(await finishMagicLink()).toBe("missing-email");
    expect(await finishMagicLink("cross-device@example.com")).toBe("signed-in");
    expect(location.search).toBe("?invite=token"); expect(location.hash).toBe("#enquiries/lead");
    expect((await getFirebaseAuth()).currentUser?.emailVerified).toBe(true);
  });
  it("returns a trainee to the requested conversation after cross-device sign-in", async () => {
    const { requestMagicLink, finishMagicLink } = await import("./magicLink");
    const id = "a".repeat(64);
    await requestMagicLink("trainee-inbox@example.com", `/petey-web/messages/#${id}`);
    const link = (await codes()).reverse().find(code => code.email === "trainee-inbox@example.com")!;
    expect(new URL(link.oobLink).searchParams.get("continueUrl")).toContain(`/messages/?finishSignUp=1#${id}`);
    localStorage.clear();
    history.replaceState(null, "", `/petey-web/messages/?mode=signIn&oobCode=${encodeURIComponent(link.oobCode)}&apiKey=fake-api-key&finishSignUp=1#${id}`);
    expect(await finishMagicLink()).toBe("missing-email");
    expect(await finishMagicLink("trainee-inbox@example.com")).toBe("signed-in");
    expect(location.pathname).toBe("/petey-web/messages/");
    expect(location.search).toBe("");
    expect(location.hash).toBe(`#${id}`);
  });
});
