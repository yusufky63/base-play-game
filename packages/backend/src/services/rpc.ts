import { fallback, http } from "viem";

type RpcTransportOptions = {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
};

export function createPublicFirstTransport(
  urls: readonly string[],
  { timeout = 10_000, retryCount = 1, retryDelay = 250 }: RpcTransportOptions = {}
) {
  return fallback(
    urls.filter(Boolean).map((url) => http(url, { timeout, retryCount, retryDelay })),
    {
      rank: false,
      retryCount: 2,
      retryDelay: 500
    }
  );
}
