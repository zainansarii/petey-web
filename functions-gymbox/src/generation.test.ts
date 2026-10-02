import { describe, expect, it, vi } from "vitest";
import { MODEL_ROUTES, responseParameters } from "../../functions/src/openai.js";
import { generateModelResponse } from "./generation.js";
import type { GenerateRequest } from "./service.js";

const request = (kind: GenerateRequest["kind"]): GenerateRequest => ({
  kind, systemInstruction: "private instructions", contents: "private conversation and catalogue",
  responseJsonSchema: { type: "object", properties: { matches: { type: "array" } } },
});
const failure = (status: number) => Object.assign(new Error("private provider body"), { status });
const defaults = { random: () => 0 };

describe("matching model recovery", () => {
  it("uses the preferred matching model when it is available", async () => {
    const generateText = vi.fn().mockResolvedValue("real ranking");
    await expect(generateModelResponse(request("ranking"), { ...defaults, generateText })).resolves.toBe("real ranking");
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(responseParameters(generateText.mock.calls[0]![0]).model).toBe(MODEL_ROUTES.matching.model);
  });

  it.each(["brief", "ranking"] as const)("retries %s on Sol medium without changing its prompt or schema", async kind => {
    const generateText = vi.fn().mockRejectedValueOnce(failure(504)).mockRejectedValueOnce(failure(429))
      .mockResolvedValue("real validated downstream result");
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();
    await expect(generateModelResponse(request(kind), { ...defaults, generateText, sleep, onRetry }))
      .resolves.toBe("real validated downstream result");
    const calls = generateText.mock.calls.map(([parameters]) => parameters);
    expect(calls.map(call => responseParameters(call).model)).toEqual([MODEL_ROUTES.matching.model, MODEL_ROUTES.matching.model, MODEL_ROUTES.matching.model]);
    for (const call of calls) {
      expect(call.input).toBe(request(kind).contents);
      expect(call).toMatchObject({
        systemInstruction: request(kind).systemInstruction,
        schema: { json: request(kind).responseJsonSchema }, timeoutMs: 25_000,
      });
      expect(responseParameters(call).reasoning).toEqual({ effort: "medium" });
    }
    expect(sleep.mock.calls).toEqual([[2_000], [5_000]]);
    expect(onRetry.mock.calls).toEqual([
      [{ kind, retry: 1, providerStatus: 504, delayMs: 2_000, model: MODEL_ROUTES.matching.model, nextModel: MODEL_ROUTES.matching.model }],
      [{ kind, retry: 2, providerStatus: 429, delayMs: 5_000, model: MODEL_ROUTES.matching.model, nextModel: MODEL_ROUTES.matching.model }],
    ]);
    expect(JSON.stringify(onRetry.mock.calls)).not.toContain("private");
  });

  it("keeps chat on the existing model and timeout when retrying", async () => {
    const generateText = vi.fn().mockRejectedValueOnce(failure(503)).mockResolvedValue("real chat");
    await generateModelResponse(request("chat"), { ...defaults, generateText, sleep: vi.fn() });
    expect(generateText).toHaveBeenCalledTimes(2);
    for (const [call] of generateText.mock.calls) {
      expect(responseParameters(call)).toMatchObject({ model: MODEL_ROUTES.chat.model, reasoning: { effort: "low" } });
      expect(call.timeoutMs).toBe(20_000);
    }
  });

  it("does not add attempts when the model remains unavailable", async () => {
    const error = failure(429);
    const generateText = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn();
    await expect(generateModelResponse(request("ranking"), { ...defaults, generateText, sleep })).rejects.toBe(error);
    expect(generateText).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each(["AbortError", "TimeoutError", "APIConnectionTimeoutError"])("recovers an SDK %s on Sol medium within the existing retry budget", async name => {
    const error = Object.assign(new Error("private timed-out request"), { name });
    const generateText = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("real ranking");
    const onRetry = vi.fn();
    await expect(generateModelResponse(request("ranking"), { ...defaults, generateText, sleep: vi.fn(), onRetry })).resolves.toBe("real ranking");
    expect(generateText.mock.calls.map(([call]) => responseParameters(call).model)).toEqual([MODEL_ROUTES.matching.model, MODEL_ROUTES.matching.model]);
    expect(onRetry).toHaveBeenCalledWith({ retry: 1, timeout: true, delayMs: 2_000, kind: "ranking", model: MODEL_ROUTES.matching.model, nextModel: MODEL_ROUTES.matching.model });
    expect(JSON.stringify(onRetry.mock.calls)).not.toContain("private");
  });

  it.each([400, 401, 403, 404])("does not switch models for HTTP %s", async status => {
    const error = failure(status);
    const generateText = vi.fn().mockRejectedValue(error);
    await expect(generateModelResponse(request("brief"), { ...defaults, generateText })).rejects.toBe(error);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("does not hide an empty model response with fallback content", async () => {
    const generateText = vi.fn().mockResolvedValue("");
    await expect(generateModelResponse(request("brief"), { ...defaults, generateText })).rejects.toThrow("The model returned no response.");
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
