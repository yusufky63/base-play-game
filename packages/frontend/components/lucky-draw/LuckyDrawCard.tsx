"use client";

import Link from "next/link";
import { Gift, Sparkles, Ticket } from "lucide-react";
import { useAccount } from "wagmi";
import { useLuckyDraw, type LuckyDrawSummary } from "@/hooks/useLuckyDraw";

export function LuckyDrawCard({ address: addressOverride, compact = false }: { address?: string | null; compact?: boolean }) {
  const account = useAccount();
  const address = addressOverride ?? account.address ?? null;
  const luckyDraw = useLuckyDraw(address, { enabled: Boolean(address) });
  const data = luckyDraw.data;
  const onchainConfigured = data?.onchain?.configured ?? false;
  const availableDraws = data?.progress.availableDraws ?? 0;
  const ribbonItems = (data?.config.prizes?.length ? data.config.prizes : FALLBACK_PRIZES).map((prize) => `${formatEth(prize.eth)} ETH`);

  return (
    <section className={`lucky-draw-card ${compact ? "lucky-draw-card-compact" : ""}`}>
      <div className="lucky-draw-ribbon" aria-hidden="true">
        <div className="lucky-draw-ribbon-track">
          {[0, 1].map((segment) => (
            <div key={segment} className="lucky-draw-ribbon-segment">
              {ribbonItems.map((item, index) => (
                <span key={`${segment}-${item}-${index}`}>{item}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
              <Sparkles size={14} className="text-[var(--accent)]" />
              Lucky Draw
            </div>
            <h2 className="mt-2 display-heading text-xl font-bold text-[var(--text-1)]">
              {availableDraws > 0 ? `${availableDraws} draw${availableDraws > 1 ? "s" : ""} ready` : "Play qualifying rounds"}
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

        <Link href="/lucky-draw" className="primary-action mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white">
          {data?.config.enabled === false
            ? "View paused draw"
            : !onchainConfigured
              ? "View Lucky Draw"
              : availableDraws > 0
                ? "Open Lucky Draw"
                : "View Lucky Draw"}
        </Link>
      </div>
    </section>
  );
}

function LuckyDrawBody({ data, compact }: { data: LuckyDrawSummary; compact: boolean }) {
  const progress = data.progress;
  const daily = data.daily ?? { earnedDraws: 0, cap: data.config.dailyDrawCap ?? 10, capped: false };
  const roundsRequired = data.config.roundsRequired;
  const latestPrize = data.recentResults[0];

  return (
    <>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-[var(--text-3)]">
          <span>Next draw: {progress.qualifiedRounds} / {roundsRequired}</span>
          <span>{progress.availableDraws > 0 ? `${progress.availableDraws} available` : `${progress.roundsUntilNext} left`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <span className="block h-full rounded-full bg-[var(--accent)] transition-[width]" style={{ width: `${progress.progressPct}%` }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric label="Available" value={String(progress.availableDraws)} />
        <MiniMetric label="Earned today" value={`${daily.earnedDraws}/${daily.cap}`} />
        <MiniMetric label="Won" value={`${formatEth(progress.totalPrizeEth)} ETH`} />
      </div>

      <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs leading-5 text-[var(--text-2)]">
        Min eligible bet: <span className="font-mono text-[var(--text-1)]">{formatEth(data.config.minBetEth)} ETH</span>
        {daily.capped && <span className="block text-[var(--pending)]">Daily Lucky Draw cap reached until 03:00 TSI.</span>}
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
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toFixed(8).replace(/\.?0+$/, "") || "0";
}

const FALLBACK_PRIZES = [0.1, 0.5, 1, 2.5, 5, 10].map((usd) => ({
  usd,
  weight: 1,
  eth: usd / 2187,
  oddsPct: 0
}));
