import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import {
  BASE_MAINNET_BACKEND_RPC_URLS,
  BASE_SEPOLIA_BACKEND_RPC_URLS,
  getNetworkByChainId,
  type NetworkKey
} from "@baseplay/shared/config/networks";
import { createPublicClient, formatEther, http, isAddress, parseAbi, type Address } from "viem";
import { base, baseSepolia } from "viem/chains";

const gameStatusAbi = parseAbi(["function gamePaused() view returns (bool)"]);

const vaultStatusAbi = parseAbi([
  "function paused() view returns (bool)",
  "function minBet() view returns (uint256)",
  "function maxBet() view returns (uint256)",
  "function houseEdgeBps() view returns (uint256)",
  "function availableLiquidity() view returns (uint256)",
  "function totalReservedPayout() view returns (uint256)",
  "function vaultBalance() view returns (uint256)"
]);

const pendingRoundAbi = parseAbi([
  "function activeRound(address player) view returns (uint256)",
  "function rounds(uint256 requestId) view returns (address player,uint256 betAmount,uint256 reservedPayout,uint256 requestId,bytes gameParams,bool settled,uint256 blockNumber)",
  "function VRF_TIMEOUT_BLOCKS() view returns (uint256)"
]);

type SupportedChainId = 8453 | 84532;
type RpcClient = ReturnType<typeof createPublicClient> & {
  getBlockNumber: () => Promise<bigint>;
  multicall: (args: { allowFailure: boolean; contracts: readonly unknown[] }) => Promise<Array<{ status: "success"; result: unknown } | { status: "failure"; error: unknown }>>;
};

const STATUS_CACHE_MS = readPositiveNumber("CONTRACT_STATUS_CACHE_MS", 120_000);
const PENDING_ROUNDS_CACHE_MS = readPositiveNumber("PENDING_ROUNDS_CACHE_MS", 30_000);
const RPC_COOLDOWN_MS = readPositiveNumber("RPC_UNHEALTHY_COOLDOWN_MS", 45_000);
const unhealthyUntil = new Map<string, number>();
const statusCache = new Map<number, { expiresAt: number; data: ContractStatusResponse }>();
const pendingRoundsCache = new Map<string, { expiresAt: number; rows: PendingRoundSnapshot[] }>();

export type ContractStatusResponse = {
  status: "ok";
  chainId: SupportedChainId;
  networkName: string;
  updatedAt: string;
  cacheTtlMs: number;
  games: Record<string, ContractOperationalSnapshot>;
};

export type ContractOperationalSnapshot = {
  status: "live" | "game_paused" | "vault_paused" | "no_liquidity" | "unavailable";
  gameId: string;
  contractName: string;
  gameAddress: Address | null;
  vaultAddress: Address | null;
  gamePaused: boolean;
  vaultPaused: boolean;
  minBetWei: string | null;
  maxBetWei: string | null;
  houseEdgeBps: number | null;
  availableLiquidityWei: string | null;
  totalReservedPayoutWei: string | null;
  vaultBalanceWei: string | null;
  minBetEth: string;
  maxBetEth: string;
  availableLiquidityEth: string;
  vaultBalanceEth: string;
};

export type PendingRoundSnapshot = {
  gameId: string;
  gameName: string;
  gamePath: string;
  contractName: string;
  contractAddress: Address;
  chainId: SupportedChainId;
  networkName: string;
  requestId: string;
  betAmountEth: string;
  reservedPayoutEth: string;
  blockNumber: string;
  latestBlock: string;
  timeoutBlocks: string;
  eligibleBlock: string;
  blocksRemaining: string;
  refundAvailable: boolean;
};

export function toSupportedChainId(chainId: unknown): SupportedChainId {
  return Number(chainId) === 8453 ? 8453 : 84532;
}

export async function getCachedContractStatus(chainId: SupportedChainId, force = false) {
  const cached = statusCache.get(chainId);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.data;

  const data = await withRpcFallback(chainId, (client) => loadContractStatus(client, chainId));
  statusCache.set(chainId, { data, expiresAt: Date.now() + STATUS_CACHE_MS });
  return data;
}

export async function getPendingRoundsForPlayer({
  player,
  chainId,
  scanAll = false
}: {
  player: string;
  chainId: SupportedChainId;
  scanAll?: boolean;
}) {
  if (!isAddress(player)) {
    throw new Error("Invalid player address");
  }

  const cacheKey = `${chainId}:${player.toLowerCase()}:${scanAll ? "all" : "active"}`;
  const cached = pendingRoundsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.rows;

  const chains = scanAll ? preferredChainOrder(chainId) : [chainId];
  const rows: PendingRoundSnapshot[] = [];
  for (const currentChainId of chains) {
    rows.push(...(await withRpcFallback(currentChainId, (client) => loadPendingRounds(client, currentChainId, player as Address))));
  }
  const sorted = rows.sort((a, b) => Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)));
  pendingRoundsCache.set(cacheKey, { rows: sorted, expiresAt: Date.now() + PENDING_ROUNDS_CACHE_MS });
  return sorted;
}

async function loadContractStatus(client: RpcClient, chainId: SupportedChainId): Promise<ContractStatusResponse> {
  const networkKey = getNetworkKey(chainId);
  const network = getNetworkByChainId(chainId);
  const vaultAddress = CONTRACT_ADDRESSES[chainId]?.GameVault ?? null;
  const games = GAMES_REGISTRY.filter((entry) => entry.active && entry.chains.includes(networkKey));

  if (!vaultAddress) {
    return emptyStatus(chainId, games, null);
  }

  const vaultCalls = [
    { address: vaultAddress, abi: vaultStatusAbi, functionName: "paused" },
    { address: vaultAddress, abi: vaultStatusAbi, functionName: "minBet" },
    { address: vaultAddress, abi: vaultStatusAbi, functionName: "maxBet" },
    { address: vaultAddress, abi: vaultStatusAbi, functionName: "houseEdgeBps" },
    { address: vaultAddress, abi: vaultStatusAbi, functionName: "availableLiquidity" },
    { address: vaultAddress, abi: vaultStatusAbi, functionName: "totalReservedPayout" },
    { address: vaultAddress, abi: vaultStatusAbi, functionName: "vaultBalance" }
  ] as const;

  const [vaultPaused, minBetWei, maxBetWei, houseEdgeBps, availableLiquidityWei, totalReservedPayoutWei, vaultBalanceWei] = await client
    .multicall({ allowFailure: true, contracts: vaultCalls })
    .then((results) => results.map((result) => (result.status === "success" ? result.result : null)));

  if (
    vaultPaused === null ||
    minBetWei === null ||
    maxBetWei === null ||
    houseEdgeBps === null ||
    availableLiquidityWei === null ||
    totalReservedPayoutWei === null ||
    vaultBalanceWei === null
  ) {
    throw new Error("Contract status vault reads failed");
  }

  const gameCalls = games
    .map((game) => ({
      game,
      address: CONTRACT_ADDRESSES[chainId]?.[game.contractName] ?? null
    }))
    .filter((entry): entry is { game: (typeof games)[number]; address: Address } => Boolean(entry.address))
    .map(({ game, address }) => ({
      game,
      address,
      call: { address, abi: gameStatusAbi, functionName: "gamePaused" } as const
    }));

  const pausedResults = gameCalls.length
    ? await client.multicall({ allowFailure: true, contracts: gameCalls.map((entry) => entry.call) })
    : [];

  if (gameCalls.length > 0 && pausedResults.every((result) => result.status !== "success")) {
    throw new Error("Contract status game reads failed");
  }

  const entries = gameCalls.map((entry, index) => {
    const pausedResult = pausedResults[index];
    const gamePaused = pausedResult?.status === "success" ? Boolean(pausedResult.result) : null;
    return [
      entry.game.contractName,
      decorateSnapshot({
        chainId,
        gameId: entry.game.id,
        contractName: entry.game.contractName,
        gameAddress: entry.address,
        vaultAddress,
        gamePaused,
        vaultPaused: typeof vaultPaused === "boolean" ? vaultPaused : null,
        minBetWei: bigintOrNull(minBetWei),
        maxBetWei: bigintOrNull(maxBetWei),
        houseEdgeBps: bigintOrNull(houseEdgeBps),
        availableLiquidityWei: bigintOrNull(availableLiquidityWei),
        totalReservedPayoutWei: bigintOrNull(totalReservedPayoutWei),
        vaultBalanceWei: bigintOrNull(vaultBalanceWei)
      })
    ] as const;
  });

  return {
    status: "ok",
    chainId,
    networkName: network?.name ?? String(chainId),
    updatedAt: new Date().toISOString(),
    cacheTtlMs: STATUS_CACHE_MS,
    games: Object.fromEntries(entries)
  };
}

async function loadPendingRounds(client: RpcClient, chainId: SupportedChainId, player: Address) {
  const networkKey = getNetworkKey(chainId);
  const network = getNetworkByChainId(chainId);
  const games = GAMES_REGISTRY.filter((entry) => entry.active && entry.chains.includes(networkKey));
  const gameContracts = games
    .map((game) => ({ game, address: CONTRACT_ADDRESSES[chainId]?.[game.contractName] ?? null }))
    .filter((entry): entry is { game: (typeof games)[number]; address: Address } => Boolean(entry.address));

  if (gameContracts.length === 0) return [];

  const latestBlock = await client.getBlockNumber();
  const activeRoundResults = await client.multicall({
    allowFailure: true,
    contracts: gameContracts.map(({ address }) => ({
      address,
      abi: pendingRoundAbi,
      functionName: "activeRound",
      args: [player]
    }))
  });

  const active = activeRoundResults
    .map((result, index) => ({ result, entry: gameContracts[index] }))
    .filter((item): item is { result: { status: "success"; result: bigint }; entry: (typeof gameContracts)[number] } => item.result.status === "success" && item.result.result > 0n);

  if (active.length === 0) return [];

  const roundResults = await client.multicall({
    allowFailure: true,
    contracts: active.flatMap(({ entry, result }) => [
      { address: entry.address, abi: pendingRoundAbi, functionName: "rounds", args: [result.result] },
      { address: entry.address, abi: pendingRoundAbi, functionName: "VRF_TIMEOUT_BLOCKS" }
    ])
  });

  const rows: PendingRoundSnapshot[] = [];
  active.forEach(({ entry }, index) => {
    const roundResult = roundResults[index * 2];
    const timeoutResult = roundResults[index * 2 + 1];
    if (roundResult?.status !== "success") return;

    const [roundPlayer, betAmount, reservedPayout, requestId, , settled, blockNumber] = roundResult.result as unknown as [Address, bigint, bigint, bigint, `0x${string}`, boolean, bigint];
    if (settled || roundPlayer.toLowerCase() !== player.toLowerCase()) return;

    const timeoutBlocks = timeoutResult?.status === "success" && typeof timeoutResult.result === "bigint" ? timeoutResult.result : 60n;
    const eligibleBlock = blockNumber + timeoutBlocks;
    const refundAvailable = latestBlock > eligibleBlock;
    const blocksRemaining = refundAvailable ? 0n : eligibleBlock - latestBlock + 1n;

    rows.push({
      gameId: entry.game.id,
      gameName: entry.game.name,
      gamePath: entry.game.path,
      contractName: entry.game.contractName,
      contractAddress: entry.address,
      chainId,
      networkName: network?.name ?? String(chainId),
      requestId: requestId.toString(),
      betAmountEth: formatEther(betAmount),
      reservedPayoutEth: formatEther(reservedPayout),
      blockNumber: blockNumber.toString(),
      latestBlock: latestBlock.toString(),
      timeoutBlocks: timeoutBlocks.toString(),
      eligibleBlock: eligibleBlock.toString(),
      blocksRemaining: blocksRemaining.toString(),
      refundAvailable
    });
  });

  return rows;
}

async function withRpcFallback<T>(chainId: SupportedChainId, run: (client: RpcClient) => Promise<T>): Promise<T> {
  const urls = orderedHealthyUrls(chainId);
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const client = createPublicClient({
        chain: chainId === 8453 ? base : baseSepolia,
        transport: http(url, { timeout: 8_000, retryCount: 1, retryDelay: 250 })
      });
      return await run(client as RpcClient);
    } catch (error) {
      lastError = error;
      markRpcUnhealthy(url, error);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All RPC endpoints failed");
}

function orderedHealthyUrls(chainId: SupportedChainId) {
  const urls = chainId === 8453 ? BASE_MAINNET_BACKEND_RPC_URLS : BASE_SEPOLIA_BACKEND_RPC_URLS;
  const now = Date.now();
  const healthy = urls.filter((url) => (unhealthyUntil.get(url) ?? 0) <= now);
  const coolingDown = urls.filter((url) => (unhealthyUntil.get(url) ?? 0) > now);
  return [...healthy, ...coolingDown];
}

function markRpcUnhealthy(url: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/429|rate limit|over rate|521|filter not found|web server is down|fetch failed/i.test(message)) {
    unhealthyUntil.set(url, Date.now() + RPC_COOLDOWN_MS);
  }
}

function emptyStatus(chainId: SupportedChainId, games: typeof GAMES_REGISTRY, vaultAddress: Address | null): ContractStatusResponse {
  const network = getNetworkByChainId(chainId);
  return {
    status: "ok",
    chainId,
    networkName: network?.name ?? String(chainId),
    updatedAt: new Date().toISOString(),
    cacheTtlMs: STATUS_CACHE_MS,
    games: Object.fromEntries(
      games.map((game) => [
        game.contractName,
        decorateSnapshot({
          chainId,
          gameId: game.id,
          contractName: game.contractName,
          gameAddress: null,
          vaultAddress,
          gamePaused: null,
          vaultPaused: null,
          minBetWei: null,
          maxBetWei: null,
          houseEdgeBps: null,
          availableLiquidityWei: null,
          totalReservedPayoutWei: null,
          vaultBalanceWei: null
        })
      ])
    )
  };
}

function decorateSnapshot(input: {
  chainId: SupportedChainId;
  gameId: string;
  contractName: string;
  gameAddress: Address | null;
  vaultAddress: Address | null;
  gamePaused: boolean | null;
  vaultPaused: boolean | null;
  minBetWei: bigint | null;
  maxBetWei: bigint | null;
  houseEdgeBps: bigint | null;
  availableLiquidityWei: bigint | null;
  totalReservedPayoutWei: bigint | null;
  vaultBalanceWei: bigint | null;
}): ContractOperationalSnapshot {
  const status =
    input.gamePaused === null || input.vaultPaused === null || input.availableLiquidityWei === null
      ? "unavailable"
      : input.vaultPaused
        ? "vault_paused"
        : input.gamePaused
          ? "game_paused"
          : input.availableLiquidityWei === 0n
            ? "no_liquidity"
            : "live";

  return {
    status,
    gameId: input.gameId,
    contractName: input.contractName,
    gameAddress: input.gameAddress,
    vaultAddress: input.vaultAddress,
    gamePaused: input.gamePaused === true,
    vaultPaused: input.vaultPaused === true,
    minBetWei: input.minBetWei?.toString() ?? null,
    maxBetWei: input.maxBetWei?.toString() ?? null,
    houseEdgeBps: input.houseEdgeBps === null ? null : Number(input.houseEdgeBps),
    availableLiquidityWei: input.availableLiquidityWei?.toString() ?? null,
    totalReservedPayoutWei: input.totalReservedPayoutWei?.toString() ?? null,
    vaultBalanceWei: input.vaultBalanceWei?.toString() ?? null,
    minBetEth: input.minBetWei === null ? "-" : formatEther(input.minBetWei),
    maxBetEth: input.maxBetWei === null ? "-" : formatEther(input.maxBetWei),
    availableLiquidityEth: input.availableLiquidityWei === null ? "-" : formatEther(input.availableLiquidityWei),
    vaultBalanceEth: input.vaultBalanceWei === null ? "-" : formatEther(input.vaultBalanceWei)
  };
}

function bigintOrNull(value: unknown) {
  return typeof value === "bigint" ? value : null;
}

function getNetworkKey(chainId: SupportedChainId): NetworkKey {
  return chainId === 8453 ? "baseMainnet" : "baseSepolia";
}

function preferredChainOrder(chainId: SupportedChainId) {
  return chainId === 8453 ? ([8453, 84532] as const) : ([84532, 8453] as const);
}

function readPositiveNumber(name: string, fallbackValue: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}
