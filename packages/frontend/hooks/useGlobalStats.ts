"use client";

import { useQuery } from "@tanstack/react-query";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { getSupabaseBrowser } from "@/lib/supabase";
import { fetchRecentOnchainRounds } from "@/lib/onchainRounds";

type Round = Database["public"]["Tables"]["game_rounds"]["Row"];
type GameStatRow = Pick<Database["public"]["Tables"]["game_stats"]["Row"], "game_id" | "total_rounds">;

export interface GlobalStats {
  plays: number;
  players: number;
  volume: number;
  gameCounts: Record<string, number>;
  cachedAt?: string;
  cacheTtlSeconds?: number;
}

const EMPTY_GLOBAL_STATS: GlobalStats = {
  plays: 0,
  players: 0,
  volume: 0,
  gameCounts: {}
};

export function useGlobalStats() {
  return useQuery({
    queryKey: ["global-stats"],
    queryFn: fetchGlobalStats,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false
  });
}

export function useGameStats() {
  const query = useGlobalStats();
  return {
    ...query,
    gameCounts: query.data?.gameCounts ?? {}
  };
}

async function fetchGlobalStats(): Promise<GlobalStats> {
  try {
    const response = await fetch("/api/global-stats", { cache: "force-cache" });
    if (response.ok) return (await response.json()) as GlobalStats;
  } catch {
    // Fall back to direct Supabase/browser RPC below for local-only setups.
  }

  const supabase = getSupabaseBrowser();

  if (supabase) {
    const [{ data: platform, error: platformError }, { data: rawGameRows, error: gameRowsError }] = await Promise.all([
      supabase.from("platform_stats").select("*").eq("id", 1).maybeSingle(),
      supabase.from("game_stats").select("game_id,total_rounds")
    ]);

    if (platformError || gameRowsError) {
      console.warn("[BasePlay] Supabase global stats query failed", platformError?.message ?? gameRowsError?.message);
      return EMPTY_GLOBAL_STATS;
    }

    const gameRows = (rawGameRows ?? []) as GameStatRow[];
    const gameCounts = gameCountsFromRows(gameRows);

    if (platform && platform.total_rounds > 0) {
      return {
        plays: platform.total_rounds,
        players: platform.total_players,
        volume: Number(platform.total_wagered),
        gameCounts
      };
    }

    const { data, error } = await supabase.from("game_rounds").select("player, bet_amount, game_id").limit(1000);
    if (error) {
      console.warn("[BasePlay] Supabase round stats fallback failed", error.message);
      return EMPTY_GLOBAL_STATS;
    }
    return statsFromRows(data ?? [], gameCounts);
  }

  const rows = await fetchRecentOnchainRounds({ limit: 500 });
  return statsFromRows(rows);
}

function gameCountsFromRows(rows: GameStatRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.game_id] = (acc[row.game_id] ?? 0) + row.total_rounds;
    return acc;
  }, {});
}

function statsFromRows(rows: Array<Pick<Round, "player" | "bet_amount" | "game_id">>, cachedGameCounts: Record<string, number> = {}) {
  const gameCounts =
    Object.keys(cachedGameCounts).length > 0
      ? cachedGameCounts
      : rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.game_id] = (acc[row.game_id] ?? 0) + 1;
          return acc;
        }, {});

  return {
    plays: rows.length,
    players: new Set(rows.map((row) => row.player.toLowerCase())).size,
    volume: rows.reduce((sum, row) => sum + Number(row.bet_amount), 0),
    gameCounts
  };
}
