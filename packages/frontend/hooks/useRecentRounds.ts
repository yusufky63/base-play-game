"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { getSupabaseBrowser } from "@/lib/supabase";
import { fetchRecentOnchainRounds, type OnchainRound } from "@/lib/onchainRounds";

type Round = Database["public"]["Tables"]["game_rounds"]["Row"];
export type FeedRound = Round | OnchainRound;
export type RoundSource = "supabase" | "onchain";

export interface RoundPage {
  rows: FeedRound[];
  source: RoundSource;
  hasMore: boolean;
  nextCursor: string | null;
}

export async function fetchRoundPage({
  limit = 20,
  gameId,
  player,
  before,
  winsOnly = false
}: {
  limit?: number;
  gameId?: string;
  player?: string;
  before?: string;
  winsOnly?: boolean;
} = {}): Promise<RoundPage> {
  const supabase = getSupabaseBrowser();
  const normalizedPlayer = player?.toLowerCase();

  if (supabase) {
    let query = supabase
      .from("game_rounds")
      .select("*")
      .order("settled_at", { ascending: false })
      .limit(limit);

    if (gameId) query = query.eq("game_id", gameId);
    if (normalizedPlayer) query = query.eq("player", normalizedPlayer);
    if (before) query = query.lt("settled_at", before);
    if (winsOnly) query = query.eq("won", true);

    const { data, error } = await query;
    if (!error) {
      return makePage(data ?? [], "supabase", limit);
    }

    console.warn("[BasePlay] Supabase feed query failed", error.message);
    return makePage([], "supabase", limit);
  }

  const rows = await fetchRecentOnchainRounds({ limit, gameId, player: normalizedPlayer, before, winsOnly });
  return makePage(rows, "onchain", limit);
}

export function useRecentRounds({ gameId, limit = 8, winsOnly = false }: { gameId?: string; limit?: number; winsOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["recent-rounds", gameId ?? "all", limit, winsOnly ? "wins" : "all"],
    queryFn: () => fetchRoundPage({ gameId, limit, winsOnly }),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false
  });
}

export function useRoundPages({ gameId, player, limit = 50, winsOnly = false }: { gameId?: string; player?: string; limit?: number; winsOnly?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["round-pages", gameId ?? "all", player?.toLowerCase() ?? "all", limit, winsOnly ? "wins" : "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchRoundPage({ gameId, player, limit, before: pageParam, winsOnly }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false
  });
}

function makePage(rows: FeedRound[], source: RoundSource, limit: number): RoundPage {
  const nextCursor = rows.length > 0 ? rows[rows.length - 1]?.settled_at ?? null : null;
  return {
    rows,
    source,
    hasMore: rows.length === limit && Boolean(nextCursor),
    nextCursor
  };
}
