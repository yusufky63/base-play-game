"use client";

import { RefreshCw } from "lucide-react";
import { formatEth } from "@/lib/formatters";
import { useGlobalStats } from "@/hooks/useGlobalStats";

export function NetworkStatusPanel({ activeCount }: { activeCount: number }) {
  const { data, isLoading, isFetching, refetch } = useGlobalStats();
  const stats = data ?? { plays: 0, players: 0, volume: 0 };

  const metrics = [
    { label: "Games", value: String(activeCount) },
    { label: "Rounds", value: String(stats.plays) },
    { label: "Players", value: String(stats.players) },
    { label: "Volume", value: `${formatEth(stats.volume)} ETH` }
  ];

  return (
    <div className="status-panel panel grid gap-3 p-4">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
        <span className="font-semibold text-[var(--text-1)]">Global stats</span>
        <button
          type="button"
          onClick={() => void refetch()}
          className="status-refresh-button"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin text-[var(--accent)]" : ""} />
          {isLoading ? "Loading" : "Refresh"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((stat) => (
          <div key={stat.label} className="status-metric rounded-md px-3 py-3">
            <div className="text-[10px] font-semibold uppercase text-[var(--text-3)]">{stat.label}</div>
            <div className="mt-1 text-xs font-bold text-[var(--text-1)]">{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
