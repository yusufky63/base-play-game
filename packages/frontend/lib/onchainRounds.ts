import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { BASE_SEPOLIA_FRONTEND_RPC_URLS } from "@baseplay/shared/config/networks";
import { netPayoutFromGross } from "@baseplay/shared/utils/payout";
import { createPublicClient, fallback, formatEther, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

const ROUND_SETTLED_ABI = parseAbi([
  "event RoundSettled(address indexed player, uint256 indexed requestId, uint256 betAmount, uint256 payout, bool won)"
]);

const FRONTEND_LOG_LOOKBACK_BLOCKS = 9_000n;

export interface OnchainRound {
  id: string;
  tx_hash: string;
  vrf_request_id: string;
  player: string;
  game_id: string;
  chain_id: number;
  bet_amount: number;
  payout: number;
  won: boolean;
  settled_at: string;
  block_number: bigint;
  log_index: number;
}

const client = createPublicClient({
  chain: baseSepolia,
  transport: fallback(BASE_SEPOLIA_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 10_000 })))
});

export async function fetchRecentOnchainRounds({
  limit = 20,
  gameId,
  player,
  before,
  winsOnly = false,
  resolveTimestamps = false
}: {
  limit?: number;
  gameId?: string;
  player?: string;
  before?: string;
  winsOnly?: boolean;
  resolveTimestamps?: boolean;
} = {}): Promise<OnchainRound[]> {
  const latestBlock = await client.getBlockNumber();
  const fromBlock = latestBlock > FRONTEND_LOG_LOOKBACK_BLOCKS ? latestBlock - FRONTEND_LOG_LOOKBACK_BLOCKS : 0n;
  const deployedGames = GAMES_REGISTRY.filter((game) => CONTRACT_ADDRESSES[84532]?.[game.contractName] && (!gameId || game.id === gameId));
  const rows: OnchainRound[] = [];

  for (const game of deployedGames) {
    const address = CONTRACT_ADDRESSES[84532][game.contractName];
    const logs = await client.getContractEvents({
      address,
      abi: ROUND_SETTLED_ABI,
      eventName: "RoundSettled",
      fromBlock,
      toBlock: latestBlock
    });

    for (const log of logs) {
      const args = log.args;
      if (!args.player || args.requestId === undefined || args.betAmount === undefined || args.payout === undefined) {
        continue;
      }

      rows.push({
        id: `${log.transactionHash}-${log.logIndex}`,
        tx_hash: log.transactionHash,
        vrf_request_id: args.requestId.toString(),
        player: args.player,
        game_id: game.id,
        chain_id: 84532,
        bet_amount: Number(formatEther(args.betAmount)),
        payout: netPayoutFromGross(Number(formatEther(args.payout))),
        won: Boolean(args.won),
        settled_at: "",
        block_number: log.blockNumber ?? 0n,
        log_index: log.logIndex ?? 0
      });
    }
  }

  const beforeMs = before ? Date.parse(before) : null;
  const playerKey = player?.toLowerCase();
  const sortedRows = rows
    .filter((row) => !playerKey || row.player.toLowerCase() === playerKey)
    .filter((row) => !winsOnly || row.won)
    .sort((a, b) => {
      if (a.block_number === b.block_number) return b.log_index - a.log_index;
      return a.block_number > b.block_number ? -1 : 1;
    });

  const visibleRows = beforeMs && resolveTimestamps
    ? sortedRows
    : sortedRows.slice(0, limit);

  const blockTimestamps = new Map<bigint, string>();
  if (resolveTimestamps) {
    const timestampBlocks = [...new Set(visibleRows.map((row) => row.block_number))]
      .filter((blockNumber) => blockNumber !== 0n)
      .slice(0, limit);

    for (const blockNumber of timestampBlocks) {
      const block = await client.getBlock({ blockNumber });
      blockTimestamps.set(blockNumber, new Date(Number(block.timestamp) * 1000).toISOString());
    }
  }

  return visibleRows
    .map((row) => ({
      ...row,
      settled_at: blockTimestamps.get(row.block_number) ?? estimateSettledAt(row.block_number, latestBlock)
    }))
    .filter((row) => !beforeMs || Date.parse(row.settled_at) < beforeMs)
    .slice(0, limit);
}

function estimateSettledAt(blockNumber: bigint, latestBlock: bigint) {
  if (blockNumber === 0n || blockNumber > latestBlock) return new Date().toISOString();
  const estimatedBlockMs = 2_000;
  const diff = latestBlock - blockNumber;
  const maxSafeDiff = diff > 10_000_000n ? 10_000_000n : diff;
  return new Date(Date.now() - Number(maxSafeDiff) * estimatedBlockMs).toISOString();
}
