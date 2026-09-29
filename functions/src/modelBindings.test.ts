import { describe, expect, it } from "vitest";
import * as functions from "./index.js";

describe("OpenAI runtime secret bindings", () => {
  it.each([
    "runWebOnboardingTurnV3", "runWebOnboardingTurnV4", "finalizeWebOnboardingDraftV3", "finalizeWebOnboardingV4",
    "matchWebOnboardingDraftV1", "confirmWebOnboardingDraftV3", "consumeWebOnboardingDraftV3", "getWebClientProfileV3",
    "webMarketplaceV1",
  ] as const)("binds OPENAI_API_KEY to %s without reading it during module loading", name => {
    expect(functions[name].__endpoint.secretEnvironmentVariables).toContainEqual({ key: "OPENAI_API_KEY" });
  });

  it("does not give the key to draft-only operations", () => {
    expect(functions.createWebOnboardingDraftV3.__endpoint.secretEnvironmentVariables ?? []).toEqual([]);
    expect(functions.deleteWebOnboardingDraftV3.__endpoint.secretEnvironmentVariables ?? []).toEqual([]);
  });
});
