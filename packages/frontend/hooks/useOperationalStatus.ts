"use client";

import { useQuery } from "@tanstack/react-query";
import { createPublicClient, fallback, formatEther, http, type Abi } from "viem";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { defaultChainId } from "@/lib/env";
import { getNetworkConfigByChainId } from "@/lib/networkConfig";
import { usePreferredChainId } from "@/lib/preferredChain";

const gameStatusAbi = [
  { type: "function", name: "gamePaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] }
] as const satisfies Abi;

const vaultStatusAbi = [
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "minBet", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "maxBet", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "houseEdgeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "availableLiquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalReservedPayout", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "vaultBalance", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const satisfies Abi;

export type OperationalStatus = "loading" | "live" | "game_paused" | "vault_paused" | "no_liquidity" | "unavailable";

export type OperationalState = {
  status: OperationalStatus;
  chainId: number;
  networkName: string;
  gameAddress?: `0x${string}`;
  vaultAddress?: `0x${string}`;
  gamePaused: boolean;
  vaultPaused: boolean;
  minBetWei: bigint | null;
  maxBetWei: bigint | null;
  houseEdgeBps: number | null;
  availableLiquidityWei: bigint | null;
  totalReservedPayoutWei: bigint | null;
  vaultBalanceWei: bigint | null;
  minBetEth: string;
  maxBetEth: string;
  availableLiquidityEth: string;
  vaultBalanceEth: string;
  title: string;
  description: string;
  playDisabledLabel: string;
};

type SupportedChainId = 8453 | 84532;

export function useOperationalStatus(contractName: string | null | undefined) {
  const { chain } = useAccount();
  const preferredChainId = usePreferredChainId(chain?.id ?? defaultChainId);
  const effectiveChainId = toSupportedChainId(preferredChainId ?? chain?.id);

  const query = useQuery({
    queryKey: ["operational-status", effectiveChainId, contractName],
    enabled: Boolean(contractName),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => loadOperationalStatus(effectiveChainId, contractName!)
  });

  return query.data ?? buildFallbackStatus(effectiveChainId, query.isLoading ? "loading" : "unavailable");
}

async function loadOperationalStatus(chainId: SupportedChainId, contractName: string): Promise<OperationalState> {
  const networkConfig = getNetworkConfigByChainId(chainId);
  const network = networkConfig.network;
  const gameAddress = CONTRACT_ADDRESSES[network.chainId]?.[contractName];
  const vaultAddress = CONTRACT_ADDRESSES[network.chainId]?.GameVault;

  if (!gameAddress || !vaultAddress) {
    return buildFallbackStatus(network.chainId, "unavailable");
  }

  const client = createPublicClient({
    chain: networkConfig.viemChain,
    transport: fallback(networkConfig.rpcUrls.map((url) => http(url, { timeout: 10_000 })))
  });

  const [gamePaused, vaultPaused, minBetWei, maxBetWei, houseEdgeBps, availableLiquidityWei, totalReservedPayoutWei, vaultBalanceWei] = await Promise.all([
    client.readContract({ address: gameAddress, abi: gameStatusAbi, functionName: "gamePaused" }).catch(() => null),
    client.readContract({ address: vaultAddress, abi: vaultStatusAbi, functionName: "paused" }).catch(() => null),
    client.readContract({ address: vaultAddress, abi: vaultStatusAbi, functionName: "minBet" }).catch(() => null),
    client.readContract({ address: vaultAddress, abi: vaultStatusAbi, functionName: "maxBet" }).catch(() => null),
    client.readContract({ address: vaultAddress, abi: vaultStatusAbi, functionName: "houseEdgeBps" }).catch(() => null),
    client.readContract({ address: vaultAddress, abi: vaultStatusAbi, functionName: "availableLiquidity" }).catch(() => null),
    client.readContract({ address: vaultAddress, abi: vaultStatusAbi, functionName: "totalReservedPayout" }).catch(() => null),
    client.readContract({ address: vaultAddress, abi: vaultStatusAbi, functionName: "vaultBalance" }).catch(() => null)
  ]);

  const status: OperationalStatus =
    gamePaused === null || vaultPaused === null || availableLiquidityWei === null
      ? "unavailable"
      : vaultPaused
        ? "vault_paused"
        : gamePaused
          ? "game_paused"
          : availableLiquidityWei === 0n
            ? "no_liquidity"
            : "live";

  return decorateStatus({
    status,
    chainId: network.chainId,
    networkName: network.name,
    gameAddress,
    vaultAddress,
    gamePaused: gamePaused === true,
    vaultPaused: vaultPaused === true,
    minBetWei,
    maxBetWei,
    houseEdgeBps: houseEdgeBps === null ? null : Number(houseEdgeBps),
    availableLiquidityWei,
    totalReservedPayoutWei,
    vaultBalanceWei,
    minBetEth: minBetWei === null ? "-" : formatEther(minBetWei),
    maxBetEth: maxBetWei === null ? "-" : formatEther(maxBetWei),
    availableLiquidityEth: availableLiquidityWei === null ? "-" : formatEther(availableLiquidityWei),
    vaultBalanceEth: vaultBalanceWei === null ? "-" : formatEther(vaultBalanceWei)
  });
}

function buildFallbackStatus(chainId: number, status: OperationalStatus): OperationalState {
  const network = getNetworkByChainId(chainId);
  return decorateStatus({
    status,
    chainId,
    networkName: network?.name ?? "Unsupported network",
    gamePaused: false,
    vaultPaused: false,
    minBetWei: null,
    maxBetWei: null,
    houseEdgeBps: null,
    availableLiquidityWei: null,
    totalReservedPayoutWei: null,
    vaultBalanceWei: null,
    minBetEth: "-",
    maxBetEth: "-",
    availableLiquidityEth: "-",
    vaultBalanceEth: "-"
  });
}

function toSupportedChainId(chainId: number | undefined): SupportedChainId {
  const resolved = getNetworkByChainId(chainId ?? 0)?.chainId ?? defaultChainId;
  return resolved === 8453 ? 8453 : 84532;
}

function decorateStatus(base: Omit<OperationalState, "title" | "description" | "playDisabledLabel">): OperationalState {
  const copy = getOperationalCopy(base.status, base.networkName);
  return {
    ...base,
    ...copy
  };
}

function getOperationalCopy(status: OperationalStatus, networkName: string) {
  switch (status) {
    case "live":
      return {
        title: "Game live",
        description: `New rounds are open on ${networkName}.`,
        playDisabledLabel: ""
      };
    case "game_paused":
      return {
        title: "Game temporarily paused",
        description: "New rounds are closed for this game right now. You can pick another game or try again later.",
        playDisabledLabel: "Paused"
      };
    case "vault_paused":
      return {
        title: "Games temporarily paused",
        description: "New rounds are closed for a short maintenance window. Try again later.",
        playDisabledLabel: "Paused"
      };
    case "no_liquidity":
      return {
        title: "Games reopening soon",
        description: "New rounds are closed while the bankroll is topped up. Try again later.",
        playDisabledLabel: "Reopening soon"
      };
    case "loading":
      return {
        title: "Checking contract status",
        description: "Checking whether this game is ready.",
        playDisabledLabel: "Checking status"
      };
    case "unavailable":
    default:
      return {
        title: "Game unavailable",
        description: `This game is not ready on ${networkName}. Switch networks or try again later.`,
        playDisabledLabel: "Unavailable"
      };
  }
}
