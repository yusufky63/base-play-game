"use client";

import { Gift, Loader2, Sparkles, Ticket } from "lucide-react";
import { useAccount } from "wagmi";
import { useClaimLuckyDraw, useLuckyDraw, type LuckyDrawSummary } from "@/hooks/useLuckyDraw";

export function LuckyDrawCard({ address: addressOverride, compact = false }: { address?: string | null; compact?: boolean }) {
  const account = useAccount();
  const address = addressOverride ?? account.address ?? null;
  const luckyDraw = useLuckyDraw(address, { enabled: Boolean(address) });
  const claim = useClaimLuckyDraw(address);
  const data = luckyDraw.data;
  const availableDraws = data?.progress.availableDraws ?? 0;
  const canDraw = Boolean(address && data?.config.enabled && availableDraws > 0);

  return (
    <section className={`lucky-draw-card ${compact ? "lucky-draw-card-compact" : ""}`}>
      <div className="lucky-draw-ribbon" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, index) => (
          <span key={index}>{index % 3 === 0 ? "0.000043 ETH" : index % 3 === 1 ? "0.000217 ETH" : "0.004348 ETH"}</span>
        ))}
      </div>

      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
              <Sparkles size={14} className="text-[var(--accent)]" />
              Lucky Draw
            </div>
            <h2 className="mt-2 display-heading text-xl font-bold text-[var(--text-1)]">
              {availableDraws > 0 ? `${availableDraws} draw${availableDraws > 1 ? "s" : ""} ready` : "Play 10 rounds"}
            </h2>
          </div>
          <div className="lucky-draw-icon">
            <Ticket size={18} />
          </div>
        </div>

        {!address ? (
          <p className="mt-3 text-sm leading-5 text-[var(--text-2)]">Connect wallet to track your draw progress.</p>
        ) : luckyDraw.isLoading ? (
          <div className="mt-4 grid gap-2">
            <span className="feed-skeleton h-3 w-full" />
            <span className="feed-skeleton h-3 w-2/3" />
          </div>
        ) : data ? (
          <LuckyDrawBody data={data} compact={compact} />
        ) : (
          <p className="mt-3 text-sm leading-5 text-[var(--text-2)]">Lucky Draw is not available right now.</p>
        )}

        <button
          type="button"
          onClick={() => claim.mutate()}
          disabled={!canDraw || claim.isPending}
          className="primary-action mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white disabled:opacity-45"
        >
          {claim.isPending && <Loader2 size={15} className="animate-spin" />}
          {claim.isPending ? "Drawing..." : canDraw ? "Open Lucky Draw" : data?.config.enabled === false ? "Paused" : "No draw yet"}
        </button>
      </div>
    </section>
  );
}

function LuckyDrawBody({ data, compact }: { data: LuckyDrawSummary; compact: boolean }) {
  const progress = data.progress;
  const roundsRequired = data.config.roundsRequired;
  const latestPrize = data.recentResults[0];

  return (
    <>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-[var(--text-3)]">
          <span>{progress.availableDraws > 0 ? "Draw unlocked" : `${progress.qualifiedRounds} / ${roundsRequired} rounds`}</span>
          <span>{progress.roundsUntilNext === 0 ? "Ready" : `${progress.roundsUntilNext} left`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <span className="block h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${progress.availableDraws > 0 ? 100 : progress.progressPct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric label="Draws" value={String(progress.lifetimeDrawsEarned)} />
        <MiniMetric label="Claimed" value={String(progress.lifetimeDrawsClaimed)} />
        <MiniMetric label="Won" value={`${formatEth(progress.totalPrizeEth)} ETH`} />
      </div>

      {!compact && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {data.config.prizes.slice(0, 6).map((prize) => (
            <div key={`${prize.usd}-${prize.weight}`} className="lucky-draw-prize">
              <span>${prize.usd.toFixed(prize.usd < 1 ? 2 : 0)}</span>
              <small>{formatEth(prize.eth)} ETH</small>
            </div>
          ))}
        </div>
      )}

      {latestPrize && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-2)]">
          <Gift size={14} className="text-[var(--accent)]" />
          <span>Last draw: {formatEth(latestPrize.prize_eth)} ETH, {latestPrize.status}</span>
        </div>
      )}
    </>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="lucky-draw-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatEth(value: number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 8 });
}
