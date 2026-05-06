"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { formatEth, formatUsd, shortenAddress } from "@/lib/formatters";
import { getDefaultNetworkConfig } from "@/lib/networkConfig";
import { getSupabaseBrowser } from "@/lib/supabase";

type GameStat = Database["public"]["Tables"]["game_stats"]["Row"];

const defaultNetwork = getDefaultNetworkConfig();

export function AdminGameAnalytics() {
  const ethUsd = useEthUsdPrice();
  const [rows, setRows] = useState<GameStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const statsByGame = useMemo(() => new Map(rows.map((row) => [row.game_id, row])), [rows]);

  async function load() {
    setLoading(true);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setRows([]);
      setUpdatedAt(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("game_stats")
      .select("*")
      .eq("chain_id", defaultNetwork.chainId)
      .order("total_rounds", { ascending: false });

    if (error) {
      console.warn("[BasePlay] Admin game stats failed", error.message);
      setRows([]);
      setUpdatedAt(null);
    } else {
      const nextRows = (data ?? []) as GameStat[];
      setRows(nextRows);
      setUpdatedAt(nextRows.map((row) => row.updated_at).sort().at(-1) ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="admin-note mt-4 overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-[var(--text-1)]">
            <Activity size={16} />
            Game analytics
          </div>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            {updatedAt ? `Last aggregate update ${new Date(updatedAt).toLocaleString()}` : "Supabase game_stats by deployed game"}
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="control-shell flex items-center gap-2 px-3 text-xs font-bold">
          <RefreshCw size={13} className={loading ? "animate-spin text-[var(--accent)]" : ""} />
          Refresh
        </button>
      </div>

      <div className="admin-table-scroll">
        <div className="admin-game-grid admin-game-grid-head">
          <span>Game</span>
          <span>Rounds</span>
          <span>Win / loss</span>
          <span>Wagered</span>
          <span>Paid</span>
          <span>Net</span>
          <span>Biggest</span>
        </div>
        {GAMES_REGISTRY.filter((game) => game.active && game.chains.includes(defaultNetwork.networkKey)).map((game) => {
          const stat = statsByGame.get(game.id);
          const totalRounds = stat?.total_rounds ?? 0;
          const wins = stat?.wins ?? 0;
          const losses = stat?.losses ?? 0;
          const winRate = totalRounds > 0 ? (wins / totalRounds) * 100 : 0;
          const address = CONTRACT_ADDRESSES[defaultNetwork.chainId]?.[game.contractName];
          return (
            <div key={game.id} className="admin-game-grid admin-game-grid-row">
              <div className="min-w-0">
                <div className="font-bold text-[var(--text-1)]">{game.name}</div>
                {address && (
                  <a href={`${defaultNetwork.network.blockExplorer}/address/${address}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-[var(--text-3)] hover:text-[var(--accent)]">
                    {shortenAddress(address, 5)}
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <AdminCell primary={String(totalRounds)} secondary={`${game.maxMultiplier}x max`} />
              <AdminCell primary={`${winRate.toFixed(1)}%`} secondary={`${wins} W / ${losses} L`} />
              <AdminCell primary={`${formatEth(stat?.total_wagered ?? 0)} ETH`} secondary={ethUsd ? formatUsd((stat?.total_wagered ?? 0) * ethUsd) : "USD pending"} />
              <AdminCell primary={`${formatEth(stat?.total_payout ?? 0)} ETH`} secondary={ethUsd ? formatUsd((stat?.total_payout ?? 0) * ethUsd) : "USD pending"} />
              <AdminCell primary={`${(stat?.net_profit ?? 0) >= 0 ? "+" : ""}${formatEth(stat?.net_profit ?? 0)} ETH`} secondary={ethUsd ? formatUsd((stat?.net_profit ?? 0) * ethUsd) : "Vault P&L"} tone={(stat?.net_profit ?? 0) >= 0 ? "win" : "loss"} />
              <AdminCell primary={`${formatEth(stat?.biggest_win ?? 0)} ETH`} secondary={ethUsd ? formatUsd((stat?.biggest_win ?? 0) * ethUsd) : "largest payout"} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AdminCell({ primary, secondary, tone }: { primary: string; secondary: string; tone?: "win" | "loss" }) {
  return (
    <div className="admin-cell">
      <div className={tone === "win" ? "text-[var(--win)]" : tone === "loss" ? "text-[var(--lose)]" : "text-[var(--text-1)]"}>{primary}</div>
      <span>{secondary}</span>
    </div>
  );
}
