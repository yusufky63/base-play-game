"use client";

import { useEffect, useState } from "react";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { AdminShell } from "@/components/admin/AdminShell";
import { getSupabaseBrowser } from "@/lib/supabase";
import { formatEth, shortenAddress } from "@/lib/formatters";
import { fetchRecentOnchainRounds, type OnchainRound } from "@/lib/onchainRounds";

type Round = Database["public"]["Tables"]["game_rounds"]["Row"];
type LogRound = Round | OnchainRound;

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogRound[]>([]);
  const [ready, setReady] = useState(false);
  const [gameId, setGameId] = useState("all");

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const selectedGame = gameId === "all" ? undefined : gameId;
    if (!supabase) {
      fetchRecentOnchainRounds({ limit: 50, gameId: selectedGame })
        .then(setLogs)
        .finally(() => setReady(true));
      return;
    }

    async function load() {
      let query = supabase
        .from("game_rounds")
        .select("*")
        .order("settled_at", { ascending: false })
        .limit(50);
      if (selectedGame) {
        query = query.eq("game_id", selectedGame);
      }

      const { data } = await query;
      setLogs(data ?? []);
      setReady(true);
    }

    void load();
  }, [gameId]);

  return (
    <AdminShell title="Logs" description="Operational event stream for settled game rounds.">
      <div className="mb-3 flex justify-end">
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
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        {logs.map((log) => (
          <div key={log.id} className="grid gap-1 border-b border-[var(--border)] px-4 py-4 text-sm last:border-b-0 md:grid-cols-[170px_180px_1fr] md:gap-3">
            <span className="font-mono text-xs text-[var(--text-3)]">{log.settled_at ? new Date(log.settled_at).toLocaleString() : `Block ${"block_number" in log ? log.block_number.toString() : "-"}`}</span>
            <span className="font-medium text-[var(--text-1)]">{log.game_id}</span>
            <span className="text-[var(--text-2)]">
              {shortenAddress(log.player)} {log.won ? "won" : "lost"} {formatEth(log.bet_amount)} ETH
            </span>
          </div>
        ))}
        {ready && logs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-3)]">
            No settled round logs yet.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
