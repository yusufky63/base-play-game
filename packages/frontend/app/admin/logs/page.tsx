"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { AdminShell } from "@/components/admin/AdminShell";
import { getSupabaseBrowser } from "@/lib/supabase";
import { formatEth, formatUsd, shortenAddress } from "@/lib/formatters";
import { fetchRecentOnchainRounds, type OnchainRound } from "@/lib/onchainRounds";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";

type Round = Database["public"]["Tables"]["game_rounds"]["Row"];
type LogRound = Round | OnchainRound;
const PAGE_SIZE = 25;

export default function AdminLogsPage() {
  const ethUsd = useEthUsdPrice();
  const [logs, setLogs] = useState<LogRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameId, setGameId] = useState("all");
  const [page, setPage] = useState(0);
  const [count, setCount] = useState<number | null>(null);

  async function load(nextPage = page) {
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const selectedGame = gameId === "all" ? undefined : gameId;
    if (!supabase) {
      const rows = await fetchRecentOnchainRounds({ limit: PAGE_SIZE, gameId: selectedGame });
      setLogs(rows);
      setCount(rows.length);
      setLoading(false);
      return;
    }

    let query = supabase
      .from("game_rounds")
      .select("*", { count: "exact" })
      .order("settled_at", { ascending: false })
      .range(nextPage * PAGE_SIZE, nextPage * PAGE_SIZE + PAGE_SIZE - 1);
    if (selectedGame) {
      query = query.eq("game_id", selectedGame);
    }

    const { data, count: total, error } = await query;
    if (error) {
      console.warn("[BasePlay] Admin logs query failed", error.message);
      setLogs([]);
      setCount(0);
    } else {
      setLogs(data ?? []);
      setCount(total ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    setPage(0);
    void load(0);
  }, [gameId]);

  const totalPages = count === null ? null : Math.max(1, Math.ceil(count / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = totalPages === null ? logs.length === PAGE_SIZE : page + 1 < totalPages;

  return (
    <AdminShell title="Logs" description="Operational event stream for settled game rounds.">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="font-mono text-xs text-[var(--text-3)]">
          {count === null ? `${logs.length} visible logs` : `${count} total logs`} · page {page + 1}{totalPages ? ` / ${totalPages}` : ""}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load(page)} className="control-shell flex items-center gap-2 px-3 text-xs font-bold">
            <RefreshCw size={13} className={loading ? "animate-spin text-[var(--accent)]" : ""} />
            Refresh
          </button>
        <select
          value={gameId}
          onChange={(event) => setGameId(event.target.value)}
          className="h-10 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
          aria-label="Filter logs by game"
        >
          <option value="all">All games</option>
          {GAMES_REGISTRY.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid gap-3 border-b border-[var(--border)] px-4 py-3 font-mono text-[10px] font-bold uppercase text-[var(--text-3)] md:grid-cols-[150px_130px_1fr_130px_130px_120px]">
          <span>Time</span>
          <span>Game</span>
          <span>Player / tx</span>
          <span>Bet</span>
          <span>Payout</span>
          <span>Status</span>
        </div>
        {loading && logs.length === 0 && Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid gap-3 border-b border-[var(--border)] px-4 py-4 md:grid-cols-[150px_130px_1fr_130px_130px_120px]">
            {Array.from({ length: 6 }).map((__, cell) => <span key={cell} className="h-4 animate-pulse rounded bg-[var(--surface-3)]" />)}
          </div>
        ))}
        {logs.map((log) => (
          <div key={log.id} className="grid gap-2 border-b border-[var(--border)] px-4 py-4 text-sm last:border-b-0 md:grid-cols-[150px_130px_1fr_130px_130px_120px] md:items-center md:gap-3">
            <span className="font-mono text-xs text-[var(--text-3)]">{log.settled_at ? new Date(log.settled_at).toLocaleString() : `Block ${"block_number" in log ? log.block_number.toString() : "-"}`}</span>
            <span className="font-medium text-[var(--text-1)]">{GAMES_REGISTRY.find((game) => game.id === log.game_id)?.name ?? log.game_id}</span>
            <span className="min-w-0 text-[var(--text-2)]">
              <span className="block font-mono text-xs text-[var(--text-1)]">{shortenAddress(log.player, 5)}</span>
              {log.tx_hash && (
                <a href={`${getNetworkByChainId(log.chain_id)?.blockExplorer ?? "https://basescan.org"}/tx/${log.tx_hash}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-[var(--text-3)] hover:text-[var(--accent)]">
                  {shortenAddress(log.tx_hash, 6)} <ExternalLink size={10} />
                </a>
              )}
            </span>
            <LogAmount value={Number(log.bet_amount)} ethUsd={ethUsd} />
            <LogAmount value={Number(log.payout)} ethUsd={ethUsd} />
            <span className={`font-mono text-xs font-bold ${log.won ? "text-[var(--win)]" : "text-[var(--lose)]"}`}>
              {log.won ? "WIN" : "LOSS"}
            </span>
          </div>
        ))}
        {!loading && logs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-3)]">
            No settled round logs yet.
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button type="button" disabled={!canPrev || loading} onClick={() => { const next = Math.max(0, page - 1); setPage(next); void load(next); }} className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold disabled:opacity-45">
          Newer
        </button>
        <button type="button" disabled={!canNext || loading} onClick={() => { const next = page + 1; setPage(next); void load(next); }} className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold disabled:opacity-45">
          Older
        </button>
      </div>
    </AdminShell>
  );
}

function LogAmount({ value, ethUsd }: { value: number; ethUsd: number | null }) {
  return (
    <span className="font-mono text-xs text-[var(--text-1)]">
      {formatEth(value)} ETH
      <span className="mt-1 block text-[10px] text-[var(--text-3)]">{ethUsd ? formatUsd(value * ethUsd) : "USD pending"}</span>
    </span>
  );
}
