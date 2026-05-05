"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [ready, setReady] = useState(false);
  const player = useMemo(() => address?.toLowerCase() ?? null, [address]);

  useEffect(() => {
    if (!player) {
      setProgress(null);
      setReady(true);
      return;
    }

    let mounted = true;
    const playerAddress = player;
    setReady(false);

    async function load() {
      const supabase = getSupabaseBrowser();
      if (supabase) {
        const { data } = await supabase.from("player_stats").select("*").eq("player", playerAddress).maybeSingle();
        if (mounted) {
          setProgress(data ? fromStats(data) : emptyProgress(playerAddress));
          setReady(true);
        }
        return;
      }

      const rows = await fetchRecentOnchainRounds({ limit: 250 });
      const playerRows = rows.filter((row) => row.player.toLowerCase() === playerAddress);
      const lifetime_xp = playerRows.reduce((sum, row) => sum + calculateRoundXp(row.bet_amount, row.won), 0);
      const total_wagered = playerRows.reduce((sum, row) => sum + row.bet_amount, 0);
      const net_profit = playerRows.reduce((sum, row) => sum + row.payout - row.bet_amount, 0);
      const longest = currentDailyStreak(playerRows.map((row) => row.settled_at));

      if (mounted) {
        setProgress({
          player: playerAddress,
          lifetime_xp,
          level: levelFromXp(lifetime_xp),
          current_streak: longest,
          longest_streak: longest,
          total_rounds: playerRows.length,
          total_wagered,
          net_profit
        });
        setReady(true);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [player]);

  return { progress, ready };
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
