"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEther, parseEventLogs, type Abi } from "viem";
import { base } from "wagmi/chains";
import { useAccount, usePublicClient, useSignMessage, useSwitchChain, useWriteContract } from "wagmi";
import luckyDrawAbi from "@baseplay/shared/abis/LuckyDraw.json";
import { getContractAddress } from "@baseplay/shared/config/addresses";
import { fetchBackendJson } from "@/lib/backend";
import { BASEPLAY_BUILDER_CODE_SUFFIX } from "@/lib/builderCode";
import { parseContractError } from "@/lib/errors";
import { useToast } from "@/components/ui/ToastProvider";
import { openWalletModal } from "@/lib/walletConnectors";
import { buildAdminMessage, getSignedAdminQuery } from "@/lib/adminAuth";
import { useIsOwner } from "@/hooks/useIsOwner";

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
  onchain: {
    chainId: 8453;
    contractAddress: string | null;
    configured: boolean;
  };
  config: {
    enabled: boolean;
    roundsRequired: number;
    minBetEth: number;
    dailyDrawCap: number;
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
  daily: {
    drawDay: string;
    cap: number;
    earnedDraws: number;
    remainingDraws: number;
    qualifiedRounds: number;
    resetAt: string;
    capped: boolean;
  };
  eligibleProofs: LuckyDrawProof[];
  recentResults: LuckyDrawResult[];
};

export type LuckyDrawProof = {
  roundId: string;
  gameId: string;
  contractAddress: string;
  requestId: string;
};

export type OnchainLuckyDrawResult = {
  requestId: string;
  prizeIndex: number;
  prizeAmountWei: string;
  prizeAmountEth: number;
  txHash: string | null;
  requestTxHash?: string | null;
};

export type PendingLuckyDrawRequest = {
  requestId: string;
  requestTxHash: string;
  requestedAt: string;
};

export type LuckyDrawAdminState = {
  config: LuckyDrawSummary["config"];
  recentResults: LuckyDrawResult[];
};

export type LuckyDrawHistory = {
  updatedAt: string;
  chainId: 8453;
  contractAddress: string | null;
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
  rows: Array<{
    player: string;
    requestId: string;
    prizeIndex: number;
    prizeAmountWei: string;
    prizeAmountEth: number;
    txHash: string;
    status: "claimable" | "claimed";
    blockNumber: string;
  }>;
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
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true
  });
}

export function useLuckyDrawHistory({
  limit = 10,
  offset = 0,
  player = null,
  enabled = true,
  refetchInterval = false
}: {
  limit?: number;
  offset?: number;
  player?: string | null;
  enabled?: boolean;
  refetchInterval?: number | false;
} = {}) {
  return useQuery({
    queryKey: ["lucky-draw-history", { limit, offset, player: player?.toLowerCase() ?? null }],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset)
      });
      if (player) params.set("player", player);
      const data = await fetchBackendJson<LuckyDrawHistory>(`/api/lucky-draw/history?${params.toString()}`);
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    enabled,
    staleTime: player ? 15_000 : 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: Boolean(player),
    refetchInterval
  });
}

export function useClaimLuckyDraw(address?: string | null) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const account = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [pendingRequest, setPendingRequest] = useState<PendingLuckyDrawRequest | null>(null);

  const mutation = useMutation({
    mutationFn: async (proofs: LuckyDrawProof[]) => {
      setPendingRequest(null);
      if (!address || !account.address) {
        openWalletModal();
        throw new Error("Connect wallet first");
      }
      if (account.address.toLowerCase() !== address.toLowerCase()) throw new Error("Connect the wallet that earned this draw");
      if (!publicClient) throw new Error("Network RPC is not ready");
      if (proofs.length === 0) throw new Error("No eligible settled rounds are available yet");

      const contractAddress = getLuckyDrawContractAddress();
      if (!contractAddress) throw new Error("Lucky Draw contract is not deployed yet");

      if (account.chain?.id !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }

      toast({ tone: "info", title: "Opening Lucky Draw", description: "Confirm the draw request in your wallet." });
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: luckyDrawAbi as Abi,
        functionName: "requestDraw",
        args: [
          proofs.map((proof) => ({
            game: proof.contractAddress as `0x${string}`,
            requestId: BigInt(proof.requestId)
          }))
        ],
        dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const requestLog = parseEventLogs({
        abi: luckyDrawAbi as Abi,
        logs: receipt.logs,
        eventName: "DrawRequested"
      })[0];
      const requestId = (requestLog?.args as { requestId?: bigint } | undefined)?.requestId;
      if (typeof requestId !== "bigint") throw new Error("Draw request id was not found in transaction logs");
      const requestIdString = requestId.toString();
      setPendingRequest({
        requestId: requestIdString,
        requestTxHash: hash,
        requestedAt: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ["lucky-draw", address?.toLowerCase() ?? "none"] });
      queryClient.invalidateQueries({ queryKey: ["lucky-draw-history"] });

      toast({ tone: "info", title: "Waiting for VRF", description: "The reward reel will keep spinning until Chainlink VRF resolves the draw." });
      const result = await waitForDrawResolved({ publicClient, contractAddress, requestId, fromBlock: receipt.blockNumber });
      return {
        status: "resolved" as const,
        result: { ...result, requestTxHash: hash }
      };
    },
    onSuccess: (data) => {
      setPendingRequest(null);
      queryClient.invalidateQueries({ queryKey: ["lucky-draw", address?.toLowerCase() ?? "none"] });
      queryClient.invalidateQueries({ queryKey: ["lucky-draw-history"] });
      toast({
        tone: "success",
        title: `Lucky Draw: ${formatEth(data.result.prizeAmountEth)} ETH`,
        description: "VRF resolved the draw. Claim the prize from the result card."
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (message.includes("still pending")) {
        queryClient.invalidateQueries({ queryKey: ["lucky-draw", address?.toLowerCase() ?? "none"] });
        queryClient.invalidateQueries({ queryKey: ["lucky-draw-history"] });
        toast({ tone: "info", title: "Lucky Draw pending", description: "The request is on-chain. The page will pick up the result from reward history when VRF resolves." });
        return;
      }
      const parsed = parseContractError(error);
      toast({ tone: "error", title: "Lucky Draw failed", description: parsed.message });
    }
  });

  return {
    ...mutation,
    pendingRequest,
    clearPendingRequest: () => setPendingRequest(null),
    reset: () => {
      setPendingRequest(null);
      mutation.reset();
    },
    isPending: mutation.isPending || isWritePending || isSwitchPending
  };
}

export function useClaimLuckyDrawPrize(address?: string | null) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const account = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();

  const mutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!address || !account.address) {
        openWalletModal();
        throw new Error("Connect wallet first");
      }
      if (account.address.toLowerCase() !== address.toLowerCase()) throw new Error("Connect the wallet that owns this prize");
      const contractAddress = getLuckyDrawContractAddress();
      if (!contractAddress) throw new Error("Lucky Draw contract is not deployed yet");
      if (account.chain?.id !== base.id) {
        await switchChainAsync({ chainId: base.id });
      }
      if (!publicClient) throw new Error("Network RPC is not ready");
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: luckyDrawAbi as Abi,
        functionName: "claimPrize",
        args: [BigInt(requestId)],
        dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    onSuccess: (_hash, requestId) => {
      queryClient.setQueriesData<LuckyDrawHistory>({ queryKey: ["lucky-draw-history"] }, (current) => markHistoryClaimed(current, requestId));
      queryClient.invalidateQueries({ queryKey: ["lucky-draw", address?.toLowerCase() ?? "none"] });
      queryClient.invalidateQueries({ queryKey: ["lucky-draw-history"] });
      toast({ tone: "success", title: "Lucky Draw prize claimed" });
    },
    onError: (error) => {
      const parsed = parseContractError(error);
      toast({ tone: "error", title: "Prize claim failed", description: parsed.message });
    },
  });

  return { ...mutation, isPending: mutation.isPending || isPending || isSwitchPending };
}

function markHistoryClaimed(history: LuckyDrawHistory | undefined, requestId: string) {
  if (!history) return history;
  return {
    ...history,
    rows: history.rows.map((row) => (row.requestId === requestId ? { ...row, status: "claimed" as const } : row))
  };
}

export function useLuckyDrawAdmin() {
  const { address } = useAccount();
  const isOwner = useIsOwner();
  const { signMessageAsync } = useSignMessage();

  return useQuery({
    queryKey: ["admin-lucky-draw", address?.toLowerCase() ?? "none"],
    queryFn: async () => {
      if (!address) throw new Error("Connect admin wallet first");
      const query = await getSignedAdminQuery({ action: "admin-read", address, signMessageAsync });
      const data = await fetchBackendJson<LuckyDrawAdminState>(`/api/admin/lucky-draw?${query}`);
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    enabled: Boolean(address && isOwner),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });
}

export function useUpdateLuckyDrawConfig() {
  const queryClient = useQueryClient();
  const account = useAccount();
  const { address } = account;
  const { signMessageAsync, isPending: isSigning } = useSignMessage();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const publicClient = usePublicClient();
  const toast = useToast();

  const mutation = useMutation({
    mutationFn: async (config: {
      enabled: boolean;
      roundsRequired: number;
      minBetEth: number;
      dailyDrawCap: number;
      ethUsdReference: number;
      pausedReason: string | null;
      prizes: Array<{ usd: number; weight: number }>;
    }) => {
      if (!address) throw new Error("Connect admin wallet first");
      const contractAddress = getLuckyDrawContractAddress();
      if (contractAddress) {
        if (account.chain?.id !== base.id) {
          await switchChainAsync({ chainId: base.id });
        }
        await writeContractAsync({
          address: contractAddress,
          abi: luckyDrawAbi as Abi,
          functionName: "setDrawConfig",
          args: [BigInt(config.roundsRequired), parseEther(formatEtherInput(config.minBetEth))],
          dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
        });
        await writeContractAsync({
          address: contractAddress,
          abi: luckyDrawAbi as Abi,
          functionName: "setPrizeTable",
          args: [
            config.prizes.map((prize) => ({
              amount: parseEther(formatEtherInput(prize.usd / Math.max(1, config.ethUsdReference))),
              weight: Number(prize.weight)
            }))
          ],
          dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
        });
        const paused = publicClient
          ? await publicClient.readContract({
              address: contractAddress,
              abi: luckyDrawAbi as Abi,
              functionName: "paused"
            })
          : null;
        if (typeof paused === "boolean" && paused === config.enabled) {
          await writeContractAsync({
            address: contractAddress,
            abi: luckyDrawAbi as Abi,
            functionName: config.enabled ? "unpause" : "pause",
            dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
          });
        }
      }
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
      queryClient.setQueryData(["admin-lucky-draw", address?.toLowerCase() ?? "none"], data);
      queryClient.invalidateQueries({ queryKey: ["admin-ops"] });
      toast({ tone: "success", title: "Lucky Draw config saved" });
    },
    onError: (error) => {
      toast({ tone: "error", title: "Config update failed", description: error instanceof Error ? cleanBackendError(error.message) : undefined });
    }
  });

  return { ...mutation, isPending: mutation.isPending || isSigning || isWritePending || isSwitchPending };
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
      queryClient.setQueryData(["admin-lucky-draw", address?.toLowerCase() ?? "none"], data);
      toast({ tone: "success", title: "Lucky Draw result updated" });
    },
    onError: (error) => {
      toast({ tone: "error", title: "Result update failed", description: error instanceof Error ? cleanBackendError(error.message) : undefined });
    }
  });

  return { ...mutation, isPending: mutation.isPending || isSigning };
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
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function formatEtherInput(value: number) {
  return Number(value || 0).toFixed(18).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

function getLuckyDrawContractAddress(): `0x${string}` | null {
  try {
    return getContractAddress(base.id, "LuckyDraw");
  } catch {
    return null;
  }
}

async function waitForDrawResolved({
  publicClient,
  contractAddress,
  requestId,
  fromBlock
}: {
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>;
  contractAddress: `0x${string}`;
  requestId: bigint;
  fromBlock: bigint;
}): Promise<OnchainLuckyDrawResult> {
  const startedAt = Date.now();
  const delays = [8_000, 12_000, 18_000, 25_000, 35_000, 45_000];
  let cursor = fromBlock;

  for (const delay of delays) {
    const latestBlock = await publicClient.getBlockNumber();
    if (cursor <= latestBlock) {
      const logs = await publicClient.getContractEvents({
        address: contractAddress,
        abi: luckyDrawAbi as Abi,
        eventName: "DrawResolved",
        args: { requestId },
        fromBlock: cursor,
        toBlock: latestBlock
      } as any);
      const log = logs[0] as { args?: Record<string, unknown>; transactionHash?: string } | undefined;
      const prizeAmount = log?.args?.prizeAmount;
      const prizeIndex = log?.args?.prizeIndex;
      if (typeof prizeAmount === "bigint" && (typeof prizeIndex === "number" || typeof prizeIndex === "bigint")) {
        return {
          requestId: requestId.toString(),
          prizeIndex: Number(prizeIndex),
          prizeAmountWei: prizeAmount.toString(),
          prizeAmountEth: Number(prizeAmount) / 1e18,
          txHash: log?.transactionHash ?? null
        };
      }
      cursor = latestBlock + 1n;
    }
    if (Date.now() - startedAt > 150_000) break;
    await sleep(delay);
  }

  throw new Error("Lucky Draw VRF result is still pending. Keep the page open or check again soon.");
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
