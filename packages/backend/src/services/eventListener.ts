import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { NETWORKS } from "@baseplay/shared/config/networks";
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

const DEFAULT_LOOKBACK_BLOCKS = 100_000n;
const MAX_LOG_RANGE_BLOCKS = 9_000n;

async function listenChain(chainId: 84532 | 8453, options: InitOptions) {
  const networkKey = chainId === 8453 ? "baseMainnet" : "baseSepolia";
  const network = NETWORKS[networkKey];
  const viemChain = chainId === 8453 ? base : baseSepolia;

  const client = createPublicClient({
    chain: viemChain,
    transport: fallback(network.rpcUrls.filter(Boolean).map((url) => http(url, { timeout: 10_000 })))
  });

  for (const game of GAMES_REGISTRY.filter((entry) => entry.chains.includes(networkKey))) {
    const address = CONTRACT_ADDRESSES[chainId]?.[game.contractName];
    if (!address) continue;

    await catchUpSettledRounds(client, chainId, address, game.id);

    client.watchContractEvent({
      address,
      abi: ROUND_SETTLED_ABI,
      eventName: "RoundSettled",
      onLogs: async (logs) => {
        await persistSettledLogs(chainId, game.id, logs);
      },
      onError: (error) => {
        console.error(`[Listener][${game.id}][${chainId}]`, error.message);
        setTimeout(() => void listenChain(chainId, options), 5_000);
      }
    });

    if (game.id === "crash") {
      client.watchContractEvent({
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
        onError: (error) => console.error(`[CrashListener][${chainId}]`, error.message)
      });
    }

    console.log(`[Listener] Watching ${game.id} on chainId ${chainId}`);
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
  const fromBlock = configuredFromBlock ?? (latestBlock > DEFAULT_LOOKBACK_BLOCKS ? latestBlock - DEFAULT_LOOKBACK_BLOCKS : 0n);

  let indexed = 0;

  for (const { from, to } of blockRanges(fromBlock, latestBlock, MAX_LOG_RANGE_BLOCKS)) {
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
  }

  if (indexed > 0) {
    console.log(`[Listener] Indexed ${indexed} historical ${gameId} rounds on chainId ${chainId}`);
  }
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
  for (const log of logs) {
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
}
