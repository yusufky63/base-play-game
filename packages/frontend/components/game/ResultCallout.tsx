"use client";

import { CheckCircle2, Clock3, Trophy, XCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { SharePanel } from "@/components/share/SharePanel";
import { useReferralSummary } from "@/hooks/useReferral";

type ResultVariant = "win" | "loss" | "pending" | "idle";

export function ResultCallout({
  variant,
  title,
  detail,
  share
}: {
  variant: ResultVariant;
  title: string;
  detail?: string;
  share?: {
    game: string;
    detail: string;
    txHash?: string | null;
  };
}) {
  const { address } = useAccount();
  const referralSummary = useReferralSummary(address, { enabled: Boolean(address) && variant === "win" && Boolean(share) });
  if (variant === "idle") return null;

  const Icon = variant === "win" ? CheckCircle2 : variant === "loss" ? XCircle : Clock3;
  const label = variant === "win" ? "Won" : variant === "loss" ? "Lost" : "Running";
  const referralPath = referralSummary.data?.referralUrlPath ?? (address ? `/?ref=${address}` : undefined);
  const shareText = share ? `I just hit ${share.game} on BasePlay. 🎲 ${share.detail} Try a round with me.` : "";

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
            <div className="win-share-actions">
              <SharePanel compact text={shareText} path={referralPath} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
