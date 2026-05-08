"use client";

import { formatEther } from "viem";
import { useAccount, useBalance as useWagmiBalance } from "wagmi";

export function useBalance() {
  const { address } = useAccount();
  const { data, isLoading, refetch } = useWagmiBalance({
    address,
    query: {
      enabled: Boolean(address),
      staleTime: 2 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false
    }
  });

  return {
    raw: data?.value ?? 0n,
    formatted: data ? Number(formatEther(data.value)).toFixed(4) : "0.0000",
    symbol: data?.symbol ?? "ETH",
    isLoading,
    refetch
  };
}
