"use client";

import Link from "next/link";
import { AlertTriangle, Clock3, ExternalLink, RefreshCw, RotateCcw } from "lucide-react";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { useClaimPendingRound, usePendingRounds, type PendingRound } from "@/hooks/usePendingRounds";

export function PendingRoundsPanel({ compact = false }: { compact?: boolean }) {
  const pending = usePendingRounds();
  const refund = useClaimPendingRound();
  const rows = pending.data ?? [];

  if (compact && rows.length === 0) return null;

  return (
    <section className={compact ? "rounded-md border border-[var(--border)] bg-[var(--surface)] p-3" : "panel overflow-hidden"}>
      <div className={compact ? "mb-2 flex items-center justify-between gap-3" : "flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3"}>
        <div className="flex items-center gap-2 font-bold text-[var(--text-1)]">
          <Clock3 size={15} className={rows.length ? "text-[var(--pending)]" : "text-[var(--text-3)]"} />
          {compact ? "Pending / refunds" : "Pending rounds and refunds"}
        </div>
        <button
          type="button"
          onClick={() => void pending.refetch()}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--accent)]"
          aria-label="Refresh pending rounds"
          title="Refresh pending rounds"
        >
          <RefreshCw size={13} className={pending.isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      <div className={compact ? "grid gap-2" : "divide-y divide-[var(--border)]"}>
        {pending.isLoading && <EmptyPending compact={compact} text="Checking active rounds on-chain..." />}
        {!pending.isLoading && rows.length === 0 && (
          <EmptyPending
            compact={compact}
            text={compact ? "No unresolved rounds." : "No unresolved rounds for this wallet. If a VRF round times out, it appears here again after reconnecting or reopening the app."}
          />
        )}
        {rows.map((round) => (
          <PendingRoundRow
            key={`${round.chainId}-${round.contractAddress}-${round.requestId}`}
            round={round}
            compact={compact}
            claimDisabled={refund.isPending || !round.refundAvailable}
            onClaim={() => void refund.claim(round).then(() => pending.refetch())}
          />
        ))}
      </div>
    </section>
  );
}

function PendingRoundRow({
  round,
  compact,
  claimDisabled,
  onClaim
}: {
  round: PendingRound;
  compact: boolean;
  claimDisabled: boolean;
  onClaim: () => void;
}) {
  const network = getNetworkByChainId(round.chainId);
  const explorer = network?.blockExplorer;
  const requestLabel = `${round.requestId.slice(0, 8)}...${round.requestId.slice(-6)}`;
  const statusText = round.refundAvailable ? "Refund ready" : `${round.blocksRemaining.toString()} blocks left`;

  return (
    <div className={compact ? "rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3" : "grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto] md:items-center"}>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {round.refundAvailable ? <AlertTriangle size={14} className="text-[var(--pending)]" /> : <Clock3 size={14} className="text-[var(--accent)]" />}
          <Link href={round.gamePath} className="truncate font-bold text-[var(--text-1)] hover:text-[var(--accent)]">
            {round.gameName}
          </Link>
          <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[var(--text-3)]">
            {round.networkName}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--text-3)]">
          <span>{round.betAmountEth} ETH bet</span>
          <span>request {requestLabel}</span>
          <span>refund after block {round.eligibleBlock.toString()}</span>
          {explorer && (
            <a href={`${explorer}/address/${round.contractAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--accent)]">
              contract <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      <div className={compact ? "mt-3 grid gap-2" : "flex items-center gap-2 md:justify-end"}>
        <span className={`rounded-md border px-2.5 py-2 text-center font-mono text-[10px] font-bold ${round.refundAvailable ? "border-[var(--pending)] text-[var(--pending)]" : "border-[var(--border)] text-[var(--text-2)]"}`}>
          {statusText}
        </span>
        <button
          type="button"
          disabled={claimDisabled}
          onClick={onClaim}
          className="primary-action inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RotateCcw size={13} />
          Claim refund
        </button>
      </div>
    </div>
  );
}

function EmptyPending({ compact, text }: { compact: boolean; text: string }) {
  return (
    <div className={compact ? "text-xs leading-5 text-[var(--text-3)]" : "px-4 py-5 text-sm leading-6 text-[var(--text-3)]"}>
      {text}
    </div>
  );
}
