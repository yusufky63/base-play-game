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

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const WEEKLY_CACHE_TTL_SECONDS = 30 * 60;
const ALL_TIME_CACHE_TTL_SECONDS = 3 * 60 * 60;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sort = normalizeSort(url.searchParams.get("sort"));
    const scope = normalizeScope(url.searchParams.get("scope"));
    const page = normalizeInteger(url.searchParams.get("page"), 0, 0, 200);
    const pageSize = normalizeInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const weekStart = url.searchParams.get("weekStart") || getWeekStart();
    const cacheTtlSeconds = getCacheTtlSeconds(scope);
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !apiKey) {
      return leaderboardResponse([], false, "unconfigured", scope, cacheTtlSeconds);
    }

    const from = page * pageSize;
    const headers = {
      apikey: apiKey,
      authorization: `Bearer ${apiKey}`
    };
    const baseUrl = supabaseUrl.replace(/\/$/, "");

    if (scope === "allTime") {
      const rows = await fetchAllTimeRows({ baseUrl, headers, sort, pageSize, offset: from });
      return leaderboardResponse(rows, rows.length === pageSize, "supabase", scope, cacheTtlSeconds);
    }

    const rows = await fetchWeeklyRows({ baseUrl, headers, sort, pageSize, offset: from, weekStart });

    if (rows.length > 0 || url.searchParams.has("weekStart")) {
      return leaderboardResponse(rows, rows.length === pageSize, "supabase", scope, cacheTtlSeconds);
    }

    const latestRows = await fetchWeeklyRows({ baseUrl, headers, sort, pageSize, offset: from });
    return leaderboardResponse(latestRows, latestRows.length === pageSize, "supabase", scope, cacheTtlSeconds);
  } catch {
    return leaderboardResponse([], false, "supabase", "weekly", WEEKLY_CACHE_TTL_SECONDS);
  }
}

async function fetchWeeklyRows({
  baseUrl,
  headers,
  sort,
  pageSize,
  offset,
  weekStart
}: {
  baseUrl: string;
  headers: Record<string, string>;
  sort: SortMode;
  pageSize: number;
  offset: number;
  weekStart?: string;
}) {
  const orderColumn = sort === "xp" ? "xp_rank" : "total_wagered";
  const params = new URLSearchParams({
    select: "*",
    order: `${orderColumn}.${sort === "xp" ? "asc" : "desc"}`,
    offset: String(offset),
    limit: String(pageSize)
  });

  if (weekStart) {
    params.set("week_start", `eq.${weekStart}`);
  } else {
    params.set("order", `week_start.desc,${orderColumn}.${sort === "xp" ? "asc" : "desc"}`);
  }

  const response = await fetch(`${baseUrl}/rest/v1/leaderboard_weekly_ranked?${params.toString()}`, {
    headers,
    next: { revalidate: WEEKLY_CACHE_TTL_SECONDS }
  });

  if (!response.ok) return [];
  return (await response.json()) as Leader[];
}

async function fetchAllTimeRows({
  baseUrl,
  headers,
  sort,
  pageSize,
  offset
}: {
  baseUrl: string;
  headers: Record<string, string>;
  sort: SortMode;
  pageSize: number;
  offset: number;
}) {
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
    week_start: "all-time",
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

function leaderboardResponse(leaders: Leader[], hasMore: boolean, source: "supabase" | "unconfigured", scope: ScopeMode, cacheTtlSeconds: number) {
  return NextResponse.json(
    {
      leaders,
      hasMore,
      source,
      scope,
      cachedAt: new Date().toISOString(),
      cacheTtlSeconds
    },
    { headers: { "Cache-Control": `public, s-maxage=${cacheTtlSeconds}, stale-while-revalidate=${3 * 60 * 60}` } }
  );
}

function normalizeSort(value: string | null): SortMode {
  return value === "volume" ? "volume" : "xp";
}

function normalizeScope(value: string | null): ScopeMode {
  return value === "allTime" ? "allTime" : "weekly";
}

function getCacheTtlSeconds(scope: ScopeMode) {
  return scope === "allTime" ? ALL_TIME_CACHE_TTL_SECONDS : WEEKLY_CACHE_TTL_SECONDS;
}

function normalizeInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getWeekStart() {
  const date = new Date();
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}
