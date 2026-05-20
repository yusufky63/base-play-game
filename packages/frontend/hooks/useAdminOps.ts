"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { getSignedAdminQuery } from "@/lib/adminAuth";
import { fetchBackendJson } from "@/lib/backend";
import { useIsOwner } from "@/hooks/useIsOwner";

export type AdminOpsState = {
  status: "ok";
  chainId: 8453;
  updatedAt: string;
  vrf: {
    coordinator: `0x${string}`;
    subscriptionId: string;
    linkBalanceJuels?: string;
    linkBalance: string;
    nativeBalanceWei?: string;
    nativeBalanceEth: string;
    requestCount: string;
    owner: string;
    consumers: string[];
    pendingRequestExists: boolean;
    luckyDrawConsumerReady: boolean;
  };
  luckyDraw: {
    address: `0x${string}` | null;
    deployed: boolean;
    availableLiquidityWei?: string;
    availableLiquidityEth?: string;
    totalPendingReserveWei?: string;
    totalPendingReserveEth?: string;
    totalClaimablePrizesWei?: string;
    totalClaimablePrizesEth?: string;
    maxPrizeAmountWei?: string;
    maxPrizeAmountEth?: string;
    roundsRequired?: string;
    minEligibleBetWei?: string;
    minEligibleBetEth?: string;
    paused?: boolean;
    owner?: string | null;
  };
};

export function useAdminOps() {
  const { address } = useAccount();
  const isOwner = useIsOwner();
  const { signMessageAsync } = useSignMessage();

  return useQuery({
    queryKey: ["admin-ops", address?.toLowerCase() ?? "none"],
    queryFn: async () => {
      if (!address) throw new Error("Connect admin wallet first");
      const query = await getSignedAdminQuery({ action: "admin-read", address, signMessageAsync });
      const data = await fetchBackendJson<AdminOpsState>(`/api/admin/ops?${query}`);
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    enabled: Boolean(address && isOwner),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false
  });
}
