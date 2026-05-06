"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Server } from "lucide-react";

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

  return (
    <section className="admin-note mt-4">
      <div className="mb-4 flex flex-col gap-2 border-b border-[var(--border)] pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-[var(--text-1)]">
            <Activity size={16} />
            RPC and indexer health
          </div>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {status === "ready" ? `${watching} watching, ${errored} error` : status === "error" ? message : "Loading backend health"}
          </p>
        </div>
        {errored > 0 ? <AlertTriangle size={18} className="text-[var(--pending)]" /> : <CheckCircle2 size={18} className="text-[var(--win)]" />}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {indexers.slice(0, 8).map((item) => (
          <div key={`${item.chainId}-${item.gameId}`} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs font-semibold text-[var(--text-1)]">{item.gameId}</span>
              <span className={item.status === "error" ? "text-xs text-[var(--lose)]" : "text-xs text-[var(--win)]"}>{item.status}</span>
            </div>
            <div className="mt-2 font-mono text-[11px] text-[var(--text-3)]">
              chain {item.chainId} · block {item.lastIndexedBlock ?? "-"}
            </div>
            {item.lastLogAt && <div className="mt-1 font-mono text-[10px] text-[var(--text-3)]">last update {new Date(item.lastLogAt).toLocaleString()}</div>}
            {item.lastError && <div className="mt-2 text-xs text-[var(--lose)]">{item.lastError}</div>}
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
      </div>
    </section>
  );
}
