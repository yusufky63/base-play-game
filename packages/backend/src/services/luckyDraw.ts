import { getAddress, isAddress, verifyMessage } from "viem";
import { supabaseAdmin } from "../supabase/client.js";

type LuckyDrawConfigRow = {
  id: number;
  enabled: boolean;
  rounds_required: number;
  min_bet_eth: number;
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
  config: {
    enabled: boolean;
    roundsRequired: number;
    minBetEth: number;
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
  recentResults: LuckyDrawResultRow[];
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
  min_bet_eth: 0,
  eth_usd_reference: 2300,
  prize_table: DEFAULT_PRIZES,
  paused_reason: null,
  updated_at: new Date(0).toISOString()
};

const FALLBACK_ADMIN_ADDRESSES = ["0xeaa823ab4c4ee00283d8ed7be713ddf8a5ba0fac"];

export async function getLuckyDrawSummary(address: string): Promise<LuckyDrawSummary> {
  const player = normalizeAddress(address);
  const [config, progress, recentResults] = await Promise.all([
    getLuckyDrawConfig(),
    getLuckyDrawProgress(player),
    getLuckyDrawResults(player, 8)
  ]);

  return buildSummary(player, config, progress, recentResults);
}

export async function claimLuckyDraw(address: string, input: unknown) {
  const player = normalizeAddress(address);
  const body = input as { player?: unknown; message?: unknown; signature?: unknown; clientSeed?: unknown };
  await verifyPlayerClaimSignature(player, body);
  const config = await getLuckyDrawConfig();
  if (!config.enabled) throw httpError("Lucky Draw is paused", 409);

  const { data, error } = await supabaseAdmin.rpc("fn_claim_lucky_draw", {
    p_player: player,
    p_client_seed: typeof body.clientSeed === "string" ? body.clientSeed.slice(0, 96) : null
  });

  if (error) {
    const message = error.message.includes("No Lucky Draw available") ? "No Lucky Draw available" : error.message;
    throw httpError(message, message.includes("No Lucky Draw") ? 409 : 500);
  }

  const result = data as LuckyDrawResultRow;
  return {
    status: "claimed" as const,
    result,
    summary: await getLuckyDrawSummary(player)
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
    throw httpError("Invalid admin message", 401);
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

function buildSummary(player: string, configRow: LuckyDrawConfigRow, progressRow: LuckyDrawProgressRow | null, recentResults: LuckyDrawResultRow[]): LuckyDrawSummary {
  const config = normalizeConfig(configRow);
  const progress = progressRow ?? {
    player,
    qualified_rounds: 0,
    available_draws: 0,
    lifetime_draws_earned: 0,
    lifetime_draws_claimed: 0,
    total_prize_eth: 0,
    updated_at: new Date(0).toISOString()
  };
  const roundsRequired = Math.max(1, config.roundsRequired);
  const qualifiedRounds = Math.min(progress.qualified_rounds, roundsRequired);
  const roundsUntilNext = progress.available_draws > 0 ? 0 : Math.max(0, roundsRequired - qualifiedRounds);

  return {
    player,
    config,
    progress: {
      qualifiedRounds,
      availableDraws: progress.available_draws,
      lifetimeDrawsEarned: progress.lifetime_draws_earned,
      lifetimeDrawsClaimed: progress.lifetime_draws_claimed,
      totalPrizeEth: Number(progress.total_prize_eth),
      roundsUntilNext,
      progressPct: Math.min(100, (qualifiedRounds / roundsRequired) * 100)
    },
    recentResults
  };
}

function normalizeConfig(config: LuckyDrawConfigRow) {
  const ethUsdReference = Number(config.eth_usd_reference) || 2300;
  const prizes = parsePrizeTable(config.prize_table, ethUsdReference);
  return {
    enabled: Boolean(config.enabled),
    roundsRequired: Math.max(1, Number(config.rounds_required) || 10),
    minBetEth: Math.max(0, Number(config.min_bet_eth) || 0),
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
    ethUsdReference?: unknown;
    pausedReason?: unknown;
    prizes?: unknown;
  };

  const roundsRequired = Math.floor(Number(body.roundsRequired));
  const minBetEth = Number(body.minBetEth);
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
  if (!Number.isFinite(ethUsdReference) || ethUsdReference <= 0) throw httpError("ethUsdReference must be positive", 400);
  if (prizes.length === 0 || prizes.length > 12) throw httpError("Prize table must include 1-12 positive prize rows", 400);

  return {
    enabled: Boolean(body.enabled),
    roundsRequired,
    minBetEth,
    ethUsdReference,
    pausedReason: typeof body.pausedReason === "string" ? body.pausedReason.slice(0, 240) : null,
    prizes
  };
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
