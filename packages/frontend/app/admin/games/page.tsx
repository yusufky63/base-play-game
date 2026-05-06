"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, fallback, http } from "viem";
import { useWriteContract } from "wagmi";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/ui/ToastProvider";
import { getDefaultNetworkConfig } from "@/lib/networkConfig";

const defaultNetwork = getDefaultNetworkConfig();
const deployedGameNames = new Set(Object.keys(CONTRACT_ADDRESSES[defaultNetwork.chainId] ?? {}));
type StatusFilter = "all" | "deployed" | "not-deployed";

const gameAdminAbi = [
  { type: "function", name: "gamePaused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "setGamePaused", stateMutability: "nonpayable", inputs: [{ type: "bool", name: "paused" }], outputs: [] }
] as const;

export default function AdminGamesPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [pausedByGame, setPausedByGame] = useState<Record<string, boolean>>({});
  const toast = useToast();
  const { writeContractAsync, isPending } = useWriteContract();
  const games = useMemo(
    () =>
      GAMES_REGISTRY.filter((game) => {
        const deployed = game.active && deployedGameNames.has(game.contractName);
        if (status === "deployed") return deployed;
        if (status === "not-deployed") return !deployed;
        return true;
      }),
    [status]
  );

  useEffect(() => {
    let mounted = true;
    const client = createPublicClient({
      chain: defaultNetwork.viemChain,
      transport: fallback(defaultNetwork.rpcUrls.map((url) => http(url, { timeout: 10_000 })))
    });

    async function loadPausedStates() {
      const entries = await Promise.all(
        GAMES_REGISTRY.map(async (game) => {
          const address = CONTRACT_ADDRESSES[defaultNetwork.chainId]?.[game.contractName];
          if (!address) return [game.id, false] as const;
          const paused = await client.readContract({ address, abi: gameAdminAbi, functionName: "gamePaused" }).catch(() => false);
          return [game.id, Boolean(paused)] as const;
        })
      );

      if (mounted) setPausedByGame(Object.fromEntries(entries));
    }

    void loadPausedStates();

    return () => {
      mounted = false;
    };
  }, []);

  async function setPaused(gameId: string, contractName: string, paused: boolean) {
    const address = CONTRACT_ADDRESSES[defaultNetwork.chainId]?.[contractName];
    if (!address) return;

    try {
      const hash = await writeContractAsync({
        address,
        abi: gameAdminAbi,
        functionName: "setGamePaused",
        args: [paused]
      });
      setPausedByGame((current) => ({ ...current, [gameId]: paused }));
      toast({ tone: "success", title: paused ? "Game paused" : "Game unpaused", description: hash });
    } catch (error) {
      toast({ tone: "error", title: "Game control failed", description: error instanceof Error ? error.message : undefined });
    }
  }

  return (
    <AdminShell title="Game Controls" description="Configured games, deployment state, and bet limits.">
      <div className="mb-4 admin-note">
        <h2 className="font-semibold text-[var(--text-1)]">Pause behavior</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          Game pause disables new wagers only for that game. Existing pending VRF rounds can still settle, and timed-out rounds can still be claimed as refunds. Vault pause is broader: it disables new wagers across every approved game and is required before full emergency withdraw.
        </p>
      </div>

      <div className="mb-3 flex justify-end">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          className="h-10 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
          aria-label="Filter games"
        >
          <option value="all">All games</option>
          <option value="deployed">Deployed</option>
          <option value="not-deployed">Not deployed</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid grid-cols-[1fr_90px_90px_110px_120px] gap-3 border-b border-[var(--border)] px-4 py-3 text-xs text-[var(--text-3)]">
          <span>Game</span>
          <span className="text-right">Min</span>
          <span className="text-right">Max</span>
          <span className="text-right">Status</span>
          <span className="text-right">Control</span>
        </div>
        {games.map((game) => {
          const deployed = game.active && deployedGameNames.has(game.contractName);
          const paused = Boolean(pausedByGame[game.id]);
          return (
            <div key={game.id} className="grid grid-cols-[1fr_90px_90px_110px_120px] gap-3 border-b border-[var(--border)] px-4 py-4 text-sm last:border-b-0">
              <div className="min-w-0">
                <div className="font-medium text-[var(--text-1)]">{game.name}</div>
                <div className="mt-1 truncate font-mono text-[11px] text-[var(--text-3)]">{CONTRACT_ADDRESSES[defaultNetwork.chainId]?.[game.contractName] ?? "No address"}</div>
              </div>
              <span className="text-right font-mono text-[var(--text-2)]">{game.minBetEth}</span>
              <span className="text-right font-mono text-[var(--text-2)]">{game.maxBetEth}</span>
              <span className={`text-right ${deployed ? paused ? "text-[var(--pending)]" : "text-[var(--win)]" : "text-[var(--text-3)]"}`}>{deployed ? paused ? "Paused" : "Live" : "Disabled"}</span>
              <span className="text-right">
                <button
                  type="button"
                  disabled={!deployed || isPending}
                  onClick={() => void setPaused(game.id, game.contractName, !paused)}
                  className="play-button-ghost h-9 rounded-md px-3 text-xs font-bold disabled:opacity-45"
                >
                  {paused ? "Unpause" : "Pause"}
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}
