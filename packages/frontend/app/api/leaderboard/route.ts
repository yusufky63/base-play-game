import { NextResponse } from "next/server";
import type { Database } from "@baseplay/shared/types/supabase.types";

type Leader = Database["public"]["Views"]["leaderboard_weekly_ranked"]["Row"];
type SortMode = "xp" | "volume";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const CACHE_TTL_SECONDS = 30 * 60;
const CACHE_CONTROL = `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${3 * 60 * 60}`;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sort = normalizeSort(url.searchParams.get("sort"));
    const page = normalizeInteger(url.searchParams.get("page"), 0, 0, 200);
    const pageSize = normalizeInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const weekStart = url.searchParams.get("weekStart") || getWeekStart();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !apiKey) {
      return leaderboardResponse([], false, "unconfigured");
    }

    const from = page * pageSize;
    const headers = {
      apikey: apiKey,
      authorization: `Bearer ${apiKey}`
    };
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    const rows = await fetchLeaderboardRows({ baseUrl, headers, sort, pageSize, offset: from, weekStart });

    if (rows.length > 0 || url.searchParams.has("weekStart")) {
      return leaderboardResponse(rows, rows.length === pageSize, "supabase");
    }

    const latestRows = await fetchLeaderboardRows({ baseUrl, headers, sort, pageSize, offset: from });
    return leaderboardResponse(latestRows, latestRows.length === pageSize, "supabase");
  } catch {
    return leaderboardResponse([], false, "supabase");
  }
}

async function fetchLeaderboardRows({
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
    next: { revalidate: CACHE_TTL_SECONDS }
  });

  if (!response.ok) return [];
  return (await response.json()) as Leader[];
}

function leaderboardResponse(leaders: Leader[], hasMore: boolean, source: "supabase" | "unconfigured") {
  return NextResponse.json(
    {
      leaders,
      hasMore,
      source,
      cachedAt: new Date().toISOString(),
      cacheTtlSeconds: CACHE_TTL_SECONDS
    },
    { headers: { "Cache-Control": CACHE_CONTROL } }
  );
}

function normalizeSort(value: string | null): SortMode {
  return value === "volume" ? "volume" : "xp";
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
