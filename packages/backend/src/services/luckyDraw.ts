import { createPublicClient, encodePacked, getAddress, isAddress, keccak256, parseAbi, parseEther, verifyMessage } from "viem";
import { base } from "viem/chains";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { BASE_MAINNET_BACKEND_RPC_URLS } from "@baseplay/shared/config/networks";
import { supabaseAdmin } from "../supabase/client.js";
import { createPublicFirstTransport } from "./rpc.js";

type LuckyDrawConfigRow = {
  id: number;
  enabled: boolean;
  rounds_required: number;
  min_bet_eth: number;
  daily_draw_cap: number;
  eth_usd_reference: number;
  prize_table: unknown;
  paused_reason: string | null;
  updated_at: string;
};

type LuckyDrawProgressRow = {
  player: string;
  qualified_rounds: number;
  available_draws: number;
  lifetime_draws_earned: number;
  lifetime_draws_claimed: number;
  total_prize_eth: number;
  updated_at: string;
};

type LuckyDrawDailyProgressRow = {
  player: string;
  draw_day: string;
  qualified_rounds: number;
  earned_draws: number;
  updated_at: string;
};

type LuckyDrawResultRow = {
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

export type LuckyDrawPrize = {
  usd: number;
  weight: number;
  eth: number;
  oddsPct: number;
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
  recentResults: LuckyDrawResultRow[];
};

export type LuckyDrawProof = {
  roundId: string;
  gameId: string;
  contractAddress: string;
  requestId: string;
};

export type LuckyDrawCanonicalProgress = {
  player: string;
  roundsRequired: number;
  eligibleProofs: number;
  availableDraws: number;
  qualifiedRounds: number;
  lifetimeDrawsEarned: number;
  lifetimeDrawsClaimed: number;
  previous: Pick<LuckyDrawProgressRow, "qualified_rounds" | "available_draws" | "lifetime_draws_earned" | "lifetime_draws_claimed"> | null;
};

export type LuckyDrawPublicHistory = {
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

const DEFAULT_PRIZES = [
  { usd: 0.1, weight: 62_000 },
  { usd: 0.5, weight: 25_000 },
  { usd: 1, weight: 9_000 },
  { usd: 2.5, weight: 3_000 },
  { usd: 5, weight: 800 },
  { usd: 10, weight: 200 }
];

const DEFAULT_CONFIG: LuckyDrawConfigRow = {
  id: 1,
  enabled: true,
  rounds_required: 10,
  min_bet_eth: 0.000115,
  daily_draw_cap: 10,
  eth_usd_reference: 2187,
  prize_table: DEFAULT_PRIZES,
  paused_reason: null,
  updated_at: new Date(0).toISOString()
};

const FALLBACK_ADMIN_ADDRESSES = process.env.NODE_ENV === "production"
  ? []
  : ["0xeaa823ab4c4ee00283d8ed7be713ddf8a5ba0fac"];
const LUCKY_DRAW_ABI = parseAbi([
  "function consumedRounds(bytes32 roundKey) view returns (bool)",
  "event DrawResolved(address indexed player, uint256 indexed requestId, uint16 prizeIndex, uint256 prizeAmount, uint256 randomWord)",
  "event PrizeClaimed(address indexed player, uint256 indexed requestId, uint256 amount)"
]);
const GAME_ROUND_READER_ABI = parseAbi([
  "function rounds(uint256 requestId) view returns (address player, uint256 betAmount, uint256 reservedPayout, uint256 storedRequestId, bytes gameParams, bool settled, uint256 blockNumber)"
]);
const LUCKY_DRAW_HISTORY_FROM_BLOCK = BigInt(process.env.LUCKY_DRAW_HISTORY_FROM_BLOCK ?? "45990000");
const LUCKY_DRAW_HISTORY_CHUNK_BLOCKS = 10_000n;
const LUCKY_DRAW_HISTORY_TTL_MS = 5 * 60_000;
let luckyDrawHistoryCache: { expiresAt: number; data: LuckyDrawPublicHistory } | null = null;
const luckyDrawReadClient = createPublicClient({
  chain: base,
  transport: createPublicFirstTransport(BASE_MAINNET_BACKEND_RPC_URLS, { timeout: 10_000 })
});

export async function getLuckyDrawSummary(address: string): Promise<LuckyDrawSummary> {
  const player = normalizeAddress(address);
  const drawDay = getCurrentDrawDay();
  const [config, progress, dailyProgress, recentResults] = await Promise.all([
    getLuckyDrawConfig(),
    getLuckyDrawProgress(player),
    getLuckyDrawDailyProgress(player, drawDay),
    getLuckyDrawResults(player, 8)
  ]);
  const normalizedConfig = normalizeConfig(config);
  const roundsRequired = Math.max(1, normalizedConfig.roundsRequired);
  const availableDrawsToProve = Math.max(0, Math.floor(progress?.available_draws ?? 0));
  const earnedDrawsToProve = Math.max(0, Math.floor(progress?.lifetime_draws_earned ?? 0));
  const qualifiedRoundsToProve = Math.max(0, Math.min(roundsRequired - 1, Math.floor(progress?.qualified_rounds ?? 0)));
  const nextProgressProofTarget = Math.max(
    roundsRequired * 2,
    (availableDrawsToProve + 1) * roundsRequired + (roundsRequired - 1),
    (earnedDrawsToProve + 1) * roundsRequired + (roundsRequired - 1)
  );
  const eligibleProofs = await getEligibleProofs(player, {
    roundsRequired,
    claimedDrawsToSkip: progress?.lifetime_draws_claimed ?? 0,
    minBetEth: normalizedConfig.minBetEth,
    targetProofs: Math.max(
      roundsRequired,
      availableDrawsToProve * roundsRequired + qualifiedRoundsToProve,
      earnedDrawsToProve * roundsRequired + qualifiedRoundsToProve,
      nextProgressProofTarget
    )
  });

  return buildSummary(player, config, progress, dailyProgress, recentResults, eligibleProofs);
}

export async function getLuckyDrawCanonicalProgress(address: string): Promise<LuckyDrawCanonicalProgress> {
  const player = normalizeAddress(address);
  const [config, progress] = await Promise.all([
    getLuckyDrawConfig(),
    getLuckyDrawProgress(player)
  ]);
  const normalizedConfig = normalizeConfig(config);
  const roundsRequired = Math.max(1, normalizedConfig.roundsRequired);
  const roundCount = await getLuckyDrawRoundCount(player);
  const eligibleProofs = await getEligibleProofs(player, {
    roundsRequired,
    claimedDrawsToSkip: progress?.lifetime_draws_claimed ?? 0,
    minBetEth: normalizedConfig.minBetEth,
    targetProofs: Math.max(roundsRequired, roundCount)
  });
  const availableDraws = Math.floor(eligibleProofs.length / roundsRequired);
  const qualifiedRounds = eligibleProofs.length % roundsRequired;
  const lifetimeDrawsClaimed = Math.max(0, Math.floor(progress?.lifetime_draws_claimed ?? 0));

  return {
    player,
    roundsRequired,
    eligibleProofs: eligibleProofs.length,
    availableDraws,
    qualifiedRounds,
    lifetimeDrawsEarned: lifetimeDrawsClaimed + availableDraws,
    lifetimeDrawsClaimed,
    previous: progress
      ? {
          qualified_rounds: progress.qualified_rounds,
          available_draws: progress.available_draws,
          lifetime_draws_earned: progress.lifetime_draws_earned,
          lifetime_draws_claimed: progress.lifetime_draws_claimed
        }
      : null
  };
}

export async function claimLuckyDraw(address: string, input: unknown) {
  normalizeAddress(address);
  void input;
  throw httpError("Lucky Draw claims are now settled on-chain through the LuckyDraw contract", 410);
}

export async function getLuckyDrawPublicHistory(options: { limit?: number; offset?: number; player?: string | null } = {}): Promise<LuckyDrawPublicHistory> {
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit ?? 50)));
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const player = options.player ? normalizeAddress(options.player) : null;
  const luckyDrawAddress = CONTRACT_ADDRESSES[8453]?.LuckyDraw ?? null;
  if (!luckyDrawAddress) {
    return { updatedAt: new Date().toISOString(), chainId: 8453, contractAddress: null, limit, offset, total: 0, hasMore: false, rows: [] };
  }

  const now = Date.now();
  if (!player && luckyDrawHistoryCache && luckyDrawHistoryCache.expiresAt > now) {
    return paginateLuckyDrawHistory(luckyDrawHistoryCache.data, { limit, offset, player });
  }

  const latestBlock = await luckyDrawReadClient.getBlockNumber();
  const fromBlock = LUCKY_DRAW_HISTORY_FROM_BLOCK > latestBlock ? latestBlock : LUCKY_DRAW_HISTORY_FROM_BLOCK;
  const data = await loadLuckyDrawHistory(luckyDrawAddress, fromBlock, latestBlock, player);
  if (!player) {
    luckyDrawHistoryCache = { expiresAt: now + LUCKY_DRAW_HISTORY_TTL_MS, data };
  }
  return paginateLuckyDrawHistory(data, { limit, offset, player });
}

async function loadLuckyDrawHistory(
  luckyDrawAddress: `0x${string}`,
  fromBlock: bigint,
  latestBlock: bigint,
  player: string | null
): Promise<LuckyDrawPublicHistory> {
  const [resolvedLogs, claimedLogs] = await Promise.all([
    getLuckyDrawEventLogs(luckyDrawAddress, "DrawResolved", fromBlock, latestBlock, player),
    getLuckyDrawEventLogs(luckyDrawAddress, "PrizeClaimed", fromBlock, latestBlock, player)
  ]);
  const claimed = new Set(
    claimedLogs
      .map((log) => (log.args as { requestId?: bigint } | undefined)?.requestId)
      .filter((requestId): requestId is bigint => typeof requestId === "bigint")
      .map((requestId) => requestId.toString())
  );

  const rows = resolvedLogs
    .map((log) => {
      const args = log.args as {
        player?: string;
        requestId?: bigint;
        prizeIndex?: number | bigint;
        prizeAmount?: bigint;
      } | undefined;
      if (!args?.player || typeof args.requestId !== "bigint" || typeof args.prizeAmount !== "bigint") return null;
      const requestId = args.requestId.toString();
      return {
        player: getAddress(args.player).toLowerCase(),
        requestId,
        prizeIndex: Number(args.prizeIndex ?? 0),
        prizeAmountWei: args.prizeAmount.toString(),
        prizeAmountEth: Number(args.prizeAmount) / 1e18,
        txHash: log.transactionHash ?? "",
        status: claimed.has(requestId) ? "claimed" as const : "claimable" as const,
        blockNumber: log.blockNumber?.toString() ?? "0"
      };
    })
    .filter((row): row is LuckyDrawPublicHistory["rows"][number] => Boolean(row))
    .sort((a, b) => Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)));

  return {
    updatedAt: new Date().toISOString(),
    chainId: 8453 as const,
    contractAddress: luckyDrawAddress,
    limit: rows.length,
    offset: 0,
    total: rows.length,
    hasMore: false,
    rows
  };
}

function paginateLuckyDrawHistory(
  data: LuckyDrawPublicHistory,
  options: { limit: number; offset: number; player: string | null }
): LuckyDrawPublicHistory {
  const rows = options.player ? data.rows.filter((row) => row.player.toLowerCase() === options.player) : data.rows;
  const total = rows.length;
  const pageRows = rows.slice(options.offset, options.offset + options.limit);
  return {
    ...data,
    limit: options.limit,
    offset: options.offset,
    total,
    hasMore: options.offset + options.limit < total,
    rows: pageRows
  };
}

async function verifyPlayerClaimSignature(player: string, input: { player?: unknown; message?: unknown; signature?: unknown }) {
  if (typeof input.player !== "string" || normalizeAddress(input.player) !== player) {
    throw httpError("Player wallet mismatch", 401);
  }
  if (typeof input.message !== "string" || typeof input.signature !== "string") {
    throw httpError("Wallet signature is required", 401);
  }

  const parsed = parseSignedMessage(input.message, "lucky-draw-claim");
  if (parsed.address.toLowerCase() !== player) throw httpError("Lucky Draw message address mismatch", 401);
  if (Math.abs(Date.now() - parsed.timestamp) > 5 * 60_000) throw httpError("Lucky Draw signature expired", 401);

  const valid = await verifyMessage({
    address: player as `0x${string}`,
    message: input.message,
    signature: input.signature as `0x${string}`
  });

  if (!valid) throw httpError("Invalid Lucky Draw signature", 401);
}

export async function getLuckyDrawAdminState() {
  const { data: results, error } = await supabaseAdmin
    .from("lucky_draw_results")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw httpError(error.message, 500);

  const config = await getLuckyDrawConfig();
  return {
    config: normalizeConfig(config),
    recentResults: (results ?? []) as LuckyDrawResultRow[]
  };
}

export async function updateLuckyDrawConfig(input: unknown) {
  const body = parseConfigInput(input);
  const { error } = await supabaseAdmin
    .from("lucky_draw_config")
    .upsert(
      {
        id: 1,
        enabled: body.enabled,
        rounds_required: body.roundsRequired,
        min_bet_eth: body.minBetEth,
        daily_draw_cap: body.dailyDrawCap,
        eth_usd_reference: body.ethUsdReference,
        prize_table: body.prizes.map((prize) => ({ usd: prize.usd, weight: prize.weight })) as any,
        paused_reason: body.pausedReason || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

  if (error) throw httpError(error.message, 500);
  return getLuckyDrawAdminState();
}

export async function updateLuckyDrawResultStatus(input: unknown) {
  const body = input as { id?: unknown; status?: unknown; payoutTxHash?: unknown };
  if (typeof body.id !== "string" || !body.id) throw httpError("Result id is required", 400);
  if (body.status !== "paid" && body.status !== "voided" && body.status !== "claimable") {
    throw httpError("Invalid result status", 400);
  }

  const payoutTxHash =
    typeof body.payoutTxHash === "string" && body.payoutTxHash.trim()
      ? body.payoutTxHash.trim()
      : null;

  const { error } = await supabaseAdmin
    .from("lucky_draw_results")
    .update({
      status: body.status,
      payout_tx_hash: payoutTxHash,
      paid_at: body.status === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", body.id);

  if (error) throw httpError(error.message, 500);
  return getLuckyDrawAdminState();
}

export async function verifyAdminSignature(input: unknown, action: string) {
  const body = input as { admin?: unknown; message?: unknown; signature?: unknown };
  if (typeof body.admin !== "string" || !isAddress(body.admin)) throw httpError("Admin wallet is required", 401);
  if (typeof body.message !== "string" || typeof body.signature !== "string") throw httpError("Admin signature is required", 401);

  const admin = getAddress(body.admin).toLowerCase();
  const allowed = getAdminAddresses();
  if (!allowed.has(admin)) throw httpError("Admin wallet is not allowed", 403);

  const parsed = parseSignedMessage(body.message, action);
  if (parsed.action !== action) throw httpError("Invalid admin action", 401);
  if (parsed.address.toLowerCase() !== admin) throw httpError("Admin message address mismatch", 401);
  if (Math.abs(Date.now() - parsed.timestamp) > 5 * 60_000) throw httpError("Admin signature expired", 401);

  const valid = await verifyMessage({
    address: admin as `0x${string}`,
    message: body.message,
    signature: body.signature as `0x${string}`
  });

  if (!valid) throw httpError("Invalid admin signature", 401);
}

function parseSignedMessage(message: string, expectedAction: string) {
  const lines = message.split("\n");
  const action = lines.find((line) => line.startsWith("Action: "))?.replace("Action: ", "").trim();
  const address = lines.find((line) => line.startsWith("Address: "))?.replace("Address: ", "").trim();
  const timestampRaw = lines.find((line) => line.startsWith("Timestamp: "))?.replace("Timestamp: ", "").trim();
  const timestamp = timestampRaw ? Date.parse(timestampRaw) : Number.NaN;
  if (!action || !address || !isAddress(address) || !Number.isFinite(timestamp)) {
    throw httpError("Invalid signed message", 401);
  }
  if (action !== expectedAction) throw httpError("Invalid signed action", 401);
  return { action, address: getAddress(address), timestamp };
}

function getAdminAddresses() {
  const raw = [
    process.env.BACKEND_ADMIN_ADDRESSES,
    process.env.OWNER_ADDRESS,
    process.env.NEXT_PUBLIC_OWNER_ADDRESS,
    ...FALLBACK_ADMIN_ADDRESSES
  ]
    .filter(Boolean)
    .join(",");

  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter((item) => isAddress(item))
      .map((item) => getAddress(item).toLowerCase())
  );
}

async function getLuckyDrawConfig() {
  const { data, error } = await supabaseAdmin.from("lucky_draw_config").select("*").eq("id", 1).maybeSingle();
  if (error) throw httpError(error.message, 500);
  return (data as LuckyDrawConfigRow | null) ?? DEFAULT_CONFIG;
}

async function getLuckyDrawProgress(player: string) {
  const { data, error } = await supabaseAdmin.from("lucky_draw_progress").select("*").eq("player", player).maybeSingle();
  if (error) throw httpError(error.message, 500);
  return data as LuckyDrawProgressRow | null;
}

async function getLuckyDrawRoundCount(player: string) {
  const { count, error } = await supabaseAdmin
    .from("lucky_draw_rounds")
    .select("*", { count: "exact", head: true })
    .eq("player", player);
  if (error) throw httpError(error.message, 500);
  return count ?? 0;
}

async function getLuckyDrawDailyProgress(player: string, drawDay: string) {
  const { data, error } = await supabaseAdmin
    .from("lucky_draw_daily_progress")
    .select("*")
    .eq("player", player)
    .eq("draw_day", drawDay)
    .maybeSingle();
  if (error) throw httpError(error.message, 500);
  return data as LuckyDrawDailyProgressRow | null;
}

async function getLuckyDrawResults(player: string, limit: number) {
  const { data, error } = await supabaseAdmin
    .from("lucky_draw_results")
    .select("*")
    .eq("player", player)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw httpError(error.message, 500);
  return (data ?? []) as LuckyDrawResultRow[];
}

async function getEligibleProofs(
  player: string,
  options: { roundsRequired: number; claimedDrawsToSkip: number; minBetEth: number; targetProofs: number }
): Promise<LuckyDrawProof[]> {
  const contractByGameId = new Map(
    GAMES_REGISTRY.map((game) => [
      game.id,
      CONTRACT_ADDRESSES[8453]?.[game.contractName]
    ]).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
  const roundsRequired = Math.max(1, Math.floor(options.roundsRequired));
  const targetProofs = Math.max(roundsRequired, Math.floor(options.targetProofs));
  const offchainClaimedProofs = Math.max(0, Math.floor(options.claimedDrawsToSkip)) * roundsRequired;
  const batchSize = 200;
  const maxRows = Math.min(5_000, Math.max(500, (offchainClaimedProofs + targetProofs) * 3 + batchSize));
  const proofs: LuckyDrawProof[] = [];
  let eligibleProofs: LuckyDrawProof[] = [];

  for (let offset = 0; offset < maxRows && eligibleProofs.length < targetProofs; offset += batchSize) {
    const { data, error } = await supabaseAdmin
      .from("lucky_draw_rounds")
      .select("round_id, game_id, bet_amount, counted_at, game_rounds!inner(vrf_request_id, chain_id)")
      .eq("player", player)
      .order("counted_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) throw httpError(error.message, 500);
    const rows = (data ?? []) as Array<{
      round_id: string;
      game_id: string;
      bet_amount: number;
      game_rounds?: { vrf_request_id?: string | null; chain_id?: number | null } | Array<{ vrf_request_id?: string | null; chain_id?: number | null }>;
    }>;

    for (const row of rows) {
      if (Number(row.bet_amount) < options.minBetEth) continue;
      const joined = Array.isArray(row.game_rounds) ? row.game_rounds[0] : row.game_rounds;
      const contractAddress = contractByGameId.get(row.game_id);
      const requestId = joined?.vrf_request_id;
      if (!contractAddress || !requestId || joined?.chain_id !== 8453) continue;
      proofs.push({
        roundId: row.round_id,
        gameId: row.game_id,
        contractAddress,
        requestId
      });
    }

    const unconsumedProofs = await filterConsumedProofs(proofs, { player, minBetEth: options.minBetEth });
    eligibleProofs = unconsumedProofs.slice(offchainClaimedProofs);
    if (rows.length < batchSize) break;
  }

  return eligibleProofs;
}

async function filterConsumedProofs(proofs: LuckyDrawProof[], options: { player: string; minBetEth: number }) {
  const luckyDrawAddress = CONTRACT_ADDRESSES[8453]?.LuckyDraw;
  if (!luckyDrawAddress || proofs.length === 0) return proofs;

  try {
    const consumedChecks = await luckyDrawReadClient.multicall({
      allowFailure: true,
      contracts: proofs.map((proof) => ({
        address: luckyDrawAddress,
        abi: LUCKY_DRAW_ABI,
        functionName: "consumedRounds",
        args: [roundKey(proof)]
      }))
    });

    const unconsumedProofs = proofs.filter((_, index) => consumedChecks[index]?.status !== "success" || consumedChecks[index]?.result !== true);
    const minBetWei = parseEther(String(options.minBetEth));
    const roundChecks = await luckyDrawReadClient.multicall({
      allowFailure: true,
      contracts: unconsumedProofs.map((proof) => ({
        address: proof.contractAddress as `0x${string}`,
        abi: GAME_ROUND_READER_ABI,
        functionName: "rounds",
        args: [BigInt(proof.requestId)]
      }))
    });

    return unconsumedProofs.filter((proof, index) => {
      const check = roundChecks[index];
      if (check?.status !== "success") return false;
      const [roundPlayer, betAmount, , storedRequestId, , settled, blockNumber] = check.result;
      return (
        getAddress(roundPlayer).toLowerCase() === options.player &&
        storedRequestId === BigInt(proof.requestId) &&
        settled &&
        blockNumber > 0n &&
        betAmount >= minBetWei
      );
    });
  } catch {
    return [];
  }
}

async function getLuckyDrawEventLogs(
  address: `0x${string}`,
  eventName: "DrawResolved" | "PrizeClaimed",
  fromBlock: bigint,
  latestBlock: bigint,
  player: string | null = null
) {
  const logs: Array<{
    args?: Record<string, unknown>;
    transactionHash?: `0x${string}` | null;
    blockNumber?: bigint | null;
  }> = [];
  for (let cursor = fromBlock; cursor <= latestBlock; cursor += LUCKY_DRAW_HISTORY_CHUNK_BLOCKS + 1n) {
    const toBlock = cursor + LUCKY_DRAW_HISTORY_CHUNK_BLOCKS > latestBlock ? latestBlock : cursor + LUCKY_DRAW_HISTORY_CHUNK_BLOCKS;
    const chunk = await luckyDrawReadClient.getContractEvents({
      address,
      abi: LUCKY_DRAW_ABI,
      eventName,
      ...(player ? { args: { player: player as `0x${string}` } } : {}),
      fromBlock: cursor,
      toBlock
    });
    logs.push(...chunk);
  }
  return logs;
}

function roundKey(proof: LuckyDrawProof) {
  return keccak256(encodePacked(["address", "uint256"], [proof.contractAddress as `0x${string}`, BigInt(proof.requestId)]));
}

function buildSummary(
  player: string,
  configRow: LuckyDrawConfigRow,
  progressRow: LuckyDrawProgressRow | null,
  dailyProgressRow: LuckyDrawDailyProgressRow | null,
  recentResults: LuckyDrawResultRow[],
  eligibleProofs: LuckyDrawProof[]
): LuckyDrawSummary {
  const config = normalizeConfig(configRow);
  const drawDay = getCurrentDrawDay();
  const resetAt = getNextDrawResetAt();
  const progress = progressRow ?? {
    player,
    qualified_rounds: 0,
    available_draws: 0,
    lifetime_draws_earned: 0,
    lifetime_draws_claimed: 0,
    total_prize_eth: 0,
    updated_at: new Date(0).toISOString()
  };
  const dailyProgress = dailyProgressRow ?? {
    player,
    draw_day: drawDay,
    qualified_rounds: 0,
    earned_draws: 0,
    updated_at: new Date(0).toISOString()
  };
  const roundsRequired = Math.max(1, config.roundsRequired);
  const proofBackedDraws = Math.floor(eligibleProofs.length / roundsRequired);
  const availableDraws = proofBackedDraws;
  const proofBackedProgress = eligibleProofs.length % roundsRequired;
  const storedProgress = Math.max(0, Math.min(progress.qualified_rounds, roundsRequired - 1));
  const qualifiedRounds = availableDraws > 0
    ? proofBackedProgress
    : Math.max(proofBackedProgress, storedProgress);
  const roundsUntilNext = Math.max(0, roundsRequired - qualifiedRounds);

  return {
    player,
    onchain: {
      chainId: 8453,
      contractAddress: CONTRACT_ADDRESSES[8453]?.LuckyDraw ?? null,
      configured: Boolean(CONTRACT_ADDRESSES[8453]?.LuckyDraw)
    },
    config,
    progress: {
      qualifiedRounds,
      availableDraws,
      lifetimeDrawsEarned: progress.lifetime_draws_earned,
      lifetimeDrawsClaimed: progress.lifetime_draws_claimed,
      totalPrizeEth: Number(progress.total_prize_eth),
      roundsUntilNext,
      progressPct: Math.min(100, (qualifiedRounds / roundsRequired) * 100)
    },
    daily: {
      drawDay,
      cap: config.dailyDrawCap,
      earnedDraws: Math.max(0, Number(dailyProgress.earned_draws) || 0),
      remainingDraws: Math.max(0, config.dailyDrawCap - (Number(dailyProgress.earned_draws) || 0)),
      qualifiedRounds: Math.max(0, Number(dailyProgress.qualified_rounds) || 0),
      resetAt: resetAt.toISOString(),
      capped: (Number(dailyProgress.earned_draws) || 0) >= config.dailyDrawCap
    },
    eligibleProofs,
    recentResults
  };
}

function normalizeConfig(config: LuckyDrawConfigRow) {
  const ethUsdReference = Number(config.eth_usd_reference) || 2187;
  const prizes = parsePrizeTable(config.prize_table, ethUsdReference);
  return {
    enabled: Boolean(config.enabled),
    roundsRequired: Math.max(1, Number(config.rounds_required) || 10),
    minBetEth: Math.max(0, Number(config.min_bet_eth) || 0),
    dailyDrawCap: Math.max(1, Number(config.daily_draw_cap) || 10),
    ethUsdReference,
    pausedReason: config.paused_reason,
    updatedAt: config.updated_at,
    prizes
  };
}

function parsePrizeTable(value: unknown, ethUsdReference: number): LuckyDrawPrize[] {
  const raw = Array.isArray(value) ? value : DEFAULT_PRIZES;
  const prizes = raw
    .map((item) => {
      const record = item as { usd?: unknown; weight?: unknown };
      return {
        usd: Number(record.usd),
        weight: Math.max(0, Math.floor(Number(record.weight)))
      };
    })
    .filter((item) => Number.isFinite(item.usd) && item.usd > 0 && item.weight > 0);
  const safePrizes = prizes.length > 0 ? prizes : DEFAULT_PRIZES;
  const totalWeight = safePrizes.reduce((sum, prize) => sum + prize.weight, 0);
  return safePrizes.map((prize) => ({
    ...prize,
    eth: Number((prize.usd / ethUsdReference).toFixed(12)),
    oddsPct: totalWeight > 0 ? (prize.weight / totalWeight) * 100 : 0
  }));
}

function parseConfigInput(input: unknown) {
  const body = input as {
    enabled?: unknown;
    roundsRequired?: unknown;
    minBetEth?: unknown;
    dailyDrawCap?: unknown;
    ethUsdReference?: unknown;
    pausedReason?: unknown;
    prizes?: unknown;
  };

  const roundsRequired = Math.floor(Number(body.roundsRequired));
  const minBetEth = Number(body.minBetEth);
  const dailyDrawCap = Math.floor(Number(body.dailyDrawCap ?? 10));
  const ethUsdReference = Number(body.ethUsdReference);
  const prizes = Array.isArray(body.prizes)
    ? body.prizes
        .map((item) => {
          const record = item as { usd?: unknown; weight?: unknown };
          return { usd: Number(record.usd), weight: Math.floor(Number(record.weight)) };
        })
        .filter((item) => Number.isFinite(item.usd) && item.usd > 0 && Number.isInteger(item.weight) && item.weight > 0)
    : [];

  if (!Number.isInteger(roundsRequired) || roundsRequired < 1 || roundsRequired > 500) {
    throw httpError("roundsRequired must be between 1 and 500", 400);
  }
  if (!Number.isFinite(minBetEth) || minBetEth < 0) throw httpError("minBetEth must be a positive number", 400);
  if (!Number.isInteger(dailyDrawCap) || dailyDrawCap < 1 || dailyDrawCap > 100) {
    throw httpError("dailyDrawCap must be between 1 and 100", 400);
  }
  if (!Number.isFinite(ethUsdReference) || ethUsdReference <= 0) throw httpError("ethUsdReference must be positive", 400);
  if (prizes.length === 0 || prizes.length > 12) throw httpError("Prize table must include 1-12 positive prize rows", 400);

  return {
    enabled: Boolean(body.enabled),
    roundsRequired,
    minBetEth,
    dailyDrawCap,
    ethUsdReference,
    pausedReason: typeof body.pausedReason === "string" ? body.pausedReason.slice(0, 240) : null,
    prizes
  };
}

function getCurrentDrawDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getNextDrawResetAt(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
}

function normalizeAddress(address: string) {
  if (!isAddress(address)) throw httpError("Invalid wallet address", 400);
  return getAddress(address).toLowerCase();
}

function httpError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}
