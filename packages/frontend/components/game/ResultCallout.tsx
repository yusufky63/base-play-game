"use client";

import { CheckCircle2, Clock3, ExternalLink, Trophy, XCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";
import { SharePanel } from "@/components/share/SharePanel";

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
  const { chain } = useAccount();
  if (variant === "idle") return null;

  const Icon = variant === "win" ? CheckCircle2 : variant === "loss" ? XCircle : Clock3;
  const label = variant === "win" ? "Won" : variant === "loss" ? "Lost" : "Running";
  const explorer = getNetworkByChainId(chain?.id ?? 8453)?.blockExplorer;
  const txUrl = share?.txHash && explorer ? `${explorer}/tx/${share.txHash}` : null;
  const shareText = share ? `I won on ${share.game} at BasePlay. ${share.detail}${txUrl ? ` ${txUrl}` : ""}` : "";

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
          <div className="win-share-card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
                <Trophy size={13} className="text-[var(--win)]" />
                Win card
              </div>
              {txUrl && (
                <a href={txUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[var(--text-3)] hover:text-[var(--accent)]">
                  TX <ExternalLink size={11} />
                </a>
              )}
            </div>
            <div className="mt-2 font-mono text-xs font-bold text-[var(--text-1)]">{share.detail}</div>
            <div className="mt-3">
              <SharePanel compact text={shareText} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
