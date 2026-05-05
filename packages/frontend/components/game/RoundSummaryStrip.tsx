"use client";

import type { CSSProperties } from "react";

type RoundSummaryStatus = "idle" | "running" | "win" | "loss";

export type RoundSummaryItem = {
  label: string;
  value: string;
};

export function RoundSummaryStrip({
  items,
  status = "idle",
  className = ""
}: {
  items: RoundSummaryItem[];
  status?: RoundSummaryStatus;
  className?: string;
}) {
  return (
    <div
      className={`round-summary-strip round-summary-strip-${status} ${className}`}
      style={{ "--round-summary-count": items.length } as CSSProperties}
      aria-label="Round summary"
    >
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="round-summary-step">
          <span className="round-summary-index">{index + 1}</span>
          <span className="round-summary-copy">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}
