import { NextResponse } from "next/server";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { env } from "@/lib/env";

type Leader = Database["public"]["Views"]["leaderboard_weekly_ranked"]["Row"];
type SortMode = "xp" | "volume";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const CACHE_TTL_SECONDS = 30 * 60;
const CACHE_CONTROL = `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${3 * 60 * 60}`;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sort = normalizeSort(url.searchParams.get("sort"));
  const page = normalizeInteger(url.searchParams.get("page"), 0, 0, 200);
  const pageSize = normalizeInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const weekStart = url.searchParams.get("weekStart") || getWeekStart();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { leaders: [], hasMore: false, source: "unconfigured", cachedAt: new Date().toISOString(), cacheTtlSeconds: CACHE_TTL_SECONDS },
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const orderColumn = sort === "xp" ? "xp_rank" : "total_wagered";
  const params = new URLSearchParams({
    select: "*",
    week_start: `eq.${weekStart}`,
    order: `${orderColumn}.${sort === "xp" ? "asc" : "desc"}`,
    offset: String(from),
    limit: String(pageSize)
  });

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/leaderboard_weekly_ranked?${params.toString()}`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`
    },
    next: { revalidate: CACHE_TTL_SECONDS }
  });

  if (!response.ok) {
    return NextResponse.json(
      { leaders: [], hasMore: false, source: "supabase", cachedAt: new Date().toISOString(), cacheTtlSeconds: CACHE_TTL_SECONDS },
      { status: 200, headers: { "Cache-Control": CACHE_CONTROL } }
    );
  }

  const rows = (await response.json()) as Leader[];
  return NextResponse.json(
    {
      leaders: rows,
      hasMore: rows.length === pageSize,
      source: "supabase",
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
