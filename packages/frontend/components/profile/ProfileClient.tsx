"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { Activity, BadgeCheck, Clipboard, Flame, Gift, RefreshCw, Sparkles, Trophy, Users, WalletCards } from "lucide-react";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { useEthUsdPrice } from "@/hooks/useEthUsdPrice";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { usePlayerRounds } from "@/hooks/usePlayerRounds";
import { useClaimReferral, useReferralSummary } from "@/hooks/useReferral";
import { formatEth, formatUsd, shortenAddress } from "@/lib/formatters";
import { levelProgress } from "@/lib/progression";
import { PendingRoundsPanel } from "@/components/wallet/PendingRoundsPanel";
import { useToast } from "@/components/ui/ToastProvider";

const gameNames = Object.fromEntries(GAMES_REGISTRY.map((game) => [game.id, game.name]));
type ProfileTab = "profile" | "games" | "rounds" | "badges" | "referrals" | "refunds";

export function ProfileClient({ address }: { address: string }) {
  const account = useAccount();
  const validAddress = isAddress(address) ? address : null;
  const profile = usePlayerProfile(validAddress);
  const referralSummary = useReferralSummary(validAddress);
  const claimReferral = useClaimReferral();
  const rounds = usePlayerRounds(validAddress, 8);
  const ethUsd = useEthUsdPrice();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [roundPageIndex, setRoundPageIndex] = useState(0);
  const [manualReferrer, setManualReferrer] = useState("");
  const data = profile.data;
  const stats = data?.stats;
  const roundPages = rounds.data?.pages ?? [];
  const currentRoundRows = roundPages[roundPageIndex]?.rows ?? [];
  const xp = stats?.lifetime_xp ?? 0;
  const level = stats?.level ?? 1;
  const progress = levelProgress(xp, level);
  const totalRounds = stats?.total_rounds ?? 0;
  const winRate = totalRounds > 0 && data ? (data.wins / totalRounds) * 100 : 0;
  const isConnectedProfile = Boolean(account.address && validAddress && account.address.toLowerCase() === validAddress.toLowerCase());
  const profileTabs: Array<{ id: ProfileTab; label: string; detail: string }> = [
    { id: "profile", label: "Profile", detail: `Lv ${level}` },
    { id: "games", label: "Games", detail: `${data?.gameStats.length ?? 0} played` },
    { id: "rounds", label: "Rounds", detail: `${roundPages.reduce((count, page) => count + page.rows.length, 0)} loaded` },
    { id: "badges", label: "Badges", detail: `${data?.badges.length ?? 0} earned` },
    { id: "referrals", label: "Referrals", detail: `${referralSummary.data?.totalReferrals ?? 0} invited` },
    ...(isConnectedProfile ? [{ id: "refunds" as const, label: "Refunds", detail: "Active rounds" }] : [])
  ];

  useEffect(() => {
    setRoundPageIndex(0);
  }, [validAddress]);

  useEffect(() => {
    if (!isConnectedProfile && activeTab === "refunds") {
      setActiveTab("profile");
    }
  }, [activeTab, isConnectedProfile]);

  async function goNextRoundPage() {
    if (roundPageIndex + 1 < roundPages.length) {
      setRoundPageIndex((current) => Math.min(current + 1, roundPages.length - 1));
      return;
    }

    if (rounds.hasNextPage && !rounds.isFetchingNextPage) {
      const nextIndex = roundPages.length;
      await rounds.fetchNextPage();
      setRoundPageIndex(nextIndex);
    }
  }

  async function copyReferralUrl() {
    const path = referralSummary.data?.referralUrlPath;
    if (!path) return;
    const origin = window.location.origin;
    await navigator.clipboard?.writeText(`${origin}${path}`);
    toast({ tone: "success", title: "Referral link copied" });
  }

  async function claimManualReferral() {
    const result = await claimReferral.claim(manualReferrer);
    if (result) {
      setManualReferrer("");
      void referralSummary.refetch();
    }
  }

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
        <button type="button" onClick={() => { setRoundPageIndex(0); void profile.refetch(); void rounds.refetch(); }} className="control-shell flex items-center gap-2 px-3 text-xs font-bold">
          <RefreshCw size={13} className={profile.isFetching || rounds.isFetching ? "animate-spin text-[var(--accent)]" : ""} />
          Refresh
        </button>
      </div>

      <section className="profile-tab-shell">
        <div className="profile-tabs" role="tablist" aria-label="Profile sections">
          {profileTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`profile-tab ${activeTab === tab.id ? "profile-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              <small>{tab.detail}</small>
            </button>
          ))}
        </div>

        {activeTab === "profile" && (
          <div className="profile-tab-panel profile-tab-panel-flat">
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
          </div>
        )}

        {activeTab === "games" && (
          <div className="profile-tab-panel">
            <div className="profile-panel-heading">
              <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">Played games</h2>
              <span>{data?.gameStats.length ?? 0} games</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {(data?.gameStats ?? []).map((game) => (
                <div key={`${game.game_id}-${game.chain_id}`} className="profile-list-row">
                  <div>
                    <Link href={`/games/${game.game_id}`} className="font-bold text-[var(--text-1)] hover:text-[var(--accent)]">
                      {gameNames[game.game_id] ?? game.game_id}
                    </Link>
                    <div className="mt-1 text-xs text-[var(--text-3)]">{game.wins} wins / {game.losses} losses</div>
                  </div>
                  <div className={`profile-row-value ${game.net_profit >= 0 ? "text-[var(--win)]" : "text-[var(--lose)]"}`}>
                    {game.net_profit >= 0 ? "+" : ""}{formatEth(game.net_profit)} ETH
                    <span>{game.total_rounds} rounds</span>
                  </div>
                </div>
              ))}
              {profile.isLoading && <div className="px-4 py-5 text-sm text-[var(--text-3)]">Loading game stats...</div>}
              {!profile.isLoading && (data?.gameStats.length ?? 0) === 0 && <div className="px-4 py-5 text-sm text-[var(--text-3)]">No played games yet.</div>}
            </div>
          </div>
        )}

        {activeTab === "rounds" && (
          <div className="profile-tab-panel">
            <div className="profile-panel-heading">
              <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">Recent rounds</h2>
              <span>Page {roundPages.length > 0 ? roundPageIndex + 1 : 0}</span>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {currentRoundRows.map((row) => {
                const net = Number(row.payout) - Number(row.bet_amount);
                return (
                  <div key={row.id} className="profile-list-row">
                    <div>
                      <Link href={`/games/${row.game_id}`} className="font-bold text-[var(--text-1)] hover:text-[var(--accent)]">
                        {gameNames[row.game_id] ?? row.game_id}
                      </Link>
                      <div className="mt-1 font-mono text-[11px] text-[var(--text-3)]">{new Date(row.settled_at).toLocaleString()}</div>
                    </div>
                    <div className={`profile-row-value ${net >= 0 ? "text-[var(--win)]" : "text-[var(--lose)]"}`}>
                      {net >= 0 ? "+" : ""}{formatEth(net)} ETH
                      <span>{row.won ? "Win" : "Loss"}</span>
                    </div>
                  </div>
                );
              })}
              {rounds.isLoading && <div className="px-4 py-5 text-sm text-[var(--text-3)]">Loading rounds...</div>}
              {!rounds.isLoading && currentRoundRows.length === 0 && <div className="px-4 py-5 text-sm text-[var(--text-3)]">No settled rounds yet.</div>}
            </div>
            <div className="profile-pagination">
              <button type="button" onClick={() => setRoundPageIndex((current) => Math.max(0, current - 1))} disabled={roundPageIndex === 0} className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold disabled:opacity-45">
                Previous
              </button>
              <span>{roundPages.length > 0 ? `${roundPageIndex + 1} / ${Math.max(roundPages.length, roundPageIndex + 1)}` : "0 / 0"}</span>
              <button type="button" onClick={() => void goNextRoundPage()} disabled={rounds.isFetchingNextPage || (roundPageIndex + 1 >= roundPages.length && !rounds.hasNextPage)} className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold disabled:opacity-45">
                {rounds.isFetchingNextPage ? "Loading..." : "Next"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "badges" && (
          <div className="profile-tab-panel">
            <div className="profile-panel-heading">
              <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">Badges</h2>
              <span>Off-chain now, mint-ready later</span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.badges ?? []).map((badge) => (
                <div key={badge.badge_id} className="badge-card">
                  <div className="badge-card-icon">
                    <BadgeCheck size={20} />
                  </div>
                  <div className="mt-3 font-bold text-[var(--text-1)]">{badge.title}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">{badge.description}</p>
                  <div className="mt-3 font-mono text-[10px] uppercase text-[var(--text-3)]">{new Date(badge.awarded_at).toLocaleDateString()}</div>
                </div>
              ))}
              {!profile.isLoading && (data?.badges.length ?? 0) === 0 && <div className="text-sm text-[var(--text-3)]">No badges earned yet.</div>}
            </div>
          </div>
        )}

        {activeTab === "referrals" && (
          <div className="profile-tab-panel">
            <div className="profile-panel-heading">
              <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">Referrals</h2>
              <span>{referralSummary.data?.totalXp ?? 0} XP earned</span>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="progression-card">
                <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
                  <Gift size={14} className="text-[var(--accent)]" />
                  Your invite link
                </div>
                <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--text-1)]">
                  {referralSummary.data?.referralUrlPath ? `${typeof window === "undefined" ? "" : window.location.origin}${referralSummary.data.referralUrlPath}` : "Loading referral link..."}
                </div>
                <button type="button" onClick={() => void copyReferralUrl()} disabled={!referralSummary.data?.referralUrlPath} className="mt-3 primary-action inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold text-white disabled:opacity-45">
                  <Clipboard size={14} />
                  Copy link
                </button>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Metric label="Invites" value={String(referralSummary.data?.totalReferrals ?? 0)} />
                  <Metric label="Active" value={String(referralSummary.data?.activeReferrals ?? 0)} />
                  <Metric label="Today" value={`${referralSummary.data?.dailyXp ?? 0} XP`} />
                </div>
              </div>

              <div className="progression-card">
                <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">
                  <Users size={14} className="text-[var(--accent)]" />
                  Link a referrer
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--text-2)]">If you opened BasePlay from a referral but skipped the wallet signature, link it here. A wallet can only be linked once.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={manualReferrer}
                    onChange={(event) => setManualReferrer(event.target.value)}
                    placeholder="0x address or referral code"
                    className="h-10 min-w-0 flex-1 rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-3 font-mono text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                  />
                  <button type="button" disabled={!isConnectedProfile || claimReferral.isPending || !manualReferrer} onClick={() => void claimManualReferral()} className="play-button-ghost h-10 rounded-md px-4 text-sm font-bold disabled:opacity-45">
                    {claimReferral.isPending ? "Signing..." : "Link"}
                  </button>
                </div>
                <div className="mt-4 divide-y divide-[var(--border)]">
                  {(referralSummary.data?.recentRewards ?? []).slice(0, 5).map((reward) => (
                    <div key={reward.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-mono text-xs text-[var(--text-2)]">{shortenAddress(reward.referred_player, 5)}</span>
                      <span className="font-mono text-xs font-bold text-[var(--accent)]">+{reward.xp_awarded} XP</span>
                    </div>
                  ))}
                  {!referralSummary.isLoading && (referralSummary.data?.recentRewards.length ?? 0) === 0 && <div className="py-3 text-sm text-[var(--text-3)]">No referral rewards yet.</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "refunds" && isConnectedProfile && (
          <div className="profile-tab-panel">
            <div className="profile-panel-heading">
              <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">Pending refunds</h2>
              <span>Connected wallet</span>
            </div>
            <div className="border-b border-[var(--border)] px-4 py-3 text-sm leading-6 text-[var(--text-2)]">
              Refund center scans active on-chain rounds after reconnecting. If a VRF round times out while the tab is closed, the claim action appears here and in the wallet menu for the same wallet.
            </div>
            <PendingRoundsPanel embedded />
          </div>
        )}
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
