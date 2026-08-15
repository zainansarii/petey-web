describe("Firebase magic-link lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_FIREBASE_API_KEY", "");
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "");
    vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "");
    vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "");
    window.history.replaceState({}, "", "/?finishSignUp=1&mode=signIn&oobCode=code");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns one cached completion promise for the same URL", async () => {
    const { finishMagicLink } = await import("./magicLink");

    const firstCompletion = finishMagicLink();
    const secondCompletion = finishMagicLink();

    expect(secondCompletion).toBe(firstCompletion);
    await expect(firstCompletion).resolves.toBe("ignored");
  });
});
