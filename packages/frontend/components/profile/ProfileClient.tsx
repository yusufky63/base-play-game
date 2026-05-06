"use client";

import Link from "next/link";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { Activity, Flame, RefreshCw, Sparkles, Trophy, WalletCards } from "lucide-react";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { usePlayerRounds } from "@/hooks/usePlayerRounds";
import { formatEth, formatUsd, shortenAddress } from "@/lib/formatters";
import { levelProgress } from "@/lib/progression";
import { PendingRoundsPanel } from "@/components/wallet/PendingRoundsPanel";

const gameNames = Object.fromEntries(GAMES_REGISTRY.map((game) => [game.id, game.name]));

export function ProfileClient({ address }: { address: string }) {
  const account = useAccount();
  const validAddress = isAddress(address) ? address : null;
  const profile = usePlayerProfile(validAddress);
  const rounds = usePlayerRounds(validAddress, 20);
  const ethUsd = useEthUsdPrice();
  const data = profile.data;
  const stats = data?.stats;
  const rows = rounds.data?.pages.flatMap((page) => page.rows) ?? [];
  const xp = stats?.lifetime_xp ?? 0;
  const level = stats?.level ?? 1;
  const progress = levelProgress(xp, level);
  const totalRounds = stats?.total_rounds ?? 0;
  const winRate = totalRounds > 0 && data ? (data.wins / totalRounds) * 100 : 0;
  const isConnectedProfile = Boolean(account.address && validAddress && account.address.toLowerCase() === validAddress.toLowerCase());

  if (!validAddress) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="panel p-6 text-sm text-[var(--text-2)]">Invalid profile address.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-7 flex flex-col gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 font-mono text-xs text-[var(--text-3)]">
            <WalletCards size={14} className="text-[var(--accent)]" />
            <span>{shortenAddress(validAddress)}</span>
          </div>
          <h1 className="display-heading text-4xl font-bold text-[var(--text-1)]">
            <BasenameLabel address={validAddress as `0x${string}`} chars={5} />
          </h1>
          <p className="mt-2 text-sm text-[var(--text-2)]">Public player stats, XP, streaks, and recent rounds.</p>
        </div>
        <button type="button" onClick={() => { void profile.refetch(); void rounds.refetch(); }} className="control-shell flex items-center gap-2 px-3 text-xs font-bold">
          <RefreshCw size={13} className={profile.isFetching || rounds.isFetching ? "animate-spin text-[var(--accent)]" : ""} />
          Refresh
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="profile-hero panel p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase text-[var(--text-3)]">
                <Sparkles size={14} className="text-[var(--accent)]" />
                Level {level}
              </div>
              <div className="mt-2 display-heading text-5xl font-bold text-[var(--text-1)]">{xp} XP</div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress.percent}%` }} />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-[var(--text-3)]">
                <span>{progress.current} current</span>
                <span>{progress.required} to next level band</span>
              </div>
            </div>
            <div className="profile-streak">
              <Flame size={22} />
              <strong>{stats?.current_streak ?? 0}d</strong>
              <span>current streak</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Metric icon={<Activity size={17} />} label="Rounds" value={String(totalRounds)} />
          <Metric icon={<Trophy size={17} />} label="Win rate" value={`${winRate.toFixed(1)}%`} />
          <Metric label="Net profit" value={`${(stats?.net_profit ?? 0) >= 0 ? "+" : ""}${formatEth(stats?.net_profit ?? 0)} ETH`} tone={(stats?.net_profit ?? 0) >= 0 ? "win" : "loss"} />
          <Metric label="Volume" value={`${formatEth(stats?.total_wagered ?? 0)} ETH`} detail={ethUsd ? formatUsd((stats?.total_wagered ?? 0) * ethUsd) : undefined} />
          <Metric label="XP rank" value={data?.weekly?.xp_rank ? `#${data.weekly.xp_rank}` : "-"} />
          <Metric label="Profit rank" value={data?.weekly?.profit_rank ? `#${data.weekly.profit_rank}` : "-"} />
        </div>
      </section>

      {isConnectedProfile && (
        <section className="mt-4">
          <div className="mb-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-6 text-[var(--text-2)]">
            Refund center scans your active on-chain rounds after reconnecting. If a VRF round times out while the tab is closed, the claim action appears here and in the wallet menu for the same wallet.
          </div>
          <PendingRoundsPanel />
        </section>
      )}

      <section className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">Played games</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {(data?.gameStats ?? []).map((game) => (
              <div key={`${game.game_id}-${game.chain_id}`} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm">
                <div>
                  <Link href={`/games/${game.game_id}`} className="font-bold text-[var(--text-1)] hover:text-[var(--accent)]">
                    {gameNames[game.game_id] ?? game.game_id}
                  </Link>
                  <div className="mt-1 text-xs text-[var(--text-3)]">{game.wins} wins / {game.losses} losses</div>
                </div>
                <div className={`text-right font-mono text-xs ${game.net_profit >= 0 ? "text-[var(--win)]" : "text-[var(--lose)]"}`}>
                  {game.net_profit >= 0 ? "+" : ""}{formatEth(game.net_profit)} ETH
                  <span className="mt-1 block text-[var(--text-3)]">{game.total_rounds} rounds</span>
                </div>
              </div>
            ))}
            {profile.isLoading && <div className="px-4 py-5 text-sm text-[var(--text-3)]">Loading game stats...</div>}
            {!profile.isLoading && (data?.gameStats.length ?? 0) === 0 && <div className="px-4 py-5 text-sm text-[var(--text-3)]">No played games yet.</div>}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">Recent rounds</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {rows.map((row) => {
              const net = Number(row.payout) - Number(row.bet_amount);
              return (
                <div key={row.id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 text-sm">
                  <div>
                    <Link href={`/games/${row.game_id}`} className="font-bold text-[var(--text-1)] hover:text-[var(--accent)]">
                      {gameNames[row.game_id] ?? row.game_id}
                    </Link>
                    <div className="mt-1 font-mono text-[11px] text-[var(--text-3)]">{new Date(row.settled_at).toLocaleString()}</div>
                  </div>
                  <div className={`text-right font-mono text-xs ${net >= 0 ? "text-[var(--win)]" : "text-[var(--lose)]"}`}>
                    {net >= 0 ? "+" : ""}{formatEth(net)} ETH
                    <span className="mt-1 block text-[var(--text-3)]">{row.won ? "Win" : "Loss"}</span>
                  </div>
                </div>
              );
            })}
            {rounds.isLoading && <div className="px-4 py-5 text-sm text-[var(--text-3)]">Loading rounds...</div>}
            {!rounds.isLoading && rows.length === 0 && <div className="px-4 py-5 text-sm text-[var(--text-3)]">No settled rounds yet.</div>}
          </div>
          {rounds.hasNextPage && (
            <div className="border-t border-[var(--border)] p-4 text-center">
              <button type="button" onClick={() => void rounds.fetchNextPage()} disabled={rounds.isFetchingNextPage} className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold disabled:opacity-50">
                {rounds.isFetchingNextPage ? "Loading..." : "Load older"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: string; detail?: string; icon?: React.ReactNode; tone?: "win" | "loss" }) {
  return (
    <div className="profile-metric panel p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-[var(--text-3)]">
        {icon}
        {label}
      </div>
      <div className={`mt-2 font-mono text-sm font-bold ${tone === "win" ? "text-[var(--win)]" : tone === "loss" ? "text-[var(--lose)]" : "text-[var(--text-1)]"}`}>{value}</div>
      {detail && <div className="mt-1 font-mono text-[10px] text-[var(--text-3)]">{detail}</div>}
    </div>
  );
}
