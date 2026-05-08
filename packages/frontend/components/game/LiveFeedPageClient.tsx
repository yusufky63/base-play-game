"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radio, RefreshCw } from "lucide-react";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { formatEth, shortenAddress } from "@/lib/formatters";
import { type FeedRound, useRoundPages } from "@/hooks/useRecentRounds";
import { RoundDetailDrawer } from "@/components/rounds/RoundDetailDrawer";
import { GameIdentity } from "@/components/game/GameIdentity";

export function LiveFeedPageClient({ initialGame = "all" }: { initialGame?: string }) {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState(initialGame);
  const gameFilter = selectedGame === "all" ? undefined : selectedGame;
  const feed = useRoundPages({ gameId: gameFilter, limit: 50 });
  const rows = useMemo(() => feed.data?.pages.flatMap((page) => page.rows) ?? [], [feed.data]);
  const ready = !feed.isLoading;
  const [selectedRound, setSelectedRound] = useState<FeedRound | null>(null);

  useEffect(() => {
    setSelectedGame(initialGame);
  }, [initialGame]);

  const totalVolume = useMemo(() => rows.reduce((sum, row) => sum + Number(row.bet_amount), 0), [rows]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-7 flex flex-col gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="display-heading text-4xl font-bold text-[var(--text-1)]">Live feed</h1>
          <p className="mt-2 text-sm text-[var(--text-2)]">Settled on-chain rounds, newest first.</p>
        </div>
        <div className="flex items-center gap-2">
          <Radio size={15} className="text-[var(--accent)]" />
          <select
            value={selectedGame}
            onChange={(event) => {
              const next = event.target.value;
              setSelectedGame(next);
              router.push(next === "all" ? "/live-feed" : `/live-feed?game=${next}`);
            }}
            className="app-select"
            aria-label="Filter live feed by game"
          >
            <option value="all">All games</option>
            {GAMES_REGISTRY.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void feed.refetch()}
            className="control-shell flex items-center gap-2 px-3 text-xs font-bold"
          >
            <RefreshCw size={13} className={feed.isFetching ? "animate-spin text-[var(--accent)]" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {ready ? (
          <>
            <Metric label="Rounds" value={String(rows.length)} />
            <Metric label="Volume" value={`${formatEth(totalVolume)} ETH`} />
            <Metric label="Wins" value={String(rows.filter((row) => row.won).length)} />
          </>
        ) : (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        )}
      </div>

      <section className="panel overflow-hidden">
        <div className="grid grid-cols-[1fr_80px] gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs font-semibold uppercase text-[var(--text-3)] md:grid-cols-[110px_1fr_120px_120px_90px]">
          <span>Game</span>
          <span>Player</span>
          <span className="hidden text-right md:block">Bet</span>
          <span className="hidden text-right md:block">Payout</span>
          <span className="text-right">Result</span>
        </div>
        {!ready && Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1fr_80px] gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0 md:grid-cols-[110px_1fr_120px_120px_90px]">
            <span className="feed-skeleton h-4 w-20" />
            <span className="feed-skeleton h-4 w-full" />
            <span className="ml-auto hidden feed-skeleton h-4 w-20 md:block" />
            <span className="ml-auto hidden feed-skeleton h-4 w-20 md:block" />
            <span className="ml-auto feed-skeleton h-4 w-14" />
          </div>
        ))}
        {ready && rows.map((row) => (
          <div
            key={row.id}
            className="live-feed-page-row grid cursor-pointer grid-cols-[1fr_80px] gap-3 border-b border-[var(--border)] px-4 py-4 text-sm last:border-b-0 md:grid-cols-[110px_1fr_120px_120px_90px]"
            role="button"
            tabIndex={0}
            onClick={() => setSelectedRound(row)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedRound(row);
              }
            }}
          >
            <GameIdentity gameId={row.game_id} size="xs" className="game-identity-feed" />
            <Link href={`/profile/${row.player}`} onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()} className="min-w-0 truncate font-mono text-[var(--text-2)] hover:text-[var(--accent)]">
              {shortenAddress(row.player)}
            </Link>
            <span className="hidden text-right font-mono text-[var(--text-2)] md:block">{formatEth(row.bet_amount)} ETH</span>
            <span className="hidden text-right font-mono text-[var(--text-2)] md:block">{formatEth(row.payout)} ETH</span>
            <span className={`text-right font-mono ${row.won ? "text-[var(--win)]" : "text-[var(--lose)]"}`}>
              {row.won ? "Win" : "Loss"}
            </span>
          </div>
        ))}
        {ready && feed.hasNextPage && (
          <div className="border-t border-[var(--border)] p-4 text-center">
            <button
              type="button"
              onClick={() => void feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
              className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold disabled:opacity-50"
            >
              {feed.isFetchingNextPage ? "Loading..." : "Load older"}
            </button>
          </div>
        )}
        {ready && rows.length === 0 && <div className="px-4 py-10 text-center text-sm text-[var(--text-3)]">No settled rounds yet.</div>}
      </section>
      <RoundDetailDrawer round={selectedRound} open={Boolean(selectedRound)} onClose={() => setSelectedRound(null)} />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="text-[10px] font-semibold uppercase text-[var(--text-3)]">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold text-[var(--text-1)]">{value}</div>
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="panel p-4">
      <div className="feed-skeleton h-3 w-16" />
      <div className="mt-2 feed-skeleton h-4 w-24" />
    </div>
  );
}
