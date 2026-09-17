import { NextResponse } from "next/server";
import type { Database } from "@baseplay/shared/types/supabase.types";

type WeeklyLeader = Database["public"]["Views"]["leaderboard_weekly_ranked"]["Row"];
type PlayerStat = Pick<
  Database["public"]["Tables"]["player_stats"]["Row"],
  "player" | "total_rounds" | "total_wagered" | "net_profit" | "biggest_win" | "lifetime_xp" | "level" | "current_streak" | "updated_at"
>;
type Leader = WeeklyLeader;
type SortMode = "xp" | "volume";
type ScopeMode = "weekly" | "allTime";
type LeaderboardSource = "supabase" | "unconfigured";
type SupabaseRest = { baseUrl: string; headers: Record<string, string> };
type LeaderboardPayload = {
  leaders: Leader[];
  hasMore: boolean;
  source: LeaderboardSource;
  scope: ScopeMode;
  /** The single week being shown ("all-time" for the all-time scope, null when nothing is available). */
  weekStart: string | null;
  /** The current UTC week (Monday) so the UI can tell when it is showing an older week. */
  currentWeekStart: string;
  cacheTtlSeconds: number;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const WEEKLY_CACHE_TTL_SECONDS = 30 * 60;
const ALL_TIME_CACHE_TTL_SECONDS = 3 * 60 * 60;
const ALL_TIME_WEEK_KEY = "all-time";
const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const currentWeekStart = getCurrentWeekStart();

  try {
    const url = new URL(request.url);
    const sort = normalizeSort(url.searchParams.get("sort"));
    const scope = normalizeScope(url.searchParams.get("scope"));
    const page = normalizeInteger(url.searchParams.get("page"), 0, 0, 200);
    const pageSize = normalizeInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const cacheTtlSeconds = getCacheTtlSeconds(scope);
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !apiKey) {
      return leaderboardResponse({ leaders: [], hasMore: false, source: "unconfigured", scope, weekStart: null, currentWeekStart, cacheTtlSeconds });
    }

    const rest: SupabaseRest = {
      baseUrl: supabaseUrl.replace(/\/$/, ""),
      headers: {
        apikey: apiKey,
        authorization: `Bearer ${apiKey}`
      }
    };
    const offset = page * pageSize;

    if (scope === "allTime") {
      const rows = await fetchAllTimeRows(rest, { sort, pageSize, offset });
      return leaderboardResponse({
        leaders: dedupeByPlayer(rows),
        hasMore: rows.length === pageSize,
        source: "supabase",
        scope,
        weekStart: ALL_TIME_WEEK_KEY,
        currentWeekStart,
        cacheTtlSeconds
      });
    }

    // Weekly rankings always cover exactly one week. When the caller does not pin a week we use the
    // latest week that has settled rounds, so an empty current week never falls back to a multi-week
    // list where the same player appears once per week.
    const weekStart = normalizeWeekStart(url.searchParams.get("weekStart")) ?? (await resolveLatestWeekStart(rest));

    if (!weekStart) {
      return leaderboardResponse({ leaders: [], hasMore: false, source: "supabase", scope, weekStart: null, currentWeekStart, cacheTtlSeconds });
    }

    const rows = await fetchWeeklyRows(rest, { sort, pageSize, offset, weekStart });
    return leaderboardResponse({
      leaders: dedupeByPlayer(rows),
      hasMore: rows.length === pageSize,
      source: "supabase",
      scope,
      weekStart,
      currentWeekStart,
      cacheTtlSeconds
    });
  } catch {
    return leaderboardResponse({
      leaders: [],
      hasMore: false,
      source: "supabase",
      scope: "weekly",
      weekStart: null,
      currentWeekStart,
      cacheTtlSeconds: WEEKLY_CACHE_TTL_SECONDS
    });
  }
}

async function resolveLatestWeekStart({ baseUrl, headers }: SupabaseRest) {
  const params = new URLSearchParams({
    select: "week_start",
    order: "week_start.desc",
    limit: "1"
  });

  const response = await fetch(`${baseUrl}/rest/v1/leaderboard_weekly_ranked?${params.toString()}`, {
    headers,
    next: { revalidate: WEEKLY_CACHE_TTL_SECONDS }
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as Array<Pick<WeeklyLeader, "week_start">>;
  return normalizeWeekStart(rows[0]?.week_start ?? null);
}

async function fetchWeeklyRows(
  { baseUrl, headers }: SupabaseRest,
  { sort, pageSize, offset, weekStart }: { sort: SortMode; pageSize: number; offset: number; weekStart: string }
) {
  // Every order ends with the unique player column so offset pagination stays stable across pages.
  const order = sort === "xp" ? "xp_rank.asc,player.asc" : "total_wagered.desc,net_profit.desc,player.asc";
  const params = new URLSearchParams({
    select: "*",
    week_start: `eq.${weekStart}`,
    order,
    offset: String(offset),
    limit: String(pageSize)
  });

  const response = await fetch(`${baseUrl}/rest/v1/leaderboard_weekly_ranked?${params.toString()}`, {
    headers,
    next: { revalidate: WEEKLY_CACHE_TTL_SECONDS }
  });

  if (!response.ok) return [];
  return (await response.json()) as Leader[];
}

async function fetchAllTimeRows(
  { baseUrl, headers }: SupabaseRest,
  { sort, pageSize, offset }: { sort: SortMode; pageSize: number; offset: number }
) {
  const orderColumn = sort === "xp" ? "lifetime_xp" : "total_wagered";
  const params = new URLSearchParams({
    select: "player,total_rounds,total_wagered,net_profit,biggest_win,lifetime_xp,level,current_streak,updated_at",
    order: `${orderColumn}.desc,net_profit.desc,player.asc`,
    offset: String(offset),
    limit: String(pageSize)
  });

  const response = await fetch(`${baseUrl}/rest/v1/player_stats?${params.toString()}`, {
    headers,
    next: { revalidate: ALL_TIME_CACHE_TTL_SECONDS }
  });

  if (!response.ok) return [];
  const rows = (await response.json()) as PlayerStat[];
  return rows.map((row, index) => ({
    id: row.player,
    player: row.player,
    week_start: ALL_TIME_WEEK_KEY,
    game_count: row.total_rounds,
    total_wagered: row.total_wagered,
    net_profit: row.net_profit,
    biggest_win: row.biggest_win,
    updated_at: row.updated_at,
    xp: row.lifetime_xp,
    level: row.level,
    current_streak: row.current_streak,
    xp_rank: offset + index + 1,
    profit_rank: offset + index + 1
  })) satisfies Leader[];
}

/**
 * Defensive de-duplication: wallet addresses are stored lowercase, but if a differently cased copy of
 * the same wallet ever reaches the tables we still list each wallet only once and keep the first
 * (highest ranked) row.
 */
function dedupeByPlayer(rows: Leader[]) {
  const seen = new Set<string>();
  const unique: Leader[] = [];

  for (const row of rows) {
    const player = String(row.player ?? "").toLowerCase();
    if (!player || seen.has(player)) continue;
    seen.add(player);
    unique.push({ ...row, player });
  }

  return unique;
}

function leaderboardResponse(payload: LeaderboardPayload) {
  return NextResponse.json(
    {
      ...payload,
      cachedAt: new Date().toISOString()
    },
    { headers: { "Cache-Control": `public, s-maxage=${payload.cacheTtlSeconds}, stale-while-revalidate=${3 * 60 * 60}` } }
  );
}

function normalizeSort(value: string | null): SortMode {
  return value === "volume" ? "volume" : "xp";
}

function normalizeScope(value: string | null): ScopeMode {
  return value === "allTime" ? "allTime" : "weekly";
}

function normalizeWeekStart(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return WEEK_START_PATTERN.test(trimmed) ? trimmed : null;
}

function getCacheTtlSeconds(scope: ScopeMode) {
  return scope === "allTime" ? ALL_TIME_CACHE_TTL_SECONDS : WEEKLY_CACHE_TTL_SECONDS;
}

function normalizeInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Monday of the current UTC week, matching date_trunc('week', settled_at) in Supabase. */
function getCurrentWeekStart() {
  const date = new Date();
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}
