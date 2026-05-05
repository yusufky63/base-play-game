import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { NETWORKS, type NetworkKey } from "@baseplay/shared/config/networks";
import { netPayoutFromGross } from "@baseplay/shared/utils/payout";
import { createPublicClient, fallback, formatEther, http, parseAbi, type Address, type Log } from "viem";
import { base, baseSepolia } from "viem/chains";
import { supabaseAdmin } from "../supabase/client.js";
import type { CrashEngine } from "./crashEngine.js";

const ROUND_SETTLED_ABI = parseAbi([
  "event RoundSettled(address indexed player, uint256 indexed requestId, uint256 betAmount, uint256 payout, bool won)",
  "event CrashPointGenerated(uint256 indexed requestId, uint256 crashPoint)"
]);

interface InitOptions {
  crashEngine: CrashEngine;
}

interface EventClient {
  getBlockNumber: () => Promise<bigint>;
  getContractEvents: (args: {
    address: Address;
    abi: typeof ROUND_SETTLED_ABI;
    eventName: "RoundSettled";
    fromBlock: bigint;
    toBlock: bigint;
  }) => Promise<Log[]>;
}

interface WatchClient extends EventClient {
  watchContractEvent: (args: {
    address: Address;
    abi: typeof ROUND_SETTLED_ABI;
    eventName: "RoundSettled" | "CrashPointGenerated";
    onLogs: (logs: any[]) => void | Promise<void>;
    onError: (error: Error) => void;
  }) => () => void;
}

const DEFAULT_LOOKBACK_BLOCKS = 20_000n;
const MAX_LOG_RANGE_BLOCKS = 9_000n;
const watcherRestarts = new Set<string>();
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

export function getIndexerHealth() {
  return Array.from(indexerHealth.values()).sort((a, b) => a.chainId - b.chainId || a.gameId.localeCompare(b.gameId));
}

async function listenChain(chainId: 84532 | 8453, options: InitOptions) {
  const networkKey = chainId === 8453 ? "baseMainnet" : "baseSepolia";
  const network = NETWORKS[networkKey];
  const viemChain = chainId === 8453 ? base : baseSepolia;

  const client = createPublicClient({
    chain: viemChain,
    transport: fallback(network.rpcUrls.filter(Boolean).map((url) => http(url, { timeout: 10_000 })))
  });

  for (const game of GAMES_REGISTRY.filter((entry) => entry.chains.includes(networkKey))) {
    await watchGame(client as WatchClient, chainId, networkKey, game, options);
  }
}

export async function initEventListeners(options: InitOptions) {
  await listenChain(84532, options);
  await listenChain(8453, options);
}

async function catchUpSettledRounds(
  client: EventClient,
  chainId: 84532 | 8453,
  address: Address,
  gameId: string
) {
  const latestBlock = await client.getBlockNumber();
  const envName = `INDEX_FROM_BLOCK_${chainId === 8453 ? "MAINNET" : "SEPOLIA"}`;
  const configuredFromBlock = process.env[envName] ? BigInt(process.env[envName]!) : undefined;
  const checkpoint = configuredFromBlock === undefined ? await getIndexedCheckpoint(chainId, gameId) : 0n;
  const fromBlock =
    configuredFromBlock ??
    (checkpoint > 0n
      ? checkpoint + 1n
      : latestBlock > DEFAULT_LOOKBACK_BLOCKS
        ? latestBlock - DEFAULT_LOOKBACK_BLOCKS
        : 0n);

  let indexed = 0;
  if (fromBlock > latestBlock) return;

  for (const { from, to } of blockRanges(fromBlock, latestBlock, MAX_LOG_RANGE_BLOCKS)) {
    setIndexerHealth(chainId, gameId, { status: "catching_up", lastError: null });
    const logs = await client.getContractEvents({
      address,
      abi: ROUND_SETTLED_ABI,
      eventName: "RoundSettled",
      fromBlock: from,
      toBlock: to
    });

    if (logs.length > 0) {
      await persistSettledLogs(chainId, gameId, logs);
      indexed += logs.length;
    }
    await saveIndexedCheckpoint(chainId, gameId, to);
    setIndexerHealth(chainId, gameId, { lastIndexedBlock: to.toString() });
  }

  if (indexed > 0) {
    console.log(`[Listener] Indexed ${indexed} historical ${gameId} rounds on chainId ${chainId}`);
  }
}

async function watchGame(
  client: WatchClient,
  chainId: 84532 | 8453,
  networkKey: NetworkKey,
  game: (typeof GAMES_REGISTRY)[number],
  options: InitOptions
) {
  const address = CONTRACT_ADDRESSES[chainId]?.[game.contractName];
  if (!address) return;

  setIndexerHealth(chainId, game.id, { status: "starting", lastError: null });
  await catchUpSettledRounds(client, chainId, address, game.id);

  const watcherKey = `${chainId}:${game.id}:settled`;
  const unwatchSettled = client.watchContractEvent({
    address,
    abi: ROUND_SETTLED_ABI,
    eventName: "RoundSettled",
    onLogs: async (logs) => {
      const lastBlock = await persistSettledLogs(chainId, game.id, logs);
      if (lastBlock) await saveIndexedCheckpoint(chainId, game.id, lastBlock);
      if (lastBlock) {
        setIndexerHealth(chainId, game.id, {
          status: "watching",
          lastIndexedBlock: lastBlock.toString(),
          lastLogAt: new Date().toISOString(),
          lastError: null
        });
      }
    },
    onError: (error) => {
      console.error(`[Listener][${game.id}][${chainId}]`, error.message);
      setIndexerHealth(chainId, game.id, { status: "error", lastError: error.message });
      unwatchSettled();
      scheduleWatcherRestart(watcherKey, () => void watchGame(client, chainId, networkKey, game, options));
    }
  });

  if (game.id === "crash") {
    watchCrashPoint(client, chainId, address, options);
  }

  setIndexerHealth(chainId, game.id, { status: "watching", lastError: null });
  console.log(`[Listener] Watching ${game.id} on ${networkKey}`);
}

function watchCrashPoint(
  client: WatchClient,
  chainId: 84532 | 8453,
  address: Address,
  options: InitOptions
) {
  const crashWatcherKey = `${chainId}:crash:crash-point`;
  const unwatchCrash = client.watchContractEvent({
    address,
    abi: ROUND_SETTLED_ABI,
    eventName: "CrashPointGenerated",
    onLogs: (logs) => {
      for (const log of logs) {
        const { requestId, crashPoint } = log.args;
        if (requestId === undefined || crashPoint === undefined) continue;
        options.crashEngine.startRound(requestId.toString(), Number(crashPoint) / 100);
      }
    },
    onError: (error) => {
      console.error(`[CrashListener][${chainId}]`, error.message);
      setIndexerHealth(chainId, "crash", { status: "error", lastError: error.message });
      unwatchCrash();
      scheduleWatcherRestart(crashWatcherKey, () => watchCrashPoint(client, chainId, address, options));
    }
  });
}

function scheduleWatcherRestart(key: string, restart: () => void) {
  if (watcherRestarts.has(key)) return;
  watcherRestarts.add(key);
  setTimeout(() => {
    watcherRestarts.delete(key);
    restart();
  }, 10_000);
}

async function getIndexedCheckpoint(chainId: 84532 | 8453, gameId: string) {
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

async function saveIndexedCheckpoint(chainId: 84532 | 8453, gameId: string, blockNumber: bigint) {
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
  chainId: 84532 | 8453,
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

function blockRanges(fromBlock: bigint, toBlock: bigint, maxRange: bigint) {
  const ranges: Array<{ from: bigint; to: bigint }> = [];
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const to = cursor + maxRange > toBlock ? toBlock : cursor + maxRange;
    ranges.push({ from: cursor, to });
    cursor = to + 1n;
  }

  return ranges;
}

async function persistSettledLogs(chainId: 84532 | 8453, gameId: string, logs: Log[]) {
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
