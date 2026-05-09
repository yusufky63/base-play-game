import { NextResponse } from "next/server";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { env } from "@/lib/env";

type PlatformStats = Database["public"]["Tables"]["platform_stats"]["Row"];
type GameStatRow = Pick<Database["public"]["Tables"]["game_stats"]["Row"], "game_id" | "total_rounds">;
type RoundStatRow = Pick<Database["public"]["Tables"]["game_rounds"]["Row"], "player" | "bet_amount" | "game_id">;

const CACHE_TTL_SECONDS = 10 * 60;
const STALE_WHILE_REVALIDATE_SECONDS = 60;
const CACHE_CONTROL = `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !apiKey) {
    return NextResponse.json(emptyResponse(), { headers: { "Cache-Control": CACHE_CONTROL } });
  }

  const headers = {
    apikey: apiKey,
    authorization: `Bearer ${apiKey}`
  };
  const baseUrl = supabaseUrl.replace(/\/$/, "");

  try {
    const [platformResponse, gameResponse] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/platform_stats?select=*&id=eq.1&limit=1`, { headers, cache: "no-store" }),
      fetch(`${baseUrl}/rest/v1/game_stats?select=game_id,total_rounds`, { headers, cache: "no-store" })
    ]);

    const platformRows = platformResponse.ok ? ((await platformResponse.json()) as PlatformStats[]) : [];
    const gameRows = gameResponse.ok ? ((await gameResponse.json()) as GameStatRow[]) : [];
    const platform = platformRows[0] ?? null;
    const gameCounts = gameCountsFromRows(gameRows);

    if (platform && platform.total_rounds > 0) {
      return NextResponse.json(
        withCacheMetadata({
          plays: platform.total_rounds,
          players: platform.total_players,
          volume: Number(platform.total_wagered),
          gameCounts
        }),
        { headers: { "Cache-Control": CACHE_CONTROL } }
      );
    }

    const roundResponse = await fetch(`${baseUrl}/rest/v1/game_rounds?select=player,bet_amount,game_id&limit=10000`, {
      headers,
      cache: "no-store"
    });
    if (!roundResponse.ok) throw new Error("Supabase round stats fallback failed");
    const roundRows = (await roundResponse.json()) as RoundStatRow[];

    return NextResponse.json(withCacheMetadata(statsFromRoundRows(roundRows, gameCounts)), { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch {
    return NextResponse.json(emptyResponse(), { headers: { "Cache-Control": CACHE_CONTROL } });
  }
}

function withCacheMetadata(stats: Omit<ReturnType<typeof emptyResponse>, "cachedAt" | "cacheTtlSeconds">) {
  return {
    ...stats,
    cachedAt: new Date().toISOString(),
    cacheTtlSeconds: CACHE_TTL_SECONDS
  };
}

function gameCountsFromRows(rows: GameStatRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.game_id] = (counts[row.game_id] ?? 0) + row.total_rounds;
    return counts;
  }, {});
}

function statsFromRoundRows(rows: RoundStatRow[], gameCounts: Record<string, number>) {
  const fallbackGameCounts = Object.keys(gameCounts).length > 0 ? gameCounts : gameCountsFromRoundRows(rows);
  return {
    plays: rows.length,
    players: new Set(rows.map((row) => row.player.toLowerCase())).size,
    volume: rows.reduce((sum, row) => sum + Number(row.bet_amount), 0),
    gameCounts: fallbackGameCounts
  };
}

function gameCountsFromRoundRows(rows: RoundStatRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.game_id] = (counts[row.game_id] ?? 0) + 1;
    return counts;
  }, {});
}

function emptyResponse() {
  return {
    plays: 0,
    players: 0,
    volume: 0,
    gameCounts: {},
    cachedAt: new Date().toISOString(),
    cacheTtlSeconds: CACHE_TTL_SECONDS
  };
}
