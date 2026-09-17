"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Flame, Sparkles, Trophy } from "lucide-react";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { formatEth, formatUsd } from "@/lib/formatters";
import { readSessionCache, writeSessionCache } from "@/lib/clientCache";

type Leader = Database["public"]["Views"]["leaderboard_weekly_ranked"]["Row"];
type SortMode = "xp" | "volume";
type ScopeMode = "weekly" | "allTime";
type LeaderboardSource = "supabase" | "unconfigured";
const PAGE_SIZE = 50;
const WEEKLY_CACHE_TTL = 30 * 60_000;
const ALL_TIME_CACHE_TTL = 3 * 60 * 60_000;
// Bump when the cached shape changes so stale lists from older sessions are ignored.
const CACHE_VERSION = "v2";
type LeaderboardCache = {
  leaders: Leader[];
  hasMore: boolean;
  source: LeaderboardSource;
  scope: ScopeMode;
  weekStart: string | null;
  currentWeekStart: string | null;
};
type LeaderboardResponse = LeaderboardCache & { cachedAt: string; cacheTtlSeconds: number };

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<LeaderboardSource>("unconfigured");
  const [scope, setScope] = useState<ScopeMode>("weekly");
  const [sort, setSort] = useState<SortMode>("xp");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(null);
  // The week shown by page 0; later pages are pinned to it so "Load more" never mixes weeks.
  const pinnedWeekRef = useRef<string | null>(null);
  const ethUsd = useEthUsdPrice();

  useEffect(() => {
    const cacheKey = `baseplay:leaderboard:${CACHE_VERSION}:${scope}:${sort}:page:${page}`;
    const cached = readSessionCache<LeaderboardCache>(cacheKey, getClientCacheTtl(scope));
    if (cached) {
      setLeaders(cached.leaders);
      setHasMore(cached.hasMore);
      setSource(cached.source);
      setWeekStart(cached.weekStart ?? null);
      setCurrentWeekStart(cached.currentWeekStart ?? null);
      pinnedWeekRef.current = scope === "weekly" ? cached.weekStart ?? null : null;
      setReady(true);
      return;
    }

    setReady(false);

    async function load() {
      try {
        const params = new URLSearchParams({ scope, sort, page: String(page), pageSize: String(PAGE_SIZE) });
        if (scope === "weekly" && page > 0 && pinnedWeekRef.current) {
          params.set("weekStart", pinnedWeekRef.current);
        }
        const response = await fetch(`/api/leaderboard?${params.toString()}`, { cache: "force-cache" });
        if (!response.ok) throw new Error(`Leaderboard HTTP ${response.status}`);
        const result = (await response.json()) as LeaderboardResponse;
        const resultWeekStart = result.weekStart ?? null;
        const resultCurrentWeekStart = result.currentWeekStart ?? null;
        setLeaders((current) => {
          const next = mergeLeaders(page === 0 ? [] : current, result.leaders);
          writeSessionCache(cacheKey, {
            leaders: next,
            hasMore: result.hasMore,
            source: result.source,
            scope: result.scope,
            weekStart: resultWeekStart,
            currentWeekStart: resultCurrentWeekStart
          });
          return next;
        });
        setHasMore(result.hasMore);
        setSource(result.source);
        setWeekStart(resultWeekStart);
        setCurrentWeekStart(resultCurrentWeekStart);
        pinnedWeekRef.current = scope === "weekly" ? resultWeekStart : null;
      } catch (error) {
        console.warn("[BasePlay] Leaderboard API query failed", error);
        setHasMore(false);
        setLeaders((current) => {
          const next = page === 0 ? [] : current;
          writeSessionCache(cacheKey, { leaders: next, hasMore: false, source: "unconfigured", scope, weekStart: null, currentWeekStart: null });
          return next;
        });
        setSource("unconfigured");
        setWeekStart(null);
        setCurrentWeekStart(null);
      }
      setReady(true);
    }

    void load();
  }, [page, scope, sort]);

  function changeScope(nextScope: ScopeMode) {
    setScope(nextScope);
    setPage(0);
    setLeaders([]);
    pinnedWeekRef.current = null;
  }

  function changeSort(nextSort: SortMode) {
    setSort(nextSort);
    setPage(0);
    setLeaders([]);
    pinnedWeekRef.current = null;
  }

  const showingOlderWeek = scope === "weekly" && Boolean(weekStart) && Boolean(currentWeekStart) && weekStart !== currentWeekStart;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-7 flex flex-col gap-3 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--border-2)] bg-[var(--accent-light)] text-[var(--accent)]">
            <Trophy size={22} />
          </div>
          <div>
            <h1 className="display-heading text-3xl font-bold text-[var(--text-1)]">Leaderboard</h1>
            <p className="mt-1 text-sm text-[var(--text-2)]">Weekly and all-time XP and wager volume rankings. Top rows load first; larger seasons are paginated.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented-control">
            <button type="button" onClick={() => changeScope("weekly")} className={scope === "weekly" ? "segmented-active" : ""}>
              <CalendarDays size={13} />
              Weekly
            </button>
            <button type="button" onClick={() => changeScope("allTime")} className={scope === "allTime" ? "segmented-active" : ""}>
              <Trophy size={13} />
              All-time
            </button>
          </div>
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
        {ready && scope === "weekly" && weekStart && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] px-3 py-2 font-mono sm:px-3.5 md:px-4 text-[11px] text-[var(--text-3)]">
            <span className="flex items-center gap-1">
              <CalendarDays size={12} />
              Week of {formatWeekStart(weekStart)}
            </span>
            {showingOlderWeek && (
              <span className="text-[var(--pending)]">No settled rounds this week yet. Showing the latest active week.</span>
            )}
          </div>
        )}
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
            key={`${leader.week_start}-${leader.player}`}
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

function getClientCacheTtl(scope: ScopeMode) {
  return scope === "allTime" ? ALL_TIME_CACHE_TTL : WEEKLY_CACHE_TTL;
}

/**
 * Appends a page of rows while keeping one row per wallet (compared case-insensitively). This guards
 * against overlapping pages and double-invoked effects producing duplicate rows.
 */
function mergeLeaders(current: Leader[], incoming: Leader[]) {
  const seen = new Set(current.map((row) => row.player.toLowerCase()));
  const next = [...current];

  for (const row of incoming) {
    const key = row.player.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(row);
  }

  return next;
}

function formatWeekStart(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
