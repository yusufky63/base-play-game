"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Radio } from "lucide-react";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { formatEth, formatUsd } from "@/lib/formatters";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { type FeedRound, useRecentRounds } from "@/hooks/useRecentRounds";
import { RoundDetailDrawer } from "@/components/rounds/RoundDetailDrawer";
import { GameIdentity } from "@/components/game/GameIdentity";

interface LiveFeedProps {
  gameId?: string;
  title?: string;
  limit?: number;
  compact?: boolean;
  showAllLink?: boolean;
}

export function LiveFeed({ gameId, title = "Live feed", limit = 8, compact = false, showAllLink = false }: LiveFeedProps) {
  const { data, isLoading } = useRecentRounds({ gameId, limit, winsOnly: compact });
  const rows = compact ? (data?.rows ?? []).filter((row) => row.won) : (data?.rows ?? []);
  const ready = !isLoading;
  const ethUsd = useEthUsdPrice(!compact);
  const [selectedRound, setSelectedRound] = useState<FeedRound | null>(null);

  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-4 text-xs">
        <div className="live-feed-compact-label flex shrink-0 items-center gap-2 border-r border-[var(--border)] pr-4">
          <span className="live-feed-compact-title font-mono text-[11px] font-semibold uppercase text-[var(--text-1)]">Live feed</span>
          <span className="h-2 w-2 rounded-full bg-[var(--win)]" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          {!ready ? (
            <div className="flex items-center gap-3">
              <span className="feed-skeleton h-4 w-36" />
              <span className="feed-skeleton h-4 w-44" />
              <span className="feed-skeleton hidden h-4 w-32 sm:block" />
            </div>
          ) : rows.length > 0 ? (
            <div className="live-feed-track flex min-w-max items-center gap-4">
              {rows.slice(0, limit).map((row) => (
                <FeedChip key={row.id} row={row} />
              ))}
            </div>
          ) : (
            ready && <span className="text-[var(--text-3)]">No settled rounds yet</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="panel game-feed-panel p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display-heading text-sm font-bold text-[var(--text-1)]">{title}</h2>
        <div className="flex items-center gap-2">
          {showAllLink && (
            <Link href={gameId ? `/live-feed?game=${gameId}` : "/live-feed"} aria-label="Open feed page" className="feed-link-button">
              <ArrowUpRight size={15} strokeWidth={2.25} />
            </Link>
          )}
          <Radio size={14} className="text-[var(--accent)]" />
        </div>
      </div>
      <div className="space-y-2">
        {!ready && Array.from({ length: Math.min(limit, 5) }).map((_, index) => (
          <div key={index} className="feed-row grid grid-cols-[1fr_auto] gap-3 px-3 py-2.5">
            <div>
              <span className="feed-skeleton h-4 w-36" />
              <span className="feed-skeleton mt-2 h-3 w-48" />
            </div>
            <span className="feed-skeleton h-4 w-20" />
          </div>
        ))}
        {ready && rows.map((row) => (
          <FeedRow key={row.id} row={row} ethUsd={ethUsd} onSelect={() => setSelectedRound(row)} />
        ))}
        {ready && rows.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--text-3)]">
            No settled rounds yet.
          </div>
        )}
      </div>
      <RoundDetailDrawer round={selectedRound} open={Boolean(selectedRound)} onClose={() => setSelectedRound(null)} />
    </section>
  );
}

function FeedRow({ row, ethUsd, onSelect }: { row: FeedRound; ethUsd: number | null; onSelect: () => void }) {
  const Icon = row.won ? ArrowUpRight : ArrowDownRight;
  const net = Number(row.payout) - Number(row.bet_amount);

  return (
    <div
      className="feed-row grid cursor-pointer grid-cols-[1fr_auto] gap-3 px-3 py-2.5"
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="min-w-0">
        <div className="font-mono text-xs font-semibold text-[var(--text-1)]">
          <Link href={`/profile/${row.player}`} onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}>
            <BasenameLabel address={row.player as `0x${string}`} />
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-3)]">
          <GameIdentity gameId={row.game_id} size="xs" className="game-identity-feed" />
          <ResultBadge won={row.won} />
        </div>
      </div>
      <div className={`flex items-center gap-1 font-mono text-xs ${row.won ? "text-[var(--win)]" : "text-[var(--lose)]"}`}>
        <Icon size={13} />
        <span>
          {net >= 0 ? "+" : ""}
          {formatEth(net)} ETH
          {ethUsd && <span className="block text-right text-[10px] text-[var(--text-3)]">{formatUsd(net * ethUsd)}</span>}
        </span>
      </div>
    </div>
  );
}

function FeedChip({ row }: { row: FeedRound }) {
  const net = Number(row.payout) - Number(row.bet_amount);
  return (
    <span className="feed-chip inline-flex items-center gap-2 font-mono text-[11px] text-[var(--text-2)]">
      <ResultBadge won={row.won} compact />
      <GameIdentity gameId={row.game_id} size="xs" className="game-identity-feed-chip" />
      <Link href={`/profile/${row.player}`} className="hidden text-[var(--text-3)] sm:inline">
        <BasenameLabel address={row.player as `0x${string}`} />
      </Link>
      <span className={row.won ? "text-[var(--win)]" : "text-[var(--lose)]"}>
        {net >= 0 ? "+" : ""}
        {formatEth(net)}
      </span>
    </span>
  );
}

function ResultBadge({ won, compact = false }: { won: boolean; compact?: boolean }) {
  return (
    <span className={`result-badge ${won ? "result-badge-win" : "result-badge-loss"} ${compact ? "result-badge-compact" : ""}`}>
      {won ? "WIN" : "LOSS"}
    </span>
  );
}
