"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { getSupabaseBrowser } from "@/lib/supabase";
import { fetchRecentOnchainRounds } from "@/lib/onchainRounds";
import { calculateRoundXp, currentDailyStreak, levelFromXp } from "@/lib/progression";

type PlayerStats = Database["public"]["Tables"]["player_stats"]["Row"];

export interface PlayerProgress {
  player: string;
  lifetime_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  total_rounds: number;
  total_wagered: number;
  net_profit: number;
}

export function usePlayerProgress() {
  const { address } = useAccount();
  const player = useMemo(() => address?.toLowerCase() ?? null, [address]);
  const query = useQuery({
    queryKey: ["player-progress", player ?? "none"],
    queryFn: () => fetchPlayerProgress(player!),
    enabled: Boolean(player),
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false
  });

  if (!player) return { progress: null, ready: true };
  return { progress: query.data ?? null, ready: !query.isLoading };
}

async function fetchPlayerProgress(playerAddress: string): Promise<PlayerProgress> {
  const supabase = getSupabaseBrowser();
  if (supabase) {
    const { data } = await supabase.from("player_stats").select("*").eq("player", playerAddress).maybeSingle();
    return data ? fromStats(data) : emptyProgress(playerAddress);
  }

  const rows = await fetchRecentOnchainRounds({ limit: 250 });
  const playerRows = rows.filter((row) => row.player.toLowerCase() === playerAddress);
  const lifetime_xp = playerRows.reduce((sum, row) => sum + calculateRoundXp(row.bet_amount, row.won), 0);
  const total_wagered = playerRows.reduce((sum, row) => sum + row.bet_amount, 0);
  const net_profit = playerRows.reduce((sum, row) => sum + row.payout - row.bet_amount, 0);
  const longest = currentDailyStreak(playerRows.map((row) => row.settled_at));

  return {
    player: playerAddress,
    lifetime_xp,
    level: levelFromXp(lifetime_xp),
    current_streak: longest,
    longest_streak: longest,
    total_rounds: playerRows.length,
    total_wagered,
    net_profit
  };
}

function fromStats(stats: PlayerStats): PlayerProgress {
  return {
    player: stats.player,
    lifetime_xp: stats.lifetime_xp,
    level: stats.level,
    current_streak: stats.current_streak,
    longest_streak: stats.longest_streak,
    total_rounds: stats.total_rounds,
    total_wagered: stats.total_wagered,
    net_profit: stats.net_profit
  };
}

function emptyProgress(player: string): PlayerProgress {
  return {
    player,
    lifetime_xp: 0,
    level: 1,
    current_streak: 0,
    longest_streak: 0,
    total_rounds: 0,
    total_wagered: 0,
    net_profit: 0
  };
}
