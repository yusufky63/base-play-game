"use client";

import { CheckCircle2, Clock3, XCircle } from "lucide-react";
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
  };
}) {
  if (variant === "idle") return null;

  const Icon = variant === "win" ? CheckCircle2 : variant === "loss" ? XCircle : Clock3;
  const label = variant === "win" ? "Won" : variant === "loss" ? "Lost" : "Running";

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
          <div className="result-callout-share">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">Share this win</div>
            <SharePanel compact text={`I won on ${share.game} at BasePlay. ${share.detail}`} />
          </div>
        )}
      </div>
    </div>
  );
}
