"use client";

import { useQuery } from "@tanstack/react-query";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { getSupabaseBrowser } from "@/lib/supabase";
import { fetchRecentOnchainRounds } from "@/lib/onchainRounds";
import { calculateRoundXp, currentDailyStreak, levelFromXp } from "@/lib/progression";

type PlayerStats = Database["public"]["Tables"]["player_stats"]["Row"];
type PlayerGameStats = Database["public"]["Tables"]["player_game_stats"]["Row"];
type RankedLeader = Database["public"]["Views"]["leaderboard_weekly_ranked"]["Row"];

export interface PlayerProfileData {
  stats: PlayerStats;
  gameStats: PlayerGameStats[];
  weekly: RankedLeader | null;
  wins: number;
  losses: number;
  source: "supabase" | "onchain";
}

export function usePlayerProfile(address?: string | null) {
  return useQuery({
    queryKey: ["player-profile", address?.toLowerCase() ?? "none"],
    queryFn: () => fetchPlayerProfile(address!),
    enabled: Boolean(address),
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    refetchInterval: 90_000,
    refetchIntervalInBackground: false
  });
}

async function fetchPlayerProfile(address: string): Promise<PlayerProfileData> {
  const player = address.toLowerCase();
  const supabase = getSupabaseBrowser();

  if (supabase) {
    const [{ data: stats, error: statsError }, { data: gameStats, error: gameStatsError }, { data: weekly, error: weeklyError }] = await Promise.all([
      supabase.from("player_stats").select("*").eq("player", player).maybeSingle(),
      supabase.from("player_game_stats").select("*").eq("player", player).order("total_rounds", { ascending: false }),
      supabase.from("leaderboard_weekly_ranked").select("*").eq("player", player).order("week_start", { ascending: false }).limit(1).maybeSingle()
    ]);

    if (statsError || gameStatsError || weeklyError) {
      console.warn("[BasePlay] Supabase profile query failed", statsError?.message ?? gameStatsError?.message ?? weeklyError?.message);
    }

    if (stats) {
      const games = (gameStats ?? []) as PlayerGameStats[];
      const weeklyRow = (weekly ?? null) as RankedLeader | null;
      return {
        stats,
        gameStats: games,
        weekly: weeklyRow,
        wins: games.reduce((sum, row) => sum + row.wins, 0),
        losses: games.reduce((sum, row) => sum + row.losses, 0),
        source: "supabase"
      };
    }

    return emptySupabaseProfile(player);
  }

  const rows = (await fetchRecentOnchainRounds({ limit: 500, player })).filter((row) => row.player.toLowerCase() === player);
  const lifetime_xp = rows.reduce((sum, row) => sum + calculateRoundXp(row.bet_amount, row.won), 0);
  const total_wagered = rows.reduce((sum, row) => sum + row.bet_amount, 0);
  const total_payout = rows.reduce((sum, row) => sum + row.payout, 0);
  const wins = rows.filter((row) => row.won).length;
  const losses = rows.length - wins;
  const streak = currentDailyStreak(rows.map((row) => row.settled_at));
  const gameMap = new Map<string, PlayerGameStats>();

  for (const row of rows) {
    const key = `${row.game_id}:${row.chain_id}`;
    const current =
      gameMap.get(key) ??
      {
        player,
        game_id: row.game_id,
        chain_id: row.chain_id,
        total_rounds: 0,
        wins: 0,
        losses: 0,
        total_wagered: 0,
        total_payout: 0,
        net_profit: 0,
        biggest_win: 0,
        last_played_at: row.settled_at,
        updated_at: new Date().toISOString()
      };

    current.total_rounds += 1;
    current.wins += row.won ? 1 : 0;
    current.losses += row.won ? 0 : 1;
    current.total_wagered += row.bet_amount;
    current.total_payout += row.payout;
    current.net_profit += row.payout - row.bet_amount;
    current.biggest_win = Math.max(current.biggest_win, row.payout);
    current.last_played_at = row.settled_at > current.last_played_at ? row.settled_at : current.last_played_at;
    gameMap.set(key, current);
  }

  return {
    stats: {
      player,
      lifetime_xp,
      level: levelFromXp(lifetime_xp),
      current_streak: streak,
      longest_streak: streak,
      last_played_on: rows[0]?.settled_at.slice(0, 10) ?? null,
      total_rounds: rows.length,
      total_wagered,
      net_profit: total_payout - total_wagered,
      biggest_win: rows.reduce((max, row) => Math.max(max, row.payout), 0),
      updated_at: new Date().toISOString()
    },
    gameStats: Array.from(gameMap.values()).sort((a, b) => b.total_rounds - a.total_rounds),
    weekly: null,
    wins,
    losses,
    source: "onchain"
  };
}

function emptySupabaseProfile(player: string): PlayerProfileData {
  return {
    stats: {
      player,
      lifetime_xp: 0,
      level: 1,
      current_streak: 0,
      longest_streak: 0,
      last_played_on: null,
      total_rounds: 0,
      total_wagered: 0,
      net_profit: 0,
      biggest_win: 0,
      updated_at: new Date().toISOString()
    },
    gameStats: [],
    weekly: null,
    wins: 0,
    losses: 0,
    source: "supabase"
  };
}
