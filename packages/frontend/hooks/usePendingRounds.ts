"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, fallback, formatEther, http, parseAbi } from "viem";
import { base, baseSepolia } from "wagmi/chains";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { BASE_MAINNET_FRONTEND_RPC_URLS, BASE_SEPOLIA_FRONTEND_RPC_URLS, getNetworkByChainId, type NetworkKey } from "@baseplay/shared/config/networks";
import { fetchBackendJson } from "@/lib/backend";
import { defaultChainId } from "@/lib/env";
import { parseContractError } from "@/lib/errors";
import { useToast } from "@/components/ui/ToastProvider";

const pendingRoundAbi = parseAbi([
  "function activeRound(address player) view returns (uint256)",
  "function rounds(uint256 requestId) view returns (address player,uint256 betAmount,uint256 reservedPayout,uint256 requestId,bytes gameParams,bool settled,uint256 blockNumber)",
  "function VRF_TIMEOUT_BLOCKS() view returns (uint256)",
  "function claimRefund()"
]);

const clientByChainId = {
  8453: createPublicClient({
    chain: base,
    transport: fallback(BASE_MAINNET_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 10_000 })))
  }),
  84532: createPublicClient({
    chain: baseSepolia,
    transport: fallback(BASE_SEPOLIA_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 10_000 })))
  })
} as const;

export interface PendingRound {
  gameId: string;
  gameName: string;
  gamePath: string;
  contractName: string;
  contractAddress: `0x${string}`;
  chainId: 8453 | 84532;
  networkName: string;
  requestId: string;
  betAmountEth: string;
  reservedPayoutEth: string;
  blockNumber: bigint;
  latestBlock: bigint;
  timeoutBlocks: bigint;
  eligibleBlock: bigint;
  blocksRemaining: bigint;
  refundAvailable: boolean;
}

type BackendPendingRound = Omit<PendingRound, "blockNumber" | "latestBlock" | "timeoutBlocks" | "eligibleBlock" | "blocksRemaining"> & {
  blockNumber: string;
  latestBlock: string;
  timeoutBlocks: string;
  eligibleBlock: string;
  blocksRemaining: string;
};

type BackendPendingResponse = {
  status: "ok";
  rows: BackendPendingRound[];
};

export function usePendingRounds({ scanAll = false }: { scanAll?: boolean } = {}) {
  const { address } = useAccount();
  const player = useMemo(() => address?.toLowerCase() ?? null, [address]);

  return useQuery({
    queryKey: ["pending-rounds", player ?? "none", scanAll ? "all" : "active"],
    queryFn: () => fetchPendingRounds(address!, scanAll),
    enabled: Boolean(address),
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false
  });
}

export function useClaimPendingRound() {
  const toast = useToast();
  const { chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();

  async function claim(round: PendingRound) {
    if (chain?.id !== round.chainId) {
      const network = getNetworkByChainId(round.chainId);
      try {
        await switchChainAsync({ chainId: round.chainId });
        toast({ tone: "info", title: "Network switched", description: `Wallet switched to ${network?.name ?? round.networkName}. Confirm refund again.` });
      } catch {
        toast({ tone: "error", title: "Wrong network", description: `Switch to ${network?.name ?? round.networkName} to claim this refund.` });
      }
      return null;
    }

    try {
      const hash = await writeContractAsync({
        address: round.contractAddress,
        abi: pendingRoundAbi,
        functionName: "claimRefund"
      });
      toast({ tone: "success", title: "Refund submitted", description: hash });
      return hash;
    } catch (error) {
      const parsed = parseContractError(error);
      toast({ tone: "error", title: parsed.message });
      throw parsed;
    }
  }

  return { claim, isPending };
}

export function getPreferredPendingChainIds(scanAll = true) {
  const stored = typeof window === "undefined" ? 0 : Number(window.localStorage.getItem("baseplay:chainId"));
  const preferred = Number.isFinite(stored) && stored > 0 ? stored : defaultChainId;
  if (!scanAll) return preferred === 8453 ? ([8453] as const) : ([84532] as const);
  return preferred === 8453 ? ([8453, 84532] as const) : ([84532, 8453] as const);
}

async function fetchPendingRounds(player: `0x${string}`, scanAll: boolean): Promise<PendingRound[]> {
  const preferredChainId = getPreferredPendingChainIds(false)[0];
  const backend = await fetchBackendJson<BackendPendingResponse>(
    `/api/player/${player}/pending-rounds?chainId=${preferredChainId}&scanAll=${scanAll ? "1" : "0"}`
  ).catch(() => null);
  if (backend?.rows) {
    return backend.rows.map(fromBackendPendingRound);
  }

  const rows: PendingRound[] = [];

  for (const chainId of getPreferredPendingChainIds(scanAll)) {
    const client = clientByChainId[chainId];
    const networkKey: NetworkKey = chainId === 8453 ? "baseMainnet" : "baseSepolia";
    const network = getNetworkByChainId(chainId);
    const latestBlock = await client.getBlockNumber();

    for (const game of GAMES_REGISTRY.filter((entry) => entry.active && entry.chains.includes(networkKey))) {
      const contractAddress = CONTRACT_ADDRESSES[chainId]?.[game.contractName];
      if (!contractAddress) continue;

      const activeRound = await client
        .readContract({
          address: contractAddress,
          abi: pendingRoundAbi,
          functionName: "activeRound",
          args: [player]
        })
        .catch(() => 0n);

      if (activeRound === 0n) continue;

      const [round, timeoutBlocks] = await Promise.all([
        client.readContract({
          address: contractAddress,
          abi: pendingRoundAbi,
          functionName: "rounds",
          args: [activeRound]
        }),
        client
          .readContract({
            address: contractAddress,
            abi: pendingRoundAbi,
            functionName: "VRF_TIMEOUT_BLOCKS"
          })
          .catch(() => 60n)
      ]);

      const [roundPlayer, betAmount, reservedPayout, requestId, , settled, blockNumber] = round;
      if (settled || roundPlayer.toLowerCase() !== player.toLowerCase()) continue;

      const eligibleBlock = blockNumber + timeoutBlocks;
      const refundAvailable = latestBlock > eligibleBlock;
      const blocksRemaining = refundAvailable ? 0n : eligibleBlock - latestBlock + 1n;

      rows.push({
        gameId: game.id,
        gameName: game.name,
        gamePath: game.path,
        contractName: game.contractName,
        contractAddress,
        chainId,
        networkName: network?.name ?? String(chainId),
        requestId: requestId.toString(),
        betAmountEth: formatEther(betAmount),
        reservedPayoutEth: formatEther(reservedPayout),
        blockNumber,
        latestBlock,
        timeoutBlocks,
        eligibleBlock,
        blocksRemaining,
        refundAvailable
      });
    }
  }

  return rows.sort((a, b) => Number(b.blockNumber - a.blockNumber));
}

function fromBackendPendingRound(row: BackendPendingRound): PendingRound {
  return {
    ...row,
    blockNumber: BigInt(row.blockNumber),
    latestBlock: BigInt(row.latestBlock),
    timeoutBlocks: BigInt(row.timeoutBlocks),
    eligibleBlock: BigInt(row.eligibleBlock),
    blocksRemaining: BigInt(row.blocksRemaining)
  };
}
