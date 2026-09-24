const transientStatuses = new Set([429, 502, 503, 504]);
const retryDelaysMs = [2_000, 5_000] as const;

export interface ProviderRetryEvent {
  retry: number;
  providerStatus: number;
  delayMs: number;
}

export async function withTransientProviderRetry<T>(operation: () => Promise<T>, options: {
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  onRetry?: (event: ProviderRetryEvent) => void;
} = {}): Promise<T> {
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      if (typeof status !== "number" || !transientStatuses.has(status) || attempt >= retryDelaysMs.length) throw error;
      const delayMs = retryDelaysMs[attempt]! + Math.floor(Math.max(0, Math.min(1, random())) * 500);
      // Only fixed numeric metadata is exposed; provider error bodies can contain request text.
      options.onRetry?.({ retry: attempt + 1, providerStatus: status, delayMs });
      await sleep(delayMs);
    }
  }
}
