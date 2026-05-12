"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPublicClient, fallback, formatEther, http, parseAbi } from "viem";
import { base } from "wagmi/chains";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { BASE_MAINNET_FRONTEND_RPC_URLS, getNetworkByChainId } from "@baseplay/shared/config/networks";
import { fetchBackendJson } from "@/lib/backend";
import { defaultChainId } from "@/lib/env";
import { parseContractError } from "@/lib/errors";
import { useToast } from "@/components/ui/ToastProvider";
import { BASEPLAY_BUILDER_CODE_SUFFIX } from "@/lib/builderCode";

const pendingRoundAbi = parseAbi([
  "function activeRound(address player) view returns (uint256)",
  "function rounds(uint256 requestId) view returns (address player,uint256 betAmount,uint256 reservedPayout,uint256 requestId,bytes gameParams,bool settled,uint256 blockNumber)",
  "function VRF_TIMEOUT_BLOCKS() view returns (uint256)",
  "function claimRefund()"
]);

const clientByChainId = {
  8453: createPublicClient({
    chain: base,
    batch: { multicall: true },
    transport: fallback(BASE_MAINNET_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 10_000 })))
  })
} as const;

export interface PendingRound {
  gameId: string;
  gameName: string;
  gamePath: string;
  contractName: string;
  contractAddress: `0x${string}`;
  chainId: 8453;
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

export function usePendingRounds() {
  const { address } = useAccount();
  const player = useMemo(() => address?.toLowerCase() ?? null, [address]);

  return useQuery({
    queryKey: ["pending-rounds", player ?? "none", "baseMainnet"],
    queryFn: () => fetchPendingRounds(address!),
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
        functionName: "claimRefund",
        dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX
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

export function getPreferredPendingChainIds() {
  return [defaultChainId] as const;
}

async function fetchPendingRounds(player: `0x${string}`): Promise<PendingRound[]> {
  const preferredChainId = getPreferredPendingChainIds()[0];
  const backend = await fetchBackendJson<BackendPendingResponse>(
    `/api/player/${player}/pending-rounds?chainId=${preferredChainId}`
  ).catch(() => null);
  if (backend?.rows) {
    return backend.rows.map(fromBackendPendingRound);
  }

  const rows: PendingRound[] = [];

  for (const chainId of getPreferredPendingChainIds()) {
    const client = clientByChainId[chainId];
    const network = getNetworkByChainId(chainId);
    const latestBlock = await client.getBlockNumber();
    const deployedGames = GAMES_REGISTRY.filter((entry) => entry.active && entry.chains.includes("baseMainnet"))
      .map((game) => ({
        game,
        contractAddress: CONTRACT_ADDRESSES[chainId]?.[game.contractName]
      }))
      .filter((entry): entry is { game: (typeof GAMES_REGISTRY)[number]; contractAddress: `0x${string}` } => Boolean(entry.contractAddress));

    const activeRoundReads = await client
      .multicall({
        allowFailure: true,
        contracts: deployedGames.map(({ contractAddress }) => ({
          address: contractAddress,
          abi: pendingRoundAbi,
          functionName: "activeRound",
          args: [player]
        }))
      })
      .catch(() => []);
    const activeGames = deployedGames
      .map((entry, index) => ({
        ...entry,
        activeRound: activeRoundReads[index]?.status === "success" ? (activeRoundReads[index].result as bigint) : 0n
      }))
      .filter((entry) => entry.activeRound > 0n);

    const detailReads = await client
      .multicall({
        allowFailure: true,
        contracts: activeGames.flatMap(({ contractAddress, activeRound }) => [
          {
            address: contractAddress,
            abi: pendingRoundAbi,
            functionName: "rounds",
            args: [activeRound]
          },
          {
            address: contractAddress,
            abi: pendingRoundAbi,
            functionName: "VRF_TIMEOUT_BLOCKS"
          }
        ])
      })
      .catch(() => []);

    for (const [index, { game, contractAddress }] of activeGames.entries()) {
      const roundRead = detailReads[index * 2];
      const timeoutRead = detailReads[index * 2 + 1];
      if (roundRead?.status !== "success") continue;
      const round = roundRead.result as unknown as readonly [`0x${string}`, bigint, bigint, bigint, `0x${string}`, boolean, bigint];
      const timeoutBlocks = timeoutRead?.status === "success" ? (timeoutRead.result as bigint) : 60n;

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
