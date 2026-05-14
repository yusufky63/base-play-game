"use client";

import Link from "next/link";
import { Gift, Loader2, Sparkles, Ticket, Trophy } from "lucide-react";
import { useAccount } from "wagmi";
import {
  useClaimLuckyDraw,
  useClaimLuckyDrawPrize,
  useLuckyDraw,
  useLuckyDrawHistory,
  type LuckyDrawPrize,
  type OnchainLuckyDrawResult
} from "@/hooks/useLuckyDraw";
import { openWalletModal } from "@/lib/walletConnectors";

export function LuckyDrawPageClient() {
  const account = useAccount();
  const address = account.address ?? null;
  const draw = useLuckyDraw(address, { enabled: Boolean(address) });
  const history = useLuckyDrawHistory(50);
  const claim = useClaimLuckyDraw(address);
  const prizeClaim = useClaimLuckyDrawPrize(address);
  const data = draw.data;
  const eligibleProofs = data?.eligibleProofs ?? [];
  const requiredProofs = data?.config.roundsRequired ?? 10;
  const canDraw = Boolean(address && data?.config.enabled && data?.onchain.configured && data.progress.availableDraws > 0 && eligibleProofs.length >= requiredProofs);
  const result = claim.data?.result ?? null;
  const prizes = data?.config.prizes ?? DEFAULT_PRIZES;

  function openDraw() {
    if (!address) {
      openWalletModal();
      return;
    }
    if (!canDraw || claim.isPending) return;
    claim.mutate(eligibleProofs.slice(0, requiredProofs));
  }

  return (
    <main className="lucky-draw-page mx-auto w-full max-w-7xl px-4 py-10">
      <section className="lucky-draw-hero">
        <div className="lucky-draw-hero-copy">
          <div className="quests-kicker">
            <Sparkles size={15} />
            Lucky Draw
          </div>
          <h1 className="display-heading text-4xl font-bold text-[var(--text-1)] md:text-6xl">Spin every 10 rounds</h1>
          <p className="max-w-2xl text-base leading-7 text-[var(--text-2)]">
            Bonus ETH rewards for active BasePlay players, resolved by the LuckyDraw contract with Chainlink VRF.
          </p>
        </div>
        <div className="lucky-draw-hero-metrics">
          <Metric label="Available" value={String(data?.progress.availableDraws ?? 0)} />
          <Metric label="Progress" value={data ? `${data.progress.qualifiedRounds}/${data.config.roundsRequired}` : "-"} />
          <Metric label="History" value={String(history.data?.rows.length ?? 0)} />
        </div>
      </section>

      <section className="lucky-draw-play-grid">
        <div className="lucky-draw-stage panel">
          <div className="lucky-draw-stage-head">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
                <Ticket size={14} className="text-[var(--accent)]" />
                Reward reel
              </div>
              <h2 className="mt-2 display-heading text-2xl font-bold text-[var(--text-1)]">
                {claim.isPending ? "Drawing..." : result ? "Reward unlocked" : data?.progress.availableDraws ? "Ready to draw" : "No draw ready"}
              </h2>
            </div>
            <div className="lucky-draw-icon">
              <Gift size={18} />
            </div>
          </div>

          <RewardReel prizes={prizes} spinning={claim.isPending} />

          {result ? (
            <DrawResult result={result} claimPending={prizeClaim.isPending} onClaimPrize={(requestId) => prizeClaim.mutate(requestId)} />
          ) : (
            <div className="lucky-draw-inline-status">
              <span>{claim.isPending ? "VRF pending" : data?.progress.availableDraws ? "Unlocked" : "Progress"}</span>
              <strong>
                {claim.isPending
                  ? "Waiting for Chainlink VRF"
                  : data?.progress.availableDraws
                    ? `${data.progress.availableDraws} draw ready`
                    : data
                      ? `${data.progress.roundsUntilNext} rounds left`
                      : address
                        ? "Loading"
                        : "Connect wallet"}
              </strong>
            </div>
          )}

          <button
            type="button"
            className="primary-action mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white disabled:opacity-45"
            disabled={Boolean(address) && (!canDraw || claim.isPending)}
            onClick={openDraw}
          >
            {claim.isPending && <Loader2 size={16} className="animate-spin" />}
            {!address ? "Connect wallet" : claim.isPending ? "Drawing..." : canDraw ? "Open Lucky Draw" : draw.isLoading ? "Loading..." : "No draw ready"}
          </button>
        </div>

        <aside className="lucky-draw-side panel">
          <div className="lucky-draw-side-head">
            <Sparkles size={17} />
            <span>Reward details</span>
          </div>
          <div className="lucky-draw-rule">
            <strong>{requiredProofs} settled rounds unlock one draw</strong>
            <span>Approved game proofs resolve on Base with Chainlink VRF.</span>
          </div>
          <div className="lucky-draw-detail-strip">
            <Metric label="Max prize" value={`${formatEth(Math.max(...prizes.map((prize) => prize.eth)))} ETH`} />
            <Metric label="Network" value="Base" />
            <Metric label="Status" value={data?.config.enabled === false ? "Paused" : "Live"} />
          </div>
          <div className="lucky-draw-prize-strip">
            {prizes.slice(0, 6).map((prize) => (
              <div key={`${prize.usd}-${prize.weight}`} className="lucky-draw-prize">
                <span>${prize.usd.toFixed(prize.usd < 1 ? 2 : 0)}</span>
                <small>{formatEth(prize.eth)} ETH</small>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="lucky-draw-history panel">
        <div className="lucky-draw-history-head">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
              <Trophy size={14} className="text-[var(--accent)]" />
              Public history
            </div>
            <h2 className="mt-2 display-heading text-2xl font-bold text-[var(--text-1)]">Recent rewards</h2>
          </div>
          <Link href="/docs?section=rewards" className="secondary-action inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-bold">
            Docs
          </Link>
        </div>

        {history.isLoading ? (
          <div className="grid gap-2 p-4">
            <span className="feed-skeleton h-10 w-full" />
            <span className="feed-skeleton h-10 w-full" />
            <span className="feed-skeleton h-10 w-3/4" />
          </div>
        ) : history.data?.rows.length ? (
          <div className="lucky-draw-history-list">
            {history.data.rows.map((row) => {
              const ownPrize = address?.toLowerCase() === row.player.toLowerCase() && row.status === "claimable";
              return (
                <div key={`${row.requestId}-${row.txHash}`} className="lucky-draw-history-row">
                  <div className="min-w-0">
                    <strong>{formatEth(row.prizeAmountEth)} ETH</strong>
                    <span>{shortAddress(row.player)} - #{row.requestId.slice(0, 8)}</span>
                  </div>
                  <div className="lucky-draw-history-actions">
                    <span className={`lucky-draw-status lucky-draw-status-${row.status}`}>{row.status}</span>
                    {ownPrize ? (
                      <button
                        type="button"
                        className="secondary-action inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold disabled:opacity-45"
                        disabled={prizeClaim.isPending}
                        onClick={() => prizeClaim.mutate(row.requestId)}
                      >
                        Claim
                      </button>
                    ) : (
                      <a className="secondary-action inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold" href={`https://basescan.org/tx/${row.txHash}`} target="_blank" rel="noreferrer">
                        Tx
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="lucky-draw-empty">No resolved draws yet.</div>
        )}
      </section>
    </main>
  );
}

function RewardReel({ prizes, spinning }: { prizes: LuckyDrawPrize[]; spinning: boolean }) {
  const reelItems = Array.from({ length: 8 }).flatMap(() => prizes);
  return (
    <div className={`lucky-draw-reel lucky-draw-page-reel ${spinning ? "lucky-draw-reel-spinning" : "lucky-draw-reel-idle"}`} aria-hidden="true">
      <div className="lucky-draw-reel-track">
        {reelItems.map((prize, index) => (
          <div key={`${prize.usd}-${prize.weight}-${index}`} className="lucky-draw-reel-item">
            <span>${prize.usd.toFixed(prize.usd < 1 ? 2 : 0)}</span>
            <small>{formatEth(prize.eth)} ETH</small>
          </div>
        ))}
      </div>
      <div className="lucky-draw-reel-marker" />
    </div>
  );
}

function DrawResult({
  result,
  claimPending,
  onClaimPrize
}: {
  result: OnchainLuckyDrawResult;
  claimPending: boolean;
  onClaimPrize: (requestId: string) => void;
}) {
  return (
    <div className="lucky-draw-result">
      <span>You won</span>
      <strong>{formatEth(result.prizeAmountEth)} ETH</strong>
      <small>VRF request #{result.requestId}</small>
      <button
        type="button"
        className="primary-action mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white disabled:opacity-45"
        disabled={claimPending}
        onClick={() => onClaimPrize(result.requestId)}
      >
        {claimPending && <Loader2 size={15} className="animate-spin" />}
        Claim prize
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="lucky-draw-page-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatEth(value: number) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const DEFAULT_PRIZES: LuckyDrawPrize[] = [
  { usd: 0.1, weight: 62_000, eth: 0.000043478261, oddsPct: 62 },
  { usd: 0.5, weight: 25_000, eth: 0.000217391304, oddsPct: 25 },
  { usd: 1, weight: 9_000, eth: 0.000434782609, oddsPct: 9 },
  { usd: 2.5, weight: 3_000, eth: 0.001086956522, oddsPct: 3 },
  { usd: 5, weight: 800, eth: 0.002173913043, oddsPct: 0.8 },
  { usd: 10, weight: 200, eth: 0.004347826087, oddsPct: 0.2 }
];
