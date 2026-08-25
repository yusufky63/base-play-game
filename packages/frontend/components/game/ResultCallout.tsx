"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Sparkles, Trophy, XCircle } from "lucide-react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { SharePanel } from "@/components/share/SharePanel";
import { ShareWinModal } from "@/components/share/ShareWinModal";
import { useReferralSummary } from "@/hooks/useReferral";

type ResultVariant = "win" | "loss" | "pending" | "idle";

export function ResultCallout({
  variant,
  title,
  detail,
  payout,
  betAmount,
  share
}: {
  variant: ResultVariant;
  title: string;
  detail?: string;
  payout?: unknown;
  betAmount?: unknown;
  share?: {
    game: string;
    detail: string;
    txHash?: string | null;
  };
}) {
  const { address } = useAccount();
  const [showShareModal, setShowShareModal] = useState(false);
  const referralSummary = useReferralSummary(address, { enabled: Boolean(address) && variant === "win" && Boolean(share) });
  if (variant === "idle") return null;

  const Icon = variant === "win" ? CheckCircle2 : variant === "loss" ? XCircle : Clock3;
  const label = variant === "win" ? "Won" : variant === "loss" ? "Lost" : "Running";
  const referralPath = referralSummary.data?.referralUrlPath ?? (address ? `/?ref=${address}` : undefined);
  const winMultiplier = formatWinMultiplier(payout, betAmount);
  const shareText = share ? `I just hit ${share.game} on BasePlay 🎲${winMultiplier ? ` Won ${winMultiplier}.` : ""} ${share.detail} Try a round with me.` : "";

  return (
    <div className={`result-callout result-callout-${variant} ${share && variant === "win" ? "result-callout-shareable" : ""}`} role="status" aria-live="polite">
      <div className="result-callout-icon">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <div className="result-callout-label">{label}</div>
        <div className="result-callout-title">{title}</div>
        {detail && <div className="result-callout-detail">{detail}</div>}
        {share && variant === "win" && (
          <div className="win-share-panel">
            <div className="win-share-head">
              <div className="win-share-kicker">
                <Trophy size={13} className="text-[var(--win)]" />
                Verified win
              </div>
            </div>
            <p className="win-share-copy">
              Share your win and invite friends to play on Base.
            </p>
            <div className="win-share-result">{share.detail}</div>
            <div className="win-share-actions flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
              >
                <Sparkles size={13} />
                Generate Card
              </button>
              <SharePanel compact text={shareText} path={referralPath} />
            </div>

            <ShareWinModal
              isOpen={showShareModal}
              onClose={() => setShowShareModal(false)}
              gameName={share.game}
              payoutEth={payout as any}
              betAmountEth={betAmount as any}
              multiplier={winMultiplier ?? undefined}
              playerAddress={address}
              txHash={share.txHash}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function formatWinMultiplier(payout: unknown, betAmount: unknown) {
  const payoutEth = toEthNumber(payout);
  const betEth = toEthNumber(betAmount);
  if (!payoutEth || !betEth || payoutEth <= 0 || betEth <= 0) return null;
  return `${trimMultiplier(payoutEth / betEth)}x`;
}

function toEthNumber(value: unknown) {
  if (typeof value === "bigint") return Number(formatEther(value));
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed) && trimmed.length > 12) return Number(formatEther(BigInt(trimmed)));
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function trimMultiplier(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}
