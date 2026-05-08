import { NextResponse } from "next/server";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { env, defaultChainId } from "@/lib/env";

type PlatformStats = Database["public"]["Tables"]["platform_stats"]["Row"];
type GameStatRow = Pick<Database["public"]["Tables"]["game_stats"]["Row"], "game_id" | "total_rounds">;

const CACHE_TTL_SECONDS = 10 * 60;
const CACHE_CONTROL = `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${60 * 60}`;

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(emptyResponse(), { headers: { "Cache-Control": CACHE_CONTROL } });
  }

  const headers = {
    apikey: anonKey,
    authorization: `Bearer ${anonKey}`
  };
  const baseUrl = supabaseUrl.replace(/\/$/, "");

  try {
    const [platformResponse, gameResponse] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/platform_stats?select=*&id=eq.1&limit=1`, { headers, next: { revalidate: CACHE_TTL_SECONDS } }),
      fetch(`${baseUrl}/rest/v1/game_stats?select=game_id,total_rounds&chain_id=eq.${defaultChainId}`, { headers, next: { revalidate: CACHE_TTL_SECONDS } })
    ]);
    if (!platformResponse.ok || !gameResponse.ok) throw new Error("Supabase stats query failed");

    const platformRows = (await platformResponse.json()) as PlatformStats[];
    const gameRows = (await gameResponse.json()) as GameStatRow[];
    const platform = platformRows[0] ?? null;

    return NextResponse.json(
      platform
        ? {
            plays: platform.total_rounds,
            players: platform.total_players,
            volume: Number(platform.total_wagered),
            gameCounts: Object.fromEntries(gameRows.map((row) => [row.game_id, row.total_rounds])),
            cachedAt: new Date().toISOString(),
            cacheTtlSeconds: CACHE_TTL_SECONDS
          }
        : emptyResponse(),
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch {
    return NextResponse.json(emptyResponse(), { headers: { "Cache-Control": CACHE_CONTROL } });
  }
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
