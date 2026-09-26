const transientStatuses = new Set([429, 500, 502, 503, 504]);
const retryDelaysMs = [2_000, 5_000] as const;

export interface ProviderRetryEvent {
  retry: number;
  providerStatus?: number;
  timeout?: true;
  delayMs: number;
}

export interface ProviderRetryOptions {
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  onRetry?: (event: ProviderRetryEvent) => void;
}

export async function withTransientProviderRetry<T>(operation: (attempt: number) => Promise<T>, options: ProviderRetryOptions = {}): Promise<T> {
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      // Request deadlines and SDK timeouts have no HTTP status.
      // These operations receive no caller abort signal, so this is a retryable request timeout.
      const timeout = error instanceof Error && ["AbortError", "TimeoutError", "APIConnectionTimeoutError"].includes(error.name);
      if ((!timeout && (typeof status !== "number" || !transientStatuses.has(status))) || attempt >= retryDelaysMs.length) throw error;
      const delayMs = retryDelaysMs[attempt]! + Math.floor(Math.max(0, Math.min(1, random())) * 500);
      // Only bounded metadata is exposed; provider error bodies can contain request text.
      options.onRetry?.({ retry: attempt + 1, ...(typeof status === "number" ? { providerStatus: status } : {}),
        ...(timeout ? { timeout: true } : {}), delayMs });
      await sleep(delayMs);
    }
  }
}
