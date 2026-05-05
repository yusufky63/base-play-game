"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Sparkles, Trophy } from "lucide-react";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { getSupabaseBrowser } from "@/lib/supabase";
import { formatEth, formatUsd } from "@/lib/formatters";
import { fetchRecentOnchainRounds } from "@/lib/onchainRounds";
import { calculateRoundXp, currentDailyStreak, levelFromXp } from "@/lib/progression";
import { readSessionCache, writeSessionCache } from "@/lib/clientCache";

type Leader = Database["public"]["Views"]["leaderboard_weekly_ranked"]["Row"];
type SortMode = "xp" | "profit";
const PAGE_SIZE = 50;
const CACHE_TTL = 90_000;
type LeaderboardCache = { leaders: Leader[]; hasMore: boolean; source: "supabase" | "onchain" };

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<"supabase" | "onchain">("onchain");
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
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      loadOnchainLeaders(sort).then((rows) => {
        const next = rows.slice(0, (page + 1) * PAGE_SIZE);
        const nextHasMore = rows.length > (page + 1) * PAGE_SIZE;
        setLeaders(next);
        setHasMore(nextHasMore);
        setSource("onchain");
        writeSessionCache(cacheKey, { leaders: next, hasMore: nextHasMore, source: "onchain" });
      }).finally(() => setReady(true));
      return;
    }

    async function load() {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const weekStart = getWeekStart();
      const { data, error } = await supabase
        .from("leaderboard_weekly_ranked")
        .select("*")
        .eq("week_start", weekStart)
        .order(sort === "xp" ? "xp_rank" : "profit_rank", { ascending: true })
        .range(from, to);

      if (error) {
        console.warn("[BasePlay] Supabase leaderboard query failed", error.message);
        setLeaders(page === 0 ? [] : leaders);
        setHasMore(false);
        setSource("supabase");
        writeSessionCache(cacheKey, { leaders: page === 0 ? [] : leaders, hasMore: false, source: "supabase" });
      } else if (data) {
        const rows = data as Leader[];
        const next = page === 0 ? rows : [...leaders, ...rows];
        setLeaders(next);
        setHasMore(rows.length === PAGE_SIZE);
        setSource("supabase");
        writeSessionCache(cacheKey, { leaders: next, hasMore: rows.length === PAGE_SIZE, source: "supabase" });
      } else {
        const rows = await loadOnchainLeaders(sort);
        const next = rows.slice(0, (page + 1) * PAGE_SIZE);
        const nextHasMore = rows.length > (page + 1) * PAGE_SIZE;
        setLeaders(next);
        setHasMore(nextHasMore);
        setSource("onchain");
        writeSessionCache(cacheKey, { leaders: next, hasMore: nextHasMore, source: "onchain" });
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
            <p className="mt-1 text-sm text-[var(--text-2)]">Weekly XP and net profit rankings. Top rows load first; larger seasons are paginated.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented-control">
            <button type="button" onClick={() => changeSort("xp")} className={sort === "xp" ? "segmented-active" : ""}>
              <Sparkles size={13} />
              XP
            </button>
            <button type="button" onClick={() => changeSort("profit")} className={sort === "profit" ? "segmented-active" : ""}>
              <Trophy size={13} />
              Profit
            </button>
          </div>
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="grid grid-cols-[48px_1fr_64px_72px_72px] gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs font-semibold uppercase text-[var(--text-3)] md:grid-cols-[48px_1fr_76px_90px_76px_120px_120px]">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Level</span>
          <span className="text-right">XP</span>
          <span className="text-right">Games</span>
          <span className="hidden text-right md:block">Volume</span>
          <span className="hidden text-right md:block">Profit</span>
        </div>
        {!ready && Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[48px_1fr_64px_72px_72px] gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[48px_1fr_76px_90px_76px_120px_120px]"
          >
            <span className="feed-skeleton h-4 w-6" />
            <span className="feed-skeleton h-4 w-44" />
            <span className="ml-auto feed-skeleton h-4 w-12" />
            <span className="ml-auto feed-skeleton h-4 w-12" />
            <span className="ml-auto feed-skeleton h-4 w-12" />
            <span className="ml-auto hidden feed-skeleton h-4 w-20 md:block" />
            <span className="ml-auto hidden feed-skeleton h-4 w-20 md:block" />
          </div>
        ))}
        {ready && leaders.map((leader, index) => (
          <div
            key={`${leader.player}-${leader.week_start}`}
            className="grid grid-cols-[48px_1fr_64px_72px_72px] gap-3 border-b border-[var(--border)] px-4 py-4 text-sm transition-colors last:border-b-0 hover:bg-[var(--surface-2)] md:grid-cols-[48px_1fr_76px_90px_76px_120px_120px]"
          >
            <span className="font-mono text-[var(--text-3)]">
              {source === "supabase" ? (sort === "xp" ? leader.xp_rank : leader.profit_rank) : index + 1}
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
            <span className="text-right font-mono text-[var(--text-2)]">Lv {leader.level}</span>
            <span className="text-right font-mono font-semibold text-[var(--accent)]">{leader.xp}</span>
            <span className="text-right font-mono text-[var(--text-2)]">{leader.game_count}</span>
            <span className="hidden text-right font-mono text-[var(--text-2)] md:block">
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

async function loadOnchainLeaders(sort: SortMode): Promise<Leader[]> {
  const rounds = await fetchRecentOnchainRounds({ limit: 250 });
  const grouped = new Map<string, Pick<Leader, "player" | "game_count" | "total_wagered" | "net_profit" | "biggest_win" | "xp" | "current_streak"> & { dates: string[] }>();

  for (const round of rounds) {
    const key = round.player.toLowerCase();
    const current =
      grouped.get(key) ??
      {
        player: key,
        game_count: 0,
        total_wagered: 0,
        net_profit: 0,
        biggest_win: 0,
        xp: 0,
        current_streak: 0,
        dates: []
      };

    current.game_count += 1;
    current.total_wagered += round.bet_amount;
    current.net_profit += round.payout - round.bet_amount;
    current.biggest_win = Math.max(current.biggest_win, round.payout);
    current.xp += calculateRoundXp(round.bet_amount, round.won);
    current.dates.push(round.settled_at);
    current.current_streak = currentDailyStreak(current.dates);
    grouped.set(key, current);
  }

  const weekStart = getWeekStart();
  return Array.from(grouped.values())
    .sort((a, b) => sort === "xp" ? b.xp - a.xp || b.net_profit - a.net_profit : b.net_profit - a.net_profit || b.biggest_win - a.biggest_win)
    .map((leader) => ({
      id: `${leader.player}-${weekStart}`,
      week_start: weekStart,
      updated_at: new Date().toISOString(),
      level: levelFromXp(leader.xp),
      xp_rank: 0,
      profit_rank: 0,
      ...leader
    }))
    .map((leader, index) => ({
      ...leader,
      xp_rank: sort === "xp" ? index + 1 : leader.xp_rank,
      profit_rank: sort === "profit" ? index + 1 : leader.profit_rank
    }));
}

function getWeekStart() {
  const date = new Date();
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}
