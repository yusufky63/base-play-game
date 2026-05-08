"use client";

import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatEth, shortenAddress } from "@/lib/formatters";
import {
  eventLabel,
  fetchRoundDetails,
  getAddressExplorerUrl,
  getRoundPath,
  getTxExplorerUrl,
  type RoundDetails
} from "@/lib/roundDetails";
import type { FeedRound } from "@/hooks/useRecentRounds";
import { GameIdentity, getGameLabel } from "@/components/game/GameIdentity";

export function RoundDetailDrawer({
  round,
  open,
  onClose
}: {
  round: FeedRound | null;
  open: boolean;
  onClose: () => void;
}) {
  const requestId = round?.vrf_request_id ?? null;
  const chainId = round?.chain_id ?? 0;
  const details = useQuery({
    queryKey: ["round-details", chainId, requestId],
    queryFn: () => fetchRoundDetails({ chainId, requestId, seedRound: round }),
    enabled: open && Boolean(round),
    staleTime: 30 * 60_000,
    gcTime: 3 * 60 * 60_000,
    refetchOnWindowFocus: false
  });

  if (!open || !round) return null;

  const data = details.data ?? { round, events: [], source: "row" as const };

  return (
    <div className="round-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="round-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Round details"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="round-drawer-head">
          <div>
            <div className="round-drawer-kicker">Round detail</div>
            <GameIdentity gameId={round.game_id} label={getGameLabel(round.game_id)} size="sm" className="round-drawer-game" />
          </div>
          <button type="button" onClick={onClose} className="round-icon-button" aria-label="Close round details">
            <X size={16} />
          </button>
        </div>

        <RoundDetailBody details={data} loading={details.isLoading} />
      </aside>
    </div>
  );
}

export function RoundDetailBody({
  details,
  loading = false,
  fallbackChainId,
  fallbackRequestId
}: {
  details: RoundDetails;
  loading?: boolean;
  fallbackChainId?: number;
  fallbackRequestId?: string;
}) {
  const round = details.round;
  const chainId = round?.chain_id ?? details.events[0]?.chain_id ?? fallbackChainId ?? 0;
  const txHash = round?.tx_hash ?? details.events.find((event) => event.tx_hash)?.tx_hash ?? null;
  const requestId = round?.vrf_request_id ?? details.events[0]?.vrf_request_id ?? fallbackRequestId ?? null;
  const txUrl = getTxExplorerUrl(chainId, txHash);
  const playerUrl = getAddressExplorerUrl(chainId, round?.player ?? details.events.find((event) => event.player)?.player);
  const roundPath = round && requestId ? getRoundPath({ chain_id: chainId, vrf_request_id: requestId }) : null;
  const net = round ? Number(round.payout) - Number(round.bet_amount) : null;

  return (
    <div className="round-detail-body">
      {loading && <div className="round-detail-note">Loading indexed event timeline...</div>}

      <div className="round-detail-summary">
        <DetailItem label="Player" value={round?.player ? shortenAddress(round.player, 5) : "Unknown"} href={playerUrl} />
        <DetailItem label="VRF request" value={requestId ? shortHash(requestId, 7) : "Not indexed"} mono />
        <DetailItem label="Bet" value={round ? `${formatEth(round.bet_amount)} ETH` : "-"} mono />
        <DetailItem label="Payout" value={round ? `${formatEth(round.payout)} ETH` : "-"} mono />
        <DetailItem
          label="Net"
          value={net === null ? "-" : `${net >= 0 ? "+" : ""}${formatEth(net)} ETH`}
          tone={net === null ? undefined : net >= 0 ? "win" : "loss"}
          mono
        />
        <DetailItem label="Result" value={round ? (round.won ? "Win" : "Loss") : "Not indexed"} tone={round ? (round.won ? "win" : "loss") : undefined} />
      </div>

      <div className="round-detail-actions">
        {txUrl && (
          <a href={txUrl} target="_blank" rel="noreferrer" className="round-detail-action">
            <ExternalLink size={13} />
            Basescan tx
          </a>
        )}
        {roundPath && (
          <Link href={roundPath} className="round-detail-action">
            Open full page
          </Link>
        )}
      </div>

      <div className="round-timeline">
        <div className="round-section-title">Event timeline</div>
        {details.events.length > 0 ? (
          details.events.map((event) => (
            <div key={event.id} className="round-timeline-row">
              <span className="round-timeline-dot" />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <strong>{eventLabel(event.event_name)}</strong>
                  {event.tx_hash && (
                    <a href={getTxExplorerUrl(event.chain_id, event.tx_hash) ?? undefined} target="_blank" rel="noreferrer" className="round-tx-link">
                      tx
                    </a>
                  )}
                </div>
                <div className="round-timeline-meta">
                  {event.block_number ? `Block ${event.block_number}` : "Block pending"} · log {event.log_index}
                </div>
                <EventArgs args={event.args} />
              </div>
            </div>
          ))
        ) : (
          <div className="round-detail-note">
            No event timeline is indexed yet. The settlement summary can still be checked from the transaction link when available.
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value, href, tone, mono = false }: { label: string; value: string; href?: string | null; tone?: "win" | "loss"; mono?: boolean }) {
  const className = `round-detail-item-value ${mono ? "font-mono" : ""} ${tone === "win" ? "text-[var(--win)]" : tone === "loss" ? "text-[var(--lose)]" : ""}`;
  return (
    <div className="round-detail-item">
      <span>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {value}
        </a>
      ) : (
        <strong className={className}>{value}</strong>
      )}
    </div>
  );
}

function EventArgs({ args }: { args: unknown }) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  const entries = Object.entries(args as Record<string, unknown>).slice(0, 4);
  if (entries.length === 0) return null;

  return (
    <div className="round-event-args">
      {entries.map(([key, value]) => (
        <span key={key}>
          {key}: <strong>{formatArg(value)}</strong>
        </span>
      ))}
    </div>
  );
}

function formatArg(value: unknown) {
  if (typeof value === "string") return value.startsWith("0x") || value.length > 28 ? shortHash(value) : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function shortHash(value: string, chars = 6) {
  if (value.length <= chars * 2 + 4) return value;
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
}
