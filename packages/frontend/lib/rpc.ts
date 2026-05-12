import { NETWORKS, type NetworkKey } from "@baseplay/shared/config/networks";
import { createPublicClient, fallback, http, type Chain, type FallbackTransport, type HttpTransport } from "viem";

type RpcTransportOptions = {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
};

export function createPublicFirstTransport(
  urls: readonly string[],
  { timeout = 10_000, retryCount = 1, retryDelay = 250 }: RpcTransportOptions = {}
): FallbackTransport<HttpTransport[]> {
  return fallback(
    urls.filter(Boolean).map((url) => http(url, { timeout, retryCount, retryDelay })),
    {
      rank: false,
      retryCount: 2,
      retryDelay: 500
    }
  );
}

export function createBaseRpcClient(chain: Chain, urls: readonly string[], options?: RpcTransportOptions) {
  return createPublicClient({
    chain,
    batch: { multicall: true },
    transport: createPublicFirstTransport(urls, options)
  });
}

export function createResilientClient(networkKey: NetworkKey) {
  const network = NETWORKS[networkKey];

  return createPublicClient({
    transport: createPublicFirstTransport(network.frontendRpcUrls, { timeout: 8_000, retryCount: 2, retryDelay: 200 })
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
