import { describe, expect, it, vi } from "vitest";
import { generateModelResponse } from "./generation.js";
import type { GenerateRequest } from "./service.js";

const request = (kind: GenerateRequest["kind"]): GenerateRequest => ({
  kind, systemInstruction: "private instructions", contents: "private conversation and catalogue",
  responseJsonSchema: { type: "object", properties: { matches: { type: "array" } } },
});
const failure = (status: number) => Object.assign(new Error("private provider body"), { status });
const defaults = { chatModel: "gemini-3.5-flash-lite", matchingModel: "gemini-3.7-flash", random: () => 0 };

describe("matching model recovery", () => {
  it("uses the preferred matching model when it is available", async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: "real ranking" });
    await expect(generateModelResponse(request("ranking"), { ...defaults, generateContent })).resolves.toBe("real ranking");
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0]![0].model).toBe(defaults.matchingModel);
  });

  it.each(["brief", "ranking"] as const)("recovers %s on the alternate model without changing its prompt or schema", async kind => {
    const generateContent = vi.fn().mockRejectedValueOnce(failure(504)).mockRejectedValueOnce(failure(429))
      .mockResolvedValue({ text: "real validated downstream result" });
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();
    await expect(generateModelResponse(request(kind), { ...defaults, generateContent, sleep, onRetry }))
      .resolves.toBe("real validated downstream result");
    const calls = generateContent.mock.calls.map(([parameters]) => parameters);
    expect(calls.map(call => call.model)).toEqual([defaults.matchingModel, defaults.chatModel, defaults.chatModel]);
    for (const call of calls) {
      expect(call.contents).toBe(request(kind).contents);
      expect(call.config).toMatchObject({
        systemInstruction: request(kind).systemInstruction, responseJsonSchema: request(kind).responseJsonSchema,
        responseMimeType: "application/json", httpOptions: { timeout: 25_000, retryOptions: { attempts: 1 } },
      });
    }
    expect(sleep.mock.calls).toEqual([[2_000], [5_000]]);
    expect(onRetry.mock.calls).toEqual([
      [{ kind, retry: 1, providerStatus: 504, delayMs: 2_000, model: defaults.matchingModel, nextModel: defaults.chatModel }],
      [{ kind, retry: 2, providerStatus: 429, delayMs: 5_000, model: defaults.chatModel, nextModel: defaults.chatModel }],
    ]);
    expect(JSON.stringify(onRetry.mock.calls)).not.toContain("private");
  });

  it("keeps chat on the existing model and timeout when retrying", async () => {
    const generateContent = vi.fn().mockRejectedValueOnce(failure(503)).mockResolvedValue({ text: "real chat" });
    await generateModelResponse(request("chat"), { ...defaults, generateContent, sleep: vi.fn() });
    expect(generateContent).toHaveBeenCalledTimes(2);
    for (const [call] of generateContent.mock.calls) {
      expect(call.model).toBe(defaults.chatModel);
      expect(call.config.httpOptions.timeout).toBe(20_000);
    }
  });

  it("does not add attempts when both models remain unavailable", async () => {
    const error = failure(429);
    const generateContent = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn();
    await expect(generateModelResponse(request("ranking"), { ...defaults, generateContent, sleep })).rejects.toBe(error);
    expect(generateContent).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each(["AbortError", "TimeoutError"])("recovers an SDK %s on the alternate model within the existing retry budget", async name => {
    const error = Object.assign(new Error("private timed-out request"), { name });
    const generateContent = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ text: "real ranking" });
    const onRetry = vi.fn();
    await expect(generateModelResponse(request("ranking"), { ...defaults, generateContent, sleep: vi.fn(), onRetry })).resolves.toBe("real ranking");
    expect(generateContent.mock.calls.map(([call]) => call.model)).toEqual([defaults.matchingModel, defaults.chatModel]);
    expect(onRetry).toHaveBeenCalledWith({ retry: 1, timeout: true, delayMs: 2_000, kind: "ranking", model: defaults.matchingModel, nextModel: defaults.chatModel });
    expect(JSON.stringify(onRetry.mock.calls)).not.toContain("private");
  });

  it.each([400, 401, 403, 404])("does not switch models for HTTP %s", async status => {
    const error = failure(status);
    const generateContent = vi.fn().mockRejectedValue(error);
    await expect(generateModelResponse(request("brief"), { ...defaults, generateContent })).rejects.toBe(error);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not hide an empty model response with fallback content", async () => {
    const generateContent = vi.fn().mockResolvedValue({});
    await expect(generateModelResponse(request("brief"), { ...defaults, generateContent })).rejects.toThrow("The model returned no response.");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
