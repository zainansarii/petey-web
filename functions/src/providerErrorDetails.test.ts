import { describe, expect, it } from "vitest";
import { providerErrorDetails } from "./providerErrorDetails.js";

describe("provider error privacy", () => {
  it("does not expose echoed prompts in messages, names, codes or status", () => {
    const sensitive = "A private diagnosis and person@example.com";
    const error = Object.assign(new Error(sensitive), { name: sensitive, status: sensitive, code: sensitive, response: sensitive });
    expect(JSON.stringify(providerErrorDetails(error))).not.toContain(sensitive);
    expect(providerErrorDetails(error)).toEqual({ errorType: "model-provider-error", errorStatus: null, errorCode: null });
  });
  it("keeps useful recognised classifications without the provider payload", () => {
    expect(providerErrorDetails({ status: 429, code: "RESOURCE_EXHAUSTED", message: "private input" }))
      .toEqual({ errorType: "model-provider-error", errorStatus: 429, errorCode: "RESOURCE_EXHAUSTED" });
  });
});
