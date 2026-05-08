"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Sparkles, Trophy } from "lucide-react";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { formatEth, formatUsd } from "@/lib/formatters";
import { readSessionCache, writeSessionCache } from "@/lib/clientCache";

type Leader = Database["public"]["Views"]["leaderboard_weekly_ranked"]["Row"];
type SortMode = "xp" | "volume";
const PAGE_SIZE = 50;
const CACHE_TTL = 30 * 60_000;
type LeaderboardCache = { leaders: Leader[]; hasMore: boolean; source: "supabase" | "unconfigured" };
type LeaderboardResponse = LeaderboardCache & { cachedAt: string; cacheTtlSeconds: number };

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<"supabase" | "unconfigured">("unconfigured");
  const [sort, setSort] = useState<SortMode>("xp");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const ethUsd = useEthUsdPrice();

  useEffect(() => {
    const cacheKey = `baseplay:leaderboard:${sort}:page:${page}`;
    const cached = readSessionCache<LeaderboardCache>(cacheKey, CACHE_TTL);
    if (cached) {
      setLeaders(cached.leaders);
      setHasMore(cached.hasMore);
      setSource(cached.source);
      setReady(true);
      return;
    }

    setReady(false);

    async function load() {
      try {
        const response = await fetch(`/api/leaderboard?sort=${sort}&page=${page}&pageSize=${PAGE_SIZE}`, { cache: "force-cache" });
        if (!response.ok) throw new Error(`Leaderboard HTTP ${response.status}`);
        const result = (await response.json()) as LeaderboardResponse;
        setLeaders((current) => {
          const next = page === 0 ? result.leaders : [...current, ...result.leaders];
          writeSessionCache(cacheKey, { leaders: next, hasMore: result.hasMore, source: result.source });
          return next;
        });
        setHasMore(result.hasMore);
        setSource(result.source);
      } catch (error) {
        console.warn("[BasePlay] Leaderboard API query failed", error);
        setHasMore(false);
        setLeaders((current) => {
          const next = page === 0 ? [] : current;
          writeSessionCache(cacheKey, { leaders: next, hasMore: false, source: "unconfigured" });
          return next;
        });
        setSource("unconfigured");
      }
      setReady(true);
    }

    void load();
  }, [page, sort]);

  function changeSort(nextSort: SortMode) {
    setSort(nextSort);
    setPage(0);
    setLeaders([]);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-7 flex flex-col gap-3 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--border-2)] bg-[var(--accent-light)] text-[var(--accent)]">
            <Trophy size={22} />
          </div>
          <div>
            <h1 className="display-heading text-3xl font-bold text-[var(--text-1)]">Leaderboard</h1>
            <p className="mt-1 text-sm text-[var(--text-2)]">Weekly XP and wager volume rankings. Top rows load first; larger seasons are paginated.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented-control">
            <button type="button" onClick={() => changeSort("xp")} className={sort === "xp" ? "segmented-active" : ""}>
              <Sparkles size={13} />
              XP
            </button>
            <button type="button" onClick={() => changeSort("volume")} className={sort === "volume" ? "segmented-active" : ""}>
              <Trophy size={13} />
              Volume
            </button>
          </div>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="leaderboard-row leaderboard-row-head">
          <span>Rank</span>
          <span>Player</span>
          <span className="hidden text-right md:block">Level</span>
          <span className="text-right">XP</span>
          <span className="hidden text-right sm:block">Games</span>
          <span className="text-right">Volume</span>
          <span className="hidden text-right md:block">Profit</span>
        </div>
        {!ready && Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="leaderboard-row border-b border-[var(--border)] last:border-b-0"
          >
            <span className="feed-skeleton h-4 w-6" />
            <span className="feed-skeleton h-4 w-44" />
            <span className="ml-auto hidden feed-skeleton h-4 w-12 md:block" />
            <span className="ml-auto feed-skeleton h-4 w-12" />
            <span className="ml-auto hidden feed-skeleton h-4 w-12 sm:block" />
            <span className="ml-auto feed-skeleton h-4 w-16" />
            <span className="ml-auto hidden feed-skeleton h-4 w-20 md:block" />
          </div>
        ))}
        {ready && leaders.map((leader, index) => (
          <div
            key={`${leader.player}-${leader.week_start}`}
            className="leaderboard-row border-b border-[var(--border)] text-sm transition-colors last:border-b-0 hover:bg-[var(--surface-2)]"
          >
            <span className="font-mono text-[var(--text-3)]">
              {source === "supabase" && sort === "xp" ? leader.xp_rank : index + 1}
            </span>
            <Link href={`/profile/${leader.player}`} className="min-w-0 hover:text-[var(--accent)]">
              <span className="block truncate font-mono text-[var(--text-1)]">
                <BasenameLabel address={leader.player as `0x${string}`} />
              </span>
              <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-[var(--text-3)]">
                <Flame size={11} className="text-[var(--pending)]" />
                {leader.current_streak}d streak
              </span>
            </Link>
            <span className="hidden text-right font-mono text-[var(--text-2)] md:block">Lv {leader.level}</span>
            <span className="text-right font-mono font-semibold text-[var(--accent)]">{leader.xp}</span>
            <span className="hidden text-right font-mono text-[var(--text-2)] sm:block">{leader.game_count}</span>
            <span className="text-right font-mono text-[var(--text-2)]">
              {formatEth(leader.total_wagered)} ETH
              {ethUsd && <span className="mt-1 block text-[10px] text-[var(--text-3)]">{formatUsd(leader.total_wagered * ethUsd)}</span>}
            </span>
            <span className={`hidden text-right font-mono md:block ${leader.net_profit >= 0 ? "text-[var(--win)]" : "text-[var(--lose)]"}`}>
              {leader.net_profit >= 0 ? "+" : ""}
              {formatEth(leader.net_profit)} ETH
              {ethUsd && <span className="mt-1 block text-[10px] text-[var(--text-3)]">{formatUsd(leader.net_profit * ethUsd)}</span>}
            </span>
          </div>
        ))}
        {ready && hasMore && (
          <div className="border-t border-[var(--border)] p-4 text-center">
            <button type="button" onClick={() => setPage((value) => value + 1)} className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold">
              Load more
            </button>
          </div>
        )}
        {ready && leaders.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-3)]">
            No settled rounds yet.
          </div>
        )}
      </section>
    </main>
  );
}
