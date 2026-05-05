import { NETWORKS, type NetworkKey } from "@baseplay/shared/config/networks";
import { createPublicClient, fallback, http } from "viem";

export function createResilientClient(networkKey: NetworkKey) {
  const network = NETWORKS[networkKey];
  const transports = network.rpcUrls
    .filter(Boolean)
    .map((url) => http(url, { timeout: 8_000, retryCount: 2, retryDelay: 200 }));

  return createPublicClient({
    transport: fallback(transports, {
      rank: {
        interval: 60_000,
        sampleCount: 5,
        timeout: 3_000,
        weights: { latency: 0.3, stability: 0.7 }
      },
      retryCount: 3
    })
  });
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  { retries = 4, baseDelay = 500, maxDelay = 10_000 } = {}
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const retryable = message.includes("429") || message.includes("rate limit") || message.includes("fetch failed");
      if (!retryable || attempt === retries - 1) throw error;
      const delay = Math.min(baseDelay * 2 ** attempt, maxDelay) + Math.random() * 200;
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retries exceeded");
}
