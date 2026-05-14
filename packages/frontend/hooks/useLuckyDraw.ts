"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { fetchBackendJson } from "@/lib/backend";
import { useToast } from "@/components/ui/ToastProvider";

export type LuckyDrawPrize = {
  usd: number;
  weight: number;
  eth: number;
  oddsPct: number;
};

export type LuckyDrawResult = {
  id: string;
  player: string;
  prize_usd: number;
  prize_eth: number;
  eth_usd_reference: number;
  status: "claimable" | "paid" | "voided";
  entropy_hash: string;
  client_seed: string | null;
  payout_tx_hash: string | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
};

export type LuckyDrawSummary = {
  player: string;
  config: {
    enabled: boolean;
    roundsRequired: number;
    minBetEth: number;
    ethUsdReference: number;
    pausedReason: string | null;
    updatedAt: string;
    prizes: LuckyDrawPrize[];
  };
  progress: {
    qualifiedRounds: number;
    availableDraws: number;
    lifetimeDrawsEarned: number;
    lifetimeDrawsClaimed: number;
    totalPrizeEth: number;
    roundsUntilNext: number;
    progressPct: number;
  };
  recentResults: LuckyDrawResult[];
};

export type LuckyDrawAdminState = {
  config: LuckyDrawSummary["config"];
  recentResults: LuckyDrawResult[];
};

export function useLuckyDraw(address?: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["lucky-draw", address?.toLowerCase() ?? "none"],
    queryFn: async () => {
      const data = await fetchBackendJson<LuckyDrawSummary>(`/api/player/${address}/lucky-draw`);
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    enabled: Boolean(address) && enabled,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false
  });
}

export function useClaimLuckyDraw(address?: string | null) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect wallet first");
      const clientSeed = `${address}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      const message = buildAdminMessage("lucky-draw-claim", address);
      const signature = await signMessageAsync({ message });
      const data = await fetchBackendJson<{ status: "claimed"; result: LuckyDrawResult; summary: LuckyDrawSummary }>(
        `/api/player/${address}/lucky-draw/claim`,
        {
          method: "POST",
          body: JSON.stringify({ player: address, message, signature, clientSeed })
        }
      );
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["lucky-draw", address?.toLowerCase() ?? "none"], data.summary);
      toast({
        tone: "success",
        title: `Lucky Draw: ${formatEth(data.result.prize_eth)} ETH`,
        description: `$${Number(data.result.prize_usd).toFixed(2)} reward is claimable.`
      });
    },
    onError: (error) => {
      toast({ tone: "error", title: "Lucky Draw failed", description: error instanceof Error ? cleanBackendError(error.message) : undefined });
    }
  });

  return { ...mutation, isPending: mutation.isPending || isSigning };
}

export function useLuckyDrawAdmin() {
  return useQuery({
    queryKey: ["admin-lucky-draw"],
    queryFn: async () => {
      const data = await fetchBackendJson<LuckyDrawAdminState>("/api/admin/lucky-draw");
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });
}

export function useUpdateLuckyDrawConfig() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: async (config: {
      enabled: boolean;
      roundsRequired: number;
      minBetEth: number;
      ethUsdReference: number;
      pausedReason: string | null;
      prizes: Array<{ usd: number; weight: number }>;
    }) => {
      if (!address) throw new Error("Connect admin wallet first");
      const message = buildAdminMessage("lucky-draw-config", address);
      const signature = await signMessageAsync({ message });
      const data = await fetchBackendJson<LuckyDrawAdminState>("/api/admin/lucky-draw/config", {
        method: "POST",
        body: JSON.stringify({ admin: address, message, signature, config })
      });
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-lucky-draw"], data);
      toast({ tone: "success", title: "Lucky Draw config saved" });
    },
    onError: (error) => {
      toast({ tone: "error", title: "Config update failed", description: error instanceof Error ? cleanBackendError(error.message) : undefined });
    }
  });

  return { ...mutation, isPending: mutation.isPending || isSigning };
}

export function useUpdateLuckyDrawResult() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: async (result: { id: string; status: "claimable" | "paid" | "voided"; payoutTxHash?: string | null }) => {
      if (!address) throw new Error("Connect admin wallet first");
      const message = buildAdminMessage("lucky-draw-result", address);
      const signature = await signMessageAsync({ message });
      const data = await fetchBackendJson<LuckyDrawAdminState>("/api/admin/lucky-draw/result", {
        method: "POST",
        body: JSON.stringify({ admin: address, message, signature, result })
      });
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-lucky-draw"], data);
      toast({ tone: "success", title: "Lucky Draw result updated" });
    },
    onError: (error) => {
      toast({ tone: "error", title: "Result update failed", description: error instanceof Error ? cleanBackendError(error.message) : undefined });
    }
  });

  return { ...mutation, isPending: mutation.isPending || isSigning };
}

function buildAdminMessage(action: string, address: string) {
  return [
    "BasePlay admin action",
    `Action: ${action}`,
    `Address: ${address}`,
    `Timestamp: ${new Date().toISOString()}`
  ].join("\n");
}

function cleanBackendError(message: string) {
  try {
    const parsed = JSON.parse(message) as { error?: string };
    return parsed.error ?? message;
  } catch {
    return message;
  }
}

function formatEth(value: number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 8 });
}
