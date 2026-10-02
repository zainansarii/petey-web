import { afterEach, describe, expect, it, vi } from "vitest";
import { withTransientProviderRetry } from "./provider-retry.js";
import { DemoModelError, parseTurn } from "./service.js";

afterEach(() => vi.useRealTimers());

const providerError = (status: number) => Object.assign(new Error("private prompt and provider body"), { status });

describe("bounded transient provider retries", () => {
  it("retries the same operation after bounded jittered delays and returns its real result", async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValueOnce(providerError(429)).mockRejectedValueOnce(providerError(503)).mockResolvedValue("real model result");
    const telemetry = vi.fn();
    const pending = withTransientProviderRetry(operation, { random: () => 0.5, onRetry: telemetry });
    await vi.advanceTimersByTimeAsync(0);
    expect(operation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_249);
    expect(operation).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5_249);
    expect(operation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe("real model result");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(telemetry.mock.calls).toEqual([
      [{ retry: 1, providerStatus: 429, delayMs: 2_250 }],
      [{ retry: 2, providerStatus: 503, delayMs: 5_250 }],
    ]);
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain("private prompt");
  });

  it("stops after two retries and preserves the final provider error", async () => {
    vi.useFakeTimers();
    const failure = providerError(429);
    const operation = vi.fn().mockRejectedValue(failure);
    const pending = withTransientProviderRetry(operation, { random: () => 1 });
    const outcome = expect(pending).rejects.toBe(failure);
    await vi.runAllTimersAsync();
    await outcome;
    expect(operation).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([400, 401, 403, 404, 408])("does not retry a non-transient HTTP %s error", async status => {
    const operation = vi.fn().mockRejectedValue(providerError(status));
    const sleep = vi.fn();
    await expect(withTransientProviderRetry(operation, { sleep })).rejects.toMatchObject({ status });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([500, 502, 504])("retries the explicitly supported server error %s", async status => {
    const operation = vi.fn().mockRejectedValueOnce(providerError(status)).mockResolvedValue("real output");
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(withTransientProviderRetry(operation, { sleep, random: () => 0 })).resolves.toBe("real output");
    expect(sleep).toHaveBeenCalledExactlyOnceWith(2_000);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("never retries invalid output or fabricates a successful response", async () => {
    const operation = vi.fn().mockResolvedValue("invalid structured output");
    const sleep = vi.fn();
    const text = await withTransientProviderRetry(operation, { sleep });
    expect(() => parseTurn(text)).toThrow(DemoModelError);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    const invalid = vi.fn().mockRejectedValue(new DemoModelError("The model returned an invalid response."));
    await expect(withTransientProviderRetry(invalid, { sleep })).rejects.toThrow(DemoModelError);
    expect(invalid).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
