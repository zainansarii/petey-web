import { beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { OPENING_MESSAGE } from "../../third-space-shared/contract.js";

const state = vi.hoisted(() => ({
  turn: vi.fn(), match: vi.fn(), stored: undefined as Record<string, unknown> | undefined,
  write: vi.fn(), collection: vi.fn(), doc: vi.fn(), log: vi.fn(), options: [] as Record<string, unknown>[],
}));
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: () => ({}) }));
vi.mock("firebase-admin/firestore", async importOriginal => {
  const actual = await importOriginal<typeof import("firebase-admin/firestore")>();
  return { ...actual, getFirestore: () => ({
    collection: (name: string) => {
      state.collection(name);
      return { doc: (id: string) => { state.doc(id); return { id }; } };
    },
    runTransaction: async (run: (transaction: unknown) => unknown) => run({
      get: async () => ({ data: () => state.stored }), set: state.write,
    }),
  }) };
});
vi.mock("firebase-functions", () => ({ logger: { info: state.log, warn: state.log } }));
vi.mock("firebase-functions/params", () => ({ defineString: () => ({ value: () => "unused-test-model" }), defineSecret: () => ({ name: "OPENAI_API_KEY", value: () => "unused-test-key" }) }));
vi.mock("firebase-functions/v2/https", async importOriginal => {
  const actual = await importOriginal<typeof import("firebase-functions/v2/https")>();
  return { ...actual, onCall: (options: Record<string, unknown>, handler: unknown) => {
    state.options.push(options);
    return handler;
  } };
});
vi.mock("./service.js", async importOriginal => {
  const actual = await importOriginal<typeof import("./service.js")>();
  return { ...actual, createThirdSpaceService: () => ({ turn: state.turn, match: state.match }) };
});

import { matchThirdSpaceTrainersV1, runThirdSpaceOnboardingTurnV1 } from "./index.js";
import { DemoModelError } from "./service.js";

type TestRequest = { app?: object; data: unknown; rawRequest: { headers: Record<string, string>; ip: string } };
const callTurn = runThirdSpaceOnboardingTurnV1 as unknown as (request: TestRequest) => Promise<unknown>;
const callMatch = matchThirdSpaceTrainersV1 as unknown as (request: TestRequest) => Promise<unknown>;
const request = (): TestRequest => ({
  app: { appId: "demo" },
  data: { messages: [{ role: "assistant", content: OPENING_MESSAGE }, { role: "user", content: "Private goal wording" }] },
  rawRequest: { headers: {}, ip: "203.0.113.5" },
});

beforeEach(() => {
  vi.clearAllMocks();
  state.stored = undefined;
  state.turn.mockResolvedValue({ reply: "Next question?" });
  state.match.mockResolvedValue({ matches: [] });
});

describe("Third Space callable security and failure handling", () => {
  it("requires App Check before processing or storing anything, without requiring user authentication", async () => {
    await expect(callTurn({ ...request(), app: undefined })).rejects.toMatchObject({ code: "failed-precondition" });
    expect(state.turn).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
    await expect(callTurn(request())).resolves.toEqual({ reply: "Next question?" });
    expect(state.options.every(options => Array.isArray(options.secrets) && options.secrets.some(secret => secret.name === "OPENAI_API_KEY"))).toBe(true);
    expect(state.options.every(options => options.enforceAppCheck === true && options.invoker === "private")).toBe(true);
  });

  it("rejects malformed transcripts before rate-counter writes or model calls", async () => {
    await expect(callTurn({ ...request(), data: { messages: [] } })).rejects.toMatchObject({ code: "invalid-argument" });
    expect(state.turn).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });

  it("blocks exhausted hourly counters without invoking the model", async () => {
    state.stored = { count: 120, windowStartedAt: Timestamp.now() };
    await expect(callTurn(request())).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(state.turn).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
    state.stored = { count: 24, windowStartedAt: Timestamp.now() };
    await expect(callMatch(request())).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(state.match).not.toHaveBeenCalled();
  });

  it("resets expired counters and writes only count/timestamps to a hashed identifier", async () => {
    state.stored = { count: 999, windowStartedAt: Timestamp.fromMillis(Date.now() - 3_600_001) };
    await callTurn(request());
    expect(state.collection).toHaveBeenCalledWith("_webOnboardingRateLimitsV3");
    expect(state.doc.mock.calls[0]?.[0]).toMatch(/^[a-f0-9]{64}$/);
    const written = state.write.mock.calls[0]?.[1];
    expect(Object.keys(written).sort()).toEqual(["count", "expiresAt", "windowStartedAt"]);
    expect(written.count).toBe(1);
    expect(JSON.stringify(state.write.mock.calls)).not.toContain("Private goal wording");
  });

  it("surfaces retryable failures without leaking provider input or fabricating matches", async () => {
    state.match.mockRejectedValue(new Error("provider reflected Private goal wording"));
    await expect(callMatch(request())).rejects.toMatchObject({ code: "unavailable" });
    expect(JSON.stringify(state.log.mock.calls)).not.toContain("Private goal wording");
    expect(JSON.stringify(state.write.mock.calls)).not.toContain("Private goal wording");
  });

  it("logs an allowlisted validation reason without logging generated content", async () => {
    state.match.mockRejectedValue(new DemoModelError("A match explanation has unsupported evidence."));
    await expect(callMatch(request())).rejects.toMatchObject({ code: "unavailable" });
    expect(state.log).toHaveBeenCalledWith("third_space_demo_request_failed", expect.objectContaining({
      failureKind: "model-validation", validationReason: "A match explanation has unsupported evidence.",
    }));
    state.match.mockRejectedValue(new DemoModelError("Private goal wording"));
    await expect(callMatch(request())).rejects.toMatchObject({ code: "unavailable" });
    expect(JSON.stringify(state.log.mock.calls)).not.toContain("Private goal wording");
  });

  it("records only a known provider class and numeric status, never provider messages or bodies", async () => {
    const provider = Object.assign(new Error("Private goal wording"), { name: "ApiError", status: 429, body: "Private goal wording" });
    state.match.mockRejectedValue(provider);
    await expect(callMatch(request())).rejects.toMatchObject({ code: "unavailable" });
    expect(state.log).toHaveBeenCalledWith("third_space_demo_request_failed", expect.objectContaining({
      failureKind: "provider", errorName: "ApiError", providerStatus: 429,
    }));
    state.match.mockRejectedValue(Object.assign(new Error("Private goal wording"), { name: "Private goal wording", status: "Private goal wording" }));
    await expect(callMatch(request())).rejects.toMatchObject({ code: "unavailable" });
    expect(JSON.stringify(state.log.mock.calls)).not.toContain("Private goal wording");
  });
});
