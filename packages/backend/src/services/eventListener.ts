import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { BASE_MAINNET_BACKEND_RPC_URLS, type NetworkKey } from "@baseplay/shared/config/networks";
import { netPayoutFromGross } from "@baseplay/shared/utils/payout";
import { createPublicClient, decodeEventLog, formatEther, parseAbi, type Address, type Log } from "viem";
import { base } from "viem/chains";
import { supabaseAdmin } from "../supabase/client.js";
import type { CrashEngine } from "./crashEngine.js";
import { createPublicFirstTransport } from "./rpc.js";

const ROUND_SETTLED_ABI = parseAbi([
  "event BetPlaced(address indexed player, uint256 indexed requestId, uint256 betAmount, bytes params)",
  "event RoundSettled(address indexed player, uint256 indexed requestId, uint256 betAmount, uint256 payout, bool won)",
  "event BetRefundClaimed(address indexed player, uint256 indexed requestId, uint256 betAmount)",
  "event CrashPointGenerated(uint256 indexed requestId, uint256 crashPoint)"
]);

interface InitOptions {
  crashEngine: CrashEngine;
}

interface EventClient {
  getBlockNumber: () => Promise<bigint>;
  getContractEvents: (args: {
    address: Address | Address[];
    abi: typeof ROUND_SETTLED_ABI;
    eventName?: GameEventName;
    fromBlock: bigint;
    toBlock: bigint;
  }) => Promise<Log[]>;
}

type GameEventName = "BetPlaced" | "RoundSettled" | "BetRefundClaimed" | "CrashPointGenerated";

const DEFAULT_LOOKBACK_BLOCKS = 20_000n;
const MAX_LOG_RANGE_BLOCKS = 9_000n;
const POLL_INTERVAL_MS = readPositiveNumber("INDEXER_POLL_MS", 30_000);
const ERROR_POLL_INTERVAL_MS = readPositiveNumber("INDEXER_ERROR_POLL_MS", 60_000);
const POLL_GAME_SPACING_MS = readPositiveNumber("INDEXER_GAME_SPACING_MS", 50);
const BLOCKPI_PATTERN = /blockpi\.network/i;
const indexerRuntime = new Map<string, { nextBlock: bigint | null }>();
const indexerHealth = new Map<
  string,
  {
    chainId: number;
    gameId: string;
    status: "starting" | "watching" | "catching_up" | "error";
    lastIndexedBlock: string | null;
    lastLogAt: string | null;
    lastError: string | null;
    updatedAt: string;
  }
>();
type ActiveGame = { game: (typeof GAMES_REGISTRY)[number]; address: Address };

export function getIndexerHealth() {
  return Array.from(indexerHealth.values()).sort((a, b) => a.chainId - b.chainId || a.gameId.localeCompare(b.gameId));
}

async function listenChain(chainId: 8453, options: InitOptions) {
  const networkKey = "baseMainnet";
  const viemChain = base;

  const client = createPublicClient({
    chain: viemChain,
    transport: createPublicFirstTransport(getBackendRpcUrls(chainId), { timeout: 10_000 })
  });

  const games = GAMES_REGISTRY.filter((entry) => entry.chains.includes(networkKey));
  startChainIndexerLoop(client as EventClient, chainId, networkKey, games, options);
}

export async function initEventListeners(options: InitOptions) {
  for (const chainId of getEnabledIndexerChains()) {
    await listenChain(chainId, options);
  }
}

async function getInitialFromBlock(
  client: EventClient,
  chainId: 8453,
  gameId: string,
  latestBlock: bigint
) {
  const envName = "INDEX_FROM_BLOCK_MAINNET";
  const configuredFromBlock = process.env[envName] ? BigInt(process.env[envName]!) : undefined;
  const checkpoint = configuredFromBlock === undefined ? await getIndexedCheckpoint(chainId, gameId) : 0n;
  return (
    configuredFromBlock ??
    (checkpoint > 0n
      ? checkpoint + 1n
      : latestBlock > DEFAULT_LOOKBACK_BLOCKS
        ? latestBlock - DEFAULT_LOOKBACK_BLOCKS
        : 0n)
  );
}

function startChainIndexerLoop(
  client: EventClient,
  chainId: 8453,
  networkKey: NetworkKey,
  games: Array<(typeof GAMES_REGISTRY)[number]>,
  options: InitOptions
) {
  const activeGames = games
    .map((game) => ({ game, address: CONTRACT_ADDRESSES[chainId]?.[game.contractName] }))
    .filter((entry): entry is { game: (typeof GAMES_REGISTRY)[number]; address: Address } => Boolean(entry.address));

  for (const { game } of activeGames) {
    setIndexerHealth(chainId, game.id, { status: "starting", lastError: null });
    console.log(`[Listener] Polling ${game.id} on ${networkKey}`);
  }

  void (async () => {
    while (true) {
      let delayMs = POLL_INTERVAL_MS;
      try {
        const latestBlock = await client.getBlockNumber();
        await pollGames(client, chainId, activeGames, latestBlock, options);
      } catch (error) {
        delayMs = ERROR_POLL_INTERVAL_MS;
        const message = cleanErrorMessage(error);
        console.error(`[Listener][${networkKey}] ${message}`);
        for (const { game } of activeGames) {
          setIndexerHealth(chainId, game.id, { status: "error", lastError: message });
        }
      }
      await sleep(delayMs);
    }
  })();
}

async function pollGames(
  client: EventClient,
  chainId: 8453,
  activeGames: ActiveGame[],
  latestBlock: bigint,
  options: InitOptions
) {
  const dueGames: Array<ActiveGame & { state: { nextBlock: bigint | null } }> = [];

  for (const entry of activeGames) {
    const key = `${chainId}:${entry.game.id}`;
    const state = indexerRuntime.get(key) ?? { nextBlock: null };
    if (state.nextBlock === null) {
      state.nextBlock = await getInitialFromBlock(client, chainId, entry.game.id, latestBlock);
      indexerRuntime.set(key, state);
    }

    if (state.nextBlock > latestBlock) {
      setIndexerHealth(chainId, entry.game.id, { status: "watching", lastError: null });
      continue;
    }

    dueGames.push({ ...entry, state });
  }

  if (dueGames.length === 0) return;

  const fromBlock = dueGames.reduce((min, entry) => {
    const nextBlock = entry.state.nextBlock ?? latestBlock;
    return nextBlock < min ? nextBlock : min;
  }, latestBlock);
  const toBlock = fromBlock + MAX_LOG_RANGE_BLOCKS > latestBlock ? latestBlock : fromBlock + MAX_LOG_RANGE_BLOCKS;
  const catchingUp = latestBlock - toBlock > MAX_LOG_RANGE_BLOCKS;
  const entriesByAddress = new Map(dueGames.map((entry) => [entry.address.toLowerCase(), entry]));
  const logsByGameId = new Map<string, Log[]>();

  try {
    for (const { game } of dueGames) {
      setIndexerHealth(chainId, game.id, { status: catchingUp ? "catching_up" : "watching", lastError: null });
    }

    const logs = await client.getContractEvents({
      address: dueGames.map((entry) => entry.address),
      abi: ROUND_SETTLED_ABI,
      fromBlock,
      toBlock
    });

    for (const log of logs) {
      const entry = entriesByAddress.get(log.address.toLowerCase());
      const nextBlock = entry?.state.nextBlock;
      if (!entry || nextBlock === null || nextBlock === undefined) continue;
      if (log.blockNumber !== null && log.blockNumber < nextBlock) continue;
      const rows = logsByGameId.get(entry.game.id) ?? [];
      rows.push(log);
      logsByGameId.set(entry.game.id, rows);
    }

    for (const entry of dueGames) {
      if ((entry.state.nextBlock ?? latestBlock) > toBlock) continue;
      const gameId = entry.game.id;
      const gameLogs = logsByGameId.get(gameId) ?? [];
      const groupedLogs = groupLogsByEventName(gameLogs);
      const betLogs = groupedLogs.BetPlaced;
      await persistRoundEvents(chainId, gameId, entry.address, "BetPlaced", betLogs);

      const refundLogs = groupedLogs.BetRefundClaimed;
      await persistRoundEvents(chainId, gameId, entry.address, "BetRefundClaimed", refundLogs);

      const crashLogs = gameId === "crash" ? groupedLogs.CrashPointGenerated : [];
      if (crashLogs.length > 0) {
        await persistRoundEvents(chainId, gameId, entry.address, "CrashPointGenerated", crashLogs);
      }

      if (gameId === "crash" && latestBlock - toBlock <= 20n) {
        for (const log of crashLogs) {
          const args = "args" in log ? (log.args as { requestId?: bigint; crashPoint?: bigint }) : undefined;
          if (args?.requestId === undefined || args.crashPoint === undefined) continue;
          options.crashEngine.startRound(args.requestId.toString(), Number(args.crashPoint) / 100);
        }
      }

      const settledLogs = groupedLogs.RoundSettled;

      const lastLogBlock = await persistSettledLogs(chainId, gameId, settledLogs);
      await persistRoundEvents(chainId, gameId, entry.address, "RoundSettled", settledLogs);
      await saveIndexedCheckpoint(chainId, gameId, toBlock);
      entry.state.nextBlock = toBlock + 1n;
      indexerRuntime.set(`${chainId}:${gameId}`, entry.state);
      setIndexerHealth(chainId, gameId, {
        status: catchingUp ? "catching_up" : "watching",
        lastIndexedBlock: toBlock.toString(),
        ...(lastLogBlock ? { lastLogAt: new Date().toISOString() } : {}),
        lastError: null
      });
    }

    await sleep(POLL_GAME_SPACING_MS);
  } catch (error) {
    const message = cleanErrorMessage(error);
    console.error(`[Listener][batch][${chainId}] ${message}`);
    for (const { game } of dueGames) {
      setIndexerHealth(chainId, game.id, { status: "error", lastError: message });
    }
  }
}

async function getIndexedCheckpoint(chainId: 8453, gameId: string) {
  const { data, error } = await supabaseAdmin
    .from("indexer_state")
    .select("last_indexed_block")
    .eq("chain_id", chainId)
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) {
    console.error(`[Listener][${gameId}][${chainId}] Checkpoint read failed`, error.message);
    return 0n;
  }

  return data?.last_indexed_block ? BigInt(String(data.last_indexed_block)) : 0n;
}

async function saveIndexedCheckpoint(chainId: 8453, gameId: string, blockNumber: bigint) {
  const { error } = await supabaseAdmin.from("indexer_state").upsert(
    {
      chain_id: chainId,
      game_id: gameId,
      last_indexed_block: Number(blockNumber),
      updated_at: new Date().toISOString()
    },
    { onConflict: "chain_id,game_id" }
  );

  if (error) {
    console.error(`[Listener][${gameId}][${chainId}] Checkpoint write failed`, error.message);
  }
}

function setIndexerHealth(
  chainId: 8453,
  gameId: string,
  patch: Partial<ReturnType<typeof getIndexerHealth>[number]>
) {
  const key = `${chainId}:${gameId}`;
  const current =
    indexerHealth.get(key) ??
    {
      chainId,
      gameId,
      status: "starting" as const,
      lastIndexedBlock: null,
      lastLogAt: null,
      lastError: null,
      updatedAt: new Date().toISOString()
    };

  indexerHealth.set(key, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

function getBackendRpcUrls(chainId: 8453) {
  const rpcUrls = BASE_MAINNET_BACKEND_RPC_URLS;
  const urls = rpcUrls.filter((url) => url && !BLOCKPI_PATTERN.test(url));
  return urls.length > 0 ? urls : rpcUrls.filter(Boolean);
}

function getEnabledIndexerChains(): Array<8453> {
  return [8453];
}

function readPositiveNumber(name: string, fallbackValue: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Details:\s*"[\s\S]*/i, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

async function persistSettledLogs(chainId: 8453, gameId: string, logs: Log[]) {
  let lastBlock = 0n;

  for (const log of logs) {
    if (log.blockNumber && log.blockNumber > lastBlock) lastBlock = log.blockNumber;
    const parsed = "args" in log ? log : null;
    const args = parsed?.args as
      | {
          player?: Address;
          requestId?: bigint;
          betAmount?: bigint;
          payout?: bigint;
          won?: boolean;
        }
      | undefined;

    if (!args?.player || args.requestId === undefined || args.betAmount === undefined || args.payout === undefined) {
      continue;
    }

    const { error } = await supabaseAdmin.from("game_rounds").upsert(
      {
        tx_hash: log.transactionHash,
        vrf_request_id: args.requestId.toString(),
        player: args.player.toLowerCase(),
        game_id: gameId,
        chain_id: chainId,
        bet_amount: Number(formatEther(args.betAmount)),
        payout: netPayoutFromGross(Number(formatEther(args.payout))),
        won: Boolean(args.won),
        settled_at: new Date().toISOString()
      },
      { onConflict: "vrf_request_id" }
    );

    if (error) {
      console.error(`[Listener][${gameId}][${chainId}] Supabase error`, error.message);
    }
  }

  return lastBlock || null;
}

function groupLogsByEventName(logs: Log[]) {
  const grouped: Record<GameEventName, Log[]> = {
    BetPlaced: [],
    RoundSettled: [],
    BetRefundClaimed: [],
    CrashPointGenerated: []
  };

  for (const log of logs) {
    const eventName = getLogEventName(log);
    if (eventName) grouped[eventName].push(log);
  }

  return grouped;
}

function getLogEventName(log: Log): GameEventName | null {
  const decodedName = "eventName" in log && typeof log.eventName === "string" ? log.eventName : null;
  if (isGameEventName(decodedName)) return decodedName;

  try {
    const decoded = decodeEventLog({ abi: ROUND_SETTLED_ABI, data: log.data, topics: log.topics });
    return isGameEventName(decoded.eventName) ? decoded.eventName : null;
  } catch {
    return null;
  }
}

function isGameEventName(value: unknown): value is GameEventName {
  return value === "BetPlaced" || value === "RoundSettled" || value === "BetRefundClaimed" || value === "CrashPointGenerated";
}

async function persistRoundEvents(
  chainId: 8453,
  gameId: string,
  contractAddress: Address,
  eventName: GameEventName,
  logs: Log[]
) {
  for (const log of logs) {
    const args = "args" in log ? (log.args as Record<string, unknown>) : {};
    const requestId = args.requestId;
    if (typeof requestId !== "bigint") continue;

    const player = typeof args.player === "string" ? args.player.toLowerCase() : null;
    const txHash = log.transactionHash ?? null;
    const logIndex = typeof log.logIndex === "number" ? log.logIndex : 0;

    const { error } = await supabaseAdmin.from("round_events").upsert(
      {
        vrf_request_id: requestId.toString(),
        event_name: eventName,
        tx_hash: txHash,
        block_number: log.blockNumber ? Number(log.blockNumber) : null,
        log_index: logIndex,
        player,
        game_id: gameId,
        chain_id: chainId,
        contract_address: contractAddress.toLowerCase(),
        args: serializeEventArgs(args) as any,
        observed_at: new Date().toISOString()
      },
      { onConflict: "chain_id,tx_hash,log_index" }
    );

    if (error) {
      console.error(`[Listener][${gameId}][${chainId}] Round event error`, error.message);
    }
  }
}

function serializeEventArgs(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeEventArgs);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => Number.isNaN(Number(key)))
        .map(([key, nestedValue]) => [key, serializeEventArgs(nestedValue)])
    );
  }
  return value;
}
