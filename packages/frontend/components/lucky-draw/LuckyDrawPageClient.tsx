"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Clock3, ExternalLink, Gift, Loader2, ShieldCheck, Sparkles, Ticket, Trophy } from "lucide-react";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { RoundStatus } from "@/components/game/RoundStatus";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import {
  useClaimLuckyDraw,
  useClaimLuckyDrawPrize,
  useLuckyDraw,
  useLuckyDrawHistory,
  type LuckyDrawHistory,
  type LuckyDrawPrize,
  type OnchainLuckyDrawResult
} from "@/hooks/useLuckyDraw";
import { defaultChainId } from "@/lib/env";
import { formatUsd as formatUsdValue, shortenAddress } from "@/lib/formatters";
import { openWalletModal } from "@/lib/walletConnectors";

const HISTORY_PAGE_SIZE = 8;
const OWN_HISTORY_LIMIT = 4;

export function LuckyDrawPageClient() {
  const account = useAccount();
  const address = account.address ?? null;
  const [historyPage, setHistoryPage] = useState(0);
  const historyOffset = historyPage * HISTORY_PAGE_SIZE;
  const draw = useLuckyDraw(address, { enabled: Boolean(address) });
  const history = useLuckyDrawHistory({ limit: HISTORY_PAGE_SIZE, offset: historyOffset });
  const claim = useClaimLuckyDraw(address);
  const prizeClaim = useClaimLuckyDrawPrize(address);
  const ownHistory = useLuckyDrawHistory({
    limit: OWN_HISTORY_LIMIT,
    offset: 0,
    player: address,
    enabled: Boolean(address),
    refetchInterval: claim.pendingRequest ? 10_000 : false
  });
  const data = draw.data;
  const eligibleProofs = data?.eligibleProofs ?? [];
  const requiredProofs = data?.config.roundsRequired ?? 10;
  const drawPending = Boolean(claim.isPending || claim.pendingRequest);
  const canDraw = Boolean(address && data?.config.enabled && data?.onchain.configured && data.progress.availableDraws > 0 && eligibleProofs.length >= requiredProofs && !drawPending);
  const pendingHistoryRow = claim.pendingRequest
    ? ownHistory.data?.rows.find((row) => row.requestId === claim.pendingRequest?.requestId && row.status === "claimable")
    : null;
  const historyResult = pendingHistoryRow ? historyRowToResult(pendingHistoryRow, claim.pendingRequest?.requestTxHash ?? null) : null;
  const result = claim.data?.result ?? historyResult ?? null;
  const prizes = data?.config.prizes ?? DEFAULT_PRIZES;
  const ethUsd = useEthUsdPrice(Boolean(result));
  const resultUsd = result ? result.prizeAmountEth * (ethUsd ?? data?.config.ethUsdReference ?? 0) : null;
  const connectedChainId = account.chain?.id ?? defaultChainId;
  const chainId = getNetworkByChainId(connectedChainId) ? connectedChainId : defaultChainId;
  const vrfState = result ? "settled" : drawPending ? "pending_vrf" : "idle";
  const daily = data?.daily ?? null;
  const dailyCap = daily?.cap ?? data?.config.dailyDrawCap ?? 10;
  const ownHistoryRows = (ownHistory.data?.rows ?? []).filter((row) => address && row.player.toLowerCase() === address.toLowerCase() && row.status === "claimable");
  const ownHistoryTotal =
    typeof ownHistory.data?.total === "number" && ownHistoryRows.length === (ownHistory.data?.rows.length ?? 0)
      ? ownHistory.data.total
      : ownHistoryRows.length;

  function openDraw() {
    if (!address) {
      openWalletModal();
      return;
    }
    if (!canDraw || drawPending) return;
    claim.mutate(eligibleProofs.slice(0, requiredProofs));
  }

  function claimPrize(requestId: string) {
    prizeClaim.mutate(requestId, {
      onSuccess: () => claim.reset()
    });
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
        <div className="lucky-draw-hero-metrics" aria-label="Lucky Draw stats">
          <Metric label="Available" value={String(data?.progress.availableDraws ?? 0)} />
          <Metric label="Progress" value={data ? `${data.progress.qualifiedRounds}/${data.config.roundsRequired}` : "-"} />
          <Metric label="Earned today" value={data ? `${daily?.earnedDraws ?? 0}/${dailyCap}` : "-"} />
        </div>
      </section>

      <section className="lucky-draw-chain-stack">
        <LuckyDrawContractPanel chainId={chainId} />
        {vrfState !== "idle" && (
          <RoundStatus
            state={vrfState}
            requestId={result?.requestId ?? claim.pendingRequest?.requestId ?? null}
            txHash={result?.txHash ?? claim.pendingRequest?.requestTxHash ?? null}
          />
        )}
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
                {result ? "Reward unlocked" : drawPending ? "VRF pending" : data?.progress.availableDraws ? "Ready to draw" : "No draw ready"}
              </h2>
            </div>
            <div className="lucky-draw-icon">
              <Gift size={18} />
            </div>
          </div>

          <RewardReel prizes={prizes} spinning={drawPending && !result} />

          {result ? (
            <DrawResult result={result} resultUsd={resultUsd} claimPending={prizeClaim.isPending} onClaimPrize={claimPrize} />
          ) : (
            <div className="lucky-draw-inline-status">
              <span>{drawPending ? "VRF pending" : data?.progress.availableDraws ? "Unlocked" : "Progress"}</span>
              <strong>
                {drawPending
                  ? claim.pendingRequest
                    ? `Request #${claim.pendingRequest.requestId.slice(0, 10)}...`
                    : "Waiting for transaction"
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
            disabled={Boolean(address) && (!canDraw || drawPending)}
            onClick={openDraw}
          >
            {drawPending && <Loader2 size={16} className="animate-spin" />}
            {!address ? "Connect wallet" : drawPending ? "VRF pending" : canDraw ? "Open Lucky Draw" : draw.isLoading ? "Loading..." : "No draw ready"}
          </button>
        </div>
      </section>

      <HowItWorks minBetEth={data?.config.minBetEth ?? 0.000115} roundsRequired={requiredProofs} dailyCap={dailyCap} />

      <section className="lucky-draw-history panel">
        <div className="lucky-draw-history-head">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
              <Trophy size={14} className="text-[var(--accent)]" />
              Public history
            </div>
            <h2 className="mt-2 display-heading text-2xl font-bold text-[var(--text-1)]">Recent rewards</h2>
          </div>
        </div>

        <div className="lucky-draw-history-sections">
          <div className="lucky-draw-history-block">
            <div className="lucky-draw-history-subhead">
              <span>Claimable rewards</span>
              <small>{address ? `${ownHistoryTotal} ready to claim` : "Wallet not connected"}</small>
            </div>
            {!address ? (
              <div className="lucky-draw-empty">Connect wallet to see claimable Lucky Draw rewards.</div>
            ) : ownHistory.isLoading ? (
              <HistorySkeleton />
            ) : ownHistoryRows.length ? (
                <HistoryRows rows={ownHistoryRows} address={address} claimPending={prizeClaim.isPending} onClaimPrize={claimPrize} showPlayer={false} />
            ) : (
              <div className="lucky-draw-empty">No claimable rewards for this wallet.</div>
            )}
          </div>

          <div className="lucky-draw-history-block">
            <div className="lucky-draw-history-subhead">
              <span>Recent rewards</span>
              <small>{history.data?.total ? `${history.data.total} total` : "Latest on-chain rewards"}</small>
            </div>
            {history.isLoading ? (
              <HistorySkeleton />
            ) : history.data?.rows.length ? (
              <>
                <HistoryRows rows={history.data.rows} address={address} claimPending={prizeClaim.isPending} onClaimPrize={claimPrize} showPlayer allowClaim={false} />
                <div className="lucky-draw-pagination">
                  <button
                    type="button"
                    className="secondary-action inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold disabled:opacity-45"
                    disabled={historyPage === 0 || history.isFetching}
                    onClick={() => setHistoryPage((page) => Math.max(0, page - 1))}
                  >
                    Previous
                  </button>
                  <span>
                    Page {historyPage + 1}
                    {history.data.total ? ` / ${Math.max(1, Math.ceil(history.data.total / HISTORY_PAGE_SIZE))}` : ""}
                  </span>
                  <button
                    type="button"
                    className="secondary-action inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-bold disabled:opacity-45"
                    disabled={!history.data.hasMore || history.isFetching}
                    onClick={() => setHistoryPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <div className="lucky-draw-empty">No resolved draws yet.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function RewardReel({ prizes, spinning }: { prizes: LuckyDrawPrize[]; spinning: boolean }) {
  const reelItems = Array.from({ length: 5 }).flatMap(() => prizes);
  return (
    <div className={`lucky-draw-reel lucky-draw-page-reel ${spinning ? "lucky-draw-reel-spinning" : "lucky-draw-reel-idle"}`} aria-hidden="true">
      <div className="lucky-draw-reel-track">
        {[0, 1].map((segment) => (
          <div key={segment} className="lucky-draw-reel-segment">
            {reelItems.map((prize, index) => (
              <div key={`${segment}-${prize.usd}-${prize.weight}-${index}`} className="lucky-draw-reel-item">
                <span>${formatPrizeUsd(prize.usd)}</span>
                <small>{formatEth(prize.eth)} ETH</small>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="lucky-draw-reel-marker" />
    </div>
  );
}

function DrawResult({
  result,
  resultUsd,
  claimPending,
  onClaimPrize
}: {
  result: OnchainLuckyDrawResult;
  resultUsd: number | null;
  claimPending: boolean;
  onClaimPrize: (requestId: string) => void;
}) {
  return (
    <div className="lucky-draw-result">
      <span>You won</span>
      <strong>{formatEth(result.prizeAmountEth)} ETH</strong>
      {resultUsd !== null && resultUsd > 0 && <em>{formatUsdValue(resultUsd)}</em>}
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

function LuckyDrawContractPanel({ chainId }: { chainId: number }) {
  const network = getNetworkByChainId(chainId) ?? getNetworkByChainId(defaultChainId);
  const luckyDrawAddress = CONTRACT_ADDRESSES[network?.chainId ?? defaultChainId]?.LuckyDraw;

  if (!network || !luckyDrawAddress) return null;

  return (
    <section className="contract-panel" aria-label="Public Lucky Draw contract address">
      <div>
        <div className="font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">Contracts on {network.name}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={`${network.blockExplorer}/address/${luckyDrawAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="contract-link"
            title="LuckyDraw contract on explorer"
          >
            <span>LuckyDraw</span>
            <strong>{shortenAddress(luckyDrawAddress, 5)}</strong>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </section>
  );
}

function HowItWorks({ minBetEth, roundsRequired, dailyCap }: { minBetEth: number; roundsRequired: number; dailyCap: number }) {
  const [open, setOpen] = useState(false);
  const steps = [
    { title: "Qualify", body: `Settled rounds at ${formatEth(minBetEth)} ETH or higher count for your wallet.`, icon: Ticket },
    { title: "Unlock", body: `Every ${roundsRequired} counted rounds adds one available draw.`, icon: Gift },
    { title: "Daily cap", body: `You can earn up to ${dailyCap} draw rights per UTC day, reset at 03:00 TSI.`, icon: Clock3 },
    { title: "Claim", body: "The contract checks proofs, requests VRF, then makes the ETH prize claimable.", icon: ShieldCheck }
  ];

  useEffect(() => {
    setOpen(window.matchMedia("(min-width: 768px)").matches);
  }, []);

  return (
    <details className="lucky-draw-how-panel panel p-0" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="lucky-draw-how-summary">
        <div className="lucky-draw-how-title">
          <span className="lucky-draw-how-mark">
            <Sparkles size={17} />
          </span>
          <div>
            <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">How it works</h2>
            <p>Qualify, unlock, draw, and claim with proof-backed rounds.</p>
          </div>
        </div>
        <div className="lucky-draw-how-summary-right">
          <span>{roundsRequired} rounds</span>
          <span>{dailyCap}/day</span>
          <span className="lucky-draw-how-toggle" aria-hidden="true">
            <ChevronDown size={18} className="lucky-draw-how-chevron" />
          </span>
        </div>
      </summary>
      <div className="lucky-draw-how-body">
        <ol className="lucky-draw-how-steps">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          return (
            <li key={step.title} className="lucky-draw-how-step">
              <span className="lucky-draw-how-index">{index + 1}</span>
              <span className="lucky-draw-how-icon">
                <StepIcon size={16} />
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          );
        })}
        </ol>
        <div className="lucky-draw-how-note">
          <span>Contract checks still enforce the minimum eligible bet.</span>
          <strong>Unused available draws carry over.</strong>
        </div>
      </div>
    </details>
  );
}

function HistoryRows({
  rows,
  address,
  claimPending,
  onClaimPrize,
  showPlayer,
  allowClaim = true
}: {
  rows: LuckyDrawHistory["rows"];
  address?: string | null;
  claimPending: boolean;
  onClaimPrize: (requestId: string) => void;
  showPlayer: boolean;
  allowClaim?: boolean;
}) {
  return (
    <div className="lucky-draw-history-list">
      {rows.map((row) => {
        const ownPrize = allowClaim && address?.toLowerCase() === row.player.toLowerCase() && row.status === "claimable";
        return (
          <div
            key={`${row.requestId}-${row.txHash}`}
            className={`lucky-draw-history-row ${row.status === "claimable" ? "lucky-draw-history-row-claimable" : ""}`}
          >
            <div className="min-w-0">
              <strong>{formatEth(row.prizeAmountEth)} ETH</strong>
              <span>{showPlayer ? shortAddress(row.player) : "Your wallet"} - #{row.requestId.slice(0, 8)}</span>
            </div>
            <div className="lucky-draw-history-actions">
              <span className={`lucky-draw-status lucky-draw-status-${row.status}`}>{row.status}</span>
              {ownPrize ? (
                <button
                  type="button"
                  className="lucky-draw-claim-button inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-bold disabled:opacity-45"
                  disabled={claimPending}
                  onClick={() => onClaimPrize(row.requestId)}
                >
                  <Gift size={13} />
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
  );
}

function historyRowToResult(row: LuckyDrawHistory["rows"][number], requestTxHash: string | null): OnchainLuckyDrawResult {
  return {
    requestId: row.requestId,
    prizeIndex: row.prizeIndex,
    prizeAmountWei: row.prizeAmountWei,
    prizeAmountEth: row.prizeAmountEth,
    txHash: row.txHash,
    requestTxHash
  };
}

function HistorySkeleton() {
  return (
    <div className="grid gap-2 py-3">
      <span className="feed-skeleton h-10 w-full" />
      <span className="feed-skeleton h-10 w-full" />
      <span className="feed-skeleton h-10 w-3/4" />
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
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toFixed(8).replace(/\.?0+$/, "") || "0";
}

function formatPrizeUsd(value: number) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  if (numeric < 1) return numeric.toFixed(2);
  if (Number.isInteger(numeric)) return numeric.toFixed(0);
  return numeric.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const DEFAULT_PRIZES: LuckyDrawPrize[] = [
  { usd: 0.1, weight: 62_000, eth: 0.000045724737, oddsPct: 62 },
  { usd: 0.5, weight: 25_000, eth: 0.000228623686, oddsPct: 25 },
  { usd: 1, weight: 9_000, eth: 0.000457247371, oddsPct: 9 },
  { usd: 2.5, weight: 3_000, eth: 0.001143118427, oddsPct: 3 },
  { usd: 5, weight: 800, eth: 0.002286236854, oddsPct: 0.8 },
  { usd: 10, weight: 200, eth: 0.004572473708, oddsPct: 0.2 }
];
