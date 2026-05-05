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
    staleTime: 90_000,
    gcTime: 10 * 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false
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
  const supabase = getSupabaseBrowser();

  if (supabase) {
    const [{ data: platform, error: platformError }, { data: rawGameRows, error: gameRowsError }] = await Promise.all([
      supabase.from("platform_stats").select("*").eq("id", 1).maybeSingle(),
      supabase.from("game_stats").select("game_id,total_rounds").eq("chain_id", 84532)
    ]);

    if (platformError || gameRowsError) {
      console.warn("[BasePlay] Supabase global stats query failed", platformError?.message ?? gameRowsError?.message);
      return EMPTY_GLOBAL_STATS;
    }

    const gameRows = (rawGameRows ?? []) as GameStatRow[];

    if (platform) {
      return {
        plays: platform.total_rounds,
        players: platform.total_players,
        volume: Number(platform.total_wagered),
        gameCounts: Object.fromEntries(gameRows.map((row) => [row.game_id, row.total_rounds]))
      };
    }

    const { data, error } = await supabase.from("game_rounds").select("player, bet_amount, game_id").limit(1000);
    if (error) {
      console.warn("[BasePlay] Supabase round stats fallback failed", error.message);
      return EMPTY_GLOBAL_STATS;
    }
    return statsFromRows(data ?? []);
  }

  const rows = await fetchRecentOnchainRounds({ limit: 500 });
  return statsFromRows(rows);
}

function statsFromRows(rows: Array<Pick<Round, "player" | "bet_amount" | "game_id">>) {
  const gameCounts = rows.reduce<Record<string, number>>((acc, row) => {
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
