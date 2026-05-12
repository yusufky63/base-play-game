"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Server } from "lucide-react";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";

type IndexerHealth = {
  chainId: number;
  gameId: string;
  status: "starting" | "watching" | "catching_up" | "error";
  lastIndexedBlock: string | null;
  lastLogAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export function AdminHealthPanel() {
  const [indexers, setIndexers] = useState<IndexerHealth[]>([]);
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");
  const [message, setMessage] = useState("Loading backend health");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/indexer/health", { cache: "no-store" });
        const data = (await response.json()) as { indexers?: IndexerHealth[]; message?: string };
        if (!response.ok) throw new Error(data.message ?? `HTTP ${response.status}`);
        if (!cancelled) {
          setIndexers(data.indexers ?? []);
          setMessage(data.message ?? "Backend health is online");
          setStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Backend health endpoint is unreachable");
          setStatus("error");
        }
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const errored = indexers.filter((item) => item.status === "error").length;
  const watching = indexers.filter((item) => item.status === "watching").length;
  const activeIndexers = indexers.filter((item) => item.chainId === 8453);
  const activeErrored = activeIndexers.filter((item) => item.status === "error").length;
  const activeWatching = activeIndexers.filter((item) => item.status === "watching").length;
  const sortedIndexers = [...indexers].sort((a, b) => {
    if (a.status === "error" && b.status !== "error") return -1;
    if (a.status !== "error" && b.status === "error") return 1;
    if (a.chainId !== b.chainId) return a.chainId - b.chainId;
    return a.gameId.localeCompare(b.gameId);
  });
  const visibleIndexers = sortedIndexers.filter((item) => item.chainId === 8453);

  return (
    <section className="admin-note mt-4">
      <div className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-[var(--text-1)]">
            <Activity size={16} />
            RPC and indexer health
          </div>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {status === "ready" ? `${watching} watching, ${errored} error, ${indexers.length} total` : status === "error" ? message : "Loading backend health"}
          </p>
        </div>
        {errored > 0 ? <AlertTriangle size={18} className="text-[var(--pending)]" /> : <CheckCircle2 size={18} className="text-[var(--win)]" />}
      </div>

      {status === "ready" && (
        <div className="admin-health-group-summary">
          {activeWatching} watching, {activeErrored} error, {activeIndexers.length} mainnet indexers
        </div>
      )}

      <div className="admin-health-list">
        {visibleIndexers.map((item) => (
          <div key={`${item.chainId}-${item.gameId}`} className={`admin-health-row ${item.status === "error" ? "admin-health-row-error" : ""}`}>
            <div className="admin-health-main">
              <div className="min-w-0">
                <span className="admin-health-game">{item.gameId}</span>
                <div className="admin-health-meta">
                  {getNetworkLabel(item.chainId)} / chain {item.chainId} / block {item.lastIndexedBlock ?? "-"}
                  {item.lastLogAt ? ` / ${new Date(item.lastLogAt).toLocaleString()}` : ""}
                </div>
              </div>
              <span className={item.status === "error" ? "admin-health-status admin-health-status-error" : "admin-health-status admin-health-status-ok"}>{item.status}</span>
            </div>
            {item.lastError && <div className="admin-health-error">{item.lastError}</div>}
          </div>
        ))}
        {indexers.length === 0 && (
          <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--text-2)]">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-1)]">
              <Server size={15} />
              Backend watcher data
            </div>
            <p className="mt-2">{message}</p>
          </div>
        )}
        {indexers.length > 0 && visibleIndexers.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--text-2)]">
            No mainnet watcher rows reported yet.
          </div>
        )}
      </div>
    </section>
  );
}

function getNetworkLabel(chainId: number) {
  return getNetworkByChainId(chainId)?.name ?? "Unknown network";
}
