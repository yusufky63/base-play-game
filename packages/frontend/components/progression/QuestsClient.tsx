"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Flame,
  Gift,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Trophy,
  Zap
} from "lucide-react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { type Abi, getAddress } from "viem";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { getContractAddress } from "@baseplay/shared/config/addresses";
import basePlayBadgesAbi from "@baseplay/shared/abis/BasePlayBadges.json";
import { WalletStatus } from "@/components/wallet/WalletStatus";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { mergeQuestRows, type QuestProgressItem, useQuestDefinitions } from "@/hooks/useQuestDefinitions";
import { getSupabaseBrowser } from "@/lib/supabase";
import { levelProgress } from "@/lib/progression";

type QuestView = "daily" | "weekly" | "completed";
type QuestBoard = "quests" | "badges";
type BadgeDefinition = Database["public"]["Tables"]["badge_definitions"]["Row"];

const badgeTimestamp = "1970-01-01T00:00:00.000Z";
const DEFAULT_BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: "first-round", title: "First Round", description: "Played your first settled BasePlay round.", category: "progression", token_id: 1, metadata_uri: "/badges/first-round.json", mint_ready: true, active: true, sort_order: 10, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "first-win", title: "First Win", description: "Won your first settled BasePlay round.", category: "progression", token_id: 2, metadata_uri: "/badges/first-win.json", mint_ready: true, active: true, sort_order: 20, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "ten-rounds", title: "10 Rounds", description: "Played 10 settled BasePlay rounds.", category: "progression", token_id: 3, metadata_uri: "/badges/ten-rounds.json", mint_ready: true, active: true, sort_order: 30, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "hundred-rounds", title: "100 Rounds", description: "Played 100 settled BasePlay rounds.", category: "progression", token_id: 4, metadata_uri: "/badges/hundred-rounds.json", mint_ready: true, active: true, sort_order: 40, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "seven-day-streak", title: "7-Day Streak", description: "Kept a seven day play streak.", category: "streak", token_id: 5, metadata_uri: "/badges/seven-day-streak.json", mint_ready: true, active: true, sort_order: 50, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "weekly-grinder", title: "Weekly Grinder", description: "Completed the weekly 10-round quest.", category: "quest", token_id: 6, metadata_uri: "/badges/weekly-grinder.json", mint_ready: true, active: true, sort_order: 60, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "game-explorer", title: "Game Explorer", description: "Played five different BasePlay games.", category: "quest", token_id: 7, metadata_uri: "/badges/game-explorer.json", mint_ready: true, active: true, sort_order: 70, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "referral-starter", title: "Referral Starter", description: "Invited a player into BasePlay.", category: "social", token_id: 8, metadata_uri: "/badges/referral-starter.json", mint_ready: true, active: true, sort_order: 80, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "big-win-5x", title: "Big Win 5x", description: "Hit a 5x or higher winning payout.", category: "win", token_id: 9, metadata_uri: "/badges/big-win-5x.json", mint_ready: true, active: true, sort_order: 90, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "lucky-draw-winner", title: "Lucky Draw Winner", description: "Won a prize from the on-chain Lucky Draw.", category: "promotional", token_id: 10, metadata_uri: "/badges/lucky-draw-winner.json", mint_ready: true, active: true, sort_order: 100, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "twenty-five-rounds", title: "25 Rounds", description: "Played 25 settled BasePlay rounds.", category: "progression", token_id: 11, metadata_uri: "/badges/twenty-five-rounds.json", mint_ready: true, active: true, sort_order: 110, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "fifty-rounds", title: "50 Rounds", description: "Played 50 settled BasePlay rounds.", category: "progression", token_id: 12, metadata_uri: "/badges/fifty-rounds.json", mint_ready: true, active: true, sort_order: 120, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "ten-wins", title: "10 Wins", description: "Won 10 settled BasePlay rounds.", category: "progression", token_id: 13, metadata_uri: "/badges/ten-wins.json", mint_ready: true, active: true, sort_order: 130, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "fifty-wins", title: "50 Wins", description: "Won 50 settled BasePlay rounds.", category: "progression", token_id: 14, metadata_uri: "/badges/fifty-wins.json", mint_ready: true, active: true, sort_order: 140, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "fourteen-day-streak", title: "14-Day Streak", description: "Kept a 14 day play streak.", category: "streak", token_id: 15, metadata_uri: "/badges/fourteen-day-streak.json", mint_ready: true, active: true, sort_order: 150, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "streak-builder", title: "Streak Builder", description: "Kept a three day play streak.", category: "streak", token_id: 16, metadata_uri: "/badges/streak-builder.json", mint_ready: true, active: true, sort_order: 160, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "daily-variety", title: "Daily Variety", description: "Played four different BasePlay games in one day.", category: "quest", token_id: 17, metadata_uri: "/badges/daily-variety.json", mint_ready: true, active: true, sort_order: 170, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "daily-sharpshooter", title: "Daily Sharpshooter", description: "Won three settled rounds in one day.", category: "quest", token_id: 18, metadata_uri: "/badges/daily-sharpshooter.json", mint_ready: true, active: true, sort_order: 180, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "weekly-striker", title: "Weekly Striker", description: "Won five settled rounds in one week.", category: "quest", token_id: 19, metadata_uri: "/badges/weekly-striker.json", mint_ready: true, active: true, sort_order: 190, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "weekly-marathon", title: "Weekly Marathon", description: "Completed a 50-round weekly quest.", category: "quest", token_id: 20, metadata_uri: "/badges/weekly-marathon.json", mint_ready: true, active: true, sort_order: 200, created_at: badgeTimestamp, updated_at: badgeTimestamp }
];

export function QuestsClient() {
  const account = useAccount();
  const address = account.address ? getAddress(account.address) : null;
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const definitions = useQuestDefinitions();
  const badgeDefinitions = useBadgeDefinitions();
  const profile = usePlayerProfile(address ? address.toLowerCase() : null, { includeQuests: true, includeBadges: true });
  const [view, setView] = useState<QuestView>("daily");
  const [board, setBoard] = useState<QuestBoard>("quests");
  const [claimingTokenId, setClaimingTokenId] = useState<number | null>(null);
  const [isBatchClaiming, setIsBatchClaiming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const badgesAddress = useMemo(() => {
    try {
      return getContractAddress(8453, "BasePlayBadges");
    } catch {
      return "0x1Ca9E82eBA7967295C3D77404af639B592C268eD" as `0x${string}`;
    }
  }, []);

  const quests = useMemo(
    () => mergeQuestRows(definitions.data ?? [], profile.data?.quests ?? []),
    [definitions.data, profile.data?.quests]
  );

  const daily = useMemo(() => quests.filter((quest) => quest.period === "daily"), [quests]);
  const weekly = useMemo(() => quests.filter((quest) => quest.period === "weekly"), [quests]);
  const completed = useMemo(() => quests.filter((quest) => quest.completed), [quests]);
  const visible = view === "daily" ? daily : view === "weekly" ? weekly : completed;

  const earnedBadges = profile.data?.badges ?? [];
  const allBadges = badgeDefinitions.data ?? [];
  const xp = profile.data?.stats.lifetime_xp ?? 0;
  const level = profile.data?.stats.level ?? 1;
  const progress = levelProgress(xp, level);

  const dailyDoneCount = daily.filter((q) => q.completed).length;
  const weeklyDoneCount = weekly.filter((q) => q.completed).length;

  // Query on-chain claimed badges for the connected wallet
  const onChainBadgesQuery = useQuery({
    queryKey: ["on-chain-badges", address, badgesAddress],
    queryFn: async () => {
      if (!address || !publicClient) return new Set<number>();
      try {
        const tokenIds = allBadges.map((b) => b.token_id).filter((id): id is number => typeof id === "number");
        if (tokenIds.length === 0) return new Set<number>();

        const contracts = tokenIds.map((tid) => ({
          address: badgesAddress,
          abi: basePlayBadgesAbi as Abi,
          functionName: "hasClaimed",
          args: [address, BigInt(tid)]
        }));

        const results = await publicClient.multicall({ contracts });
        const claimedSet = new Set<number>();
        results.forEach((res, idx) => {
          if (res.status === "success" && res.result === true) {
            claimedSet.add(tokenIds[idx]);
          }
        });
        return claimedSet;
      } catch (err) {
        console.warn("[QuestsClient] Failed to multicall on-chain badges:", err);
        return new Set<number>();
      }
    },
    enabled: Boolean(address && publicClient && allBadges.length > 0),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const onChainClaimedSet = onChainBadgesQuery.data ?? new Set<number>();

  async function fetchClaimSignature(payload: { address: string; tokenId?: number; tokenIds?: number[] }) {
    const backendBase = (process.env.NEXT_PUBLIC_BACKEND_URL || "https://game-contracts-production.up.railway.app").replace(/\/+$/, "");
    const endpoints = [
      "/api/badges/claim-signature",
      `${backendBase}/api/badges/claim-signature`
    ];

    let lastError = "Failed to obtain claim signature";
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => null);
        if (data && data.success) {
          return data;
        }
        if (data?.error) {
          lastError = data.error;
        }
      } catch (e: any) {
        lastError = e?.message || lastError;
      }
    }
    throw new Error(lastError);
  }

  // Claim single badge handler
  async function handleClaimBadge(tokenId: number) {
    if (!address) return;
    setActionError(null);
    setClaimingTokenId(tokenId);

    try {
      if (account.chainId !== 8453 && switchChainAsync) {
        await switchChainAsync({ chainId: 8453 });
      }

      const data = await fetchClaimSignature({ address, tokenId });

      const hash = await writeContractAsync({
        address: badgesAddress,
        abi: basePlayBadgesAbi as Abi,
        functionName: "claimBadge",
        args: [BigInt(tokenId), BigInt(data.deadline), data.signature]
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      await queryClient.invalidateQueries({ queryKey: ["on-chain-badges", address] });
    } catch (err: any) {
      console.error("[QuestsClient] Claim error:", err);
      setActionError(err?.shortMessage || err?.message || "Badge claim failed.");
    } finally {
      setClaimingTokenId(null);
    }
  }

  // Batch claim handler
  async function handleBatchClaim(unclaimedTokenIds: number[]) {
    if (!address || unclaimedTokenIds.length === 0) return;
    setActionError(null);
    setIsBatchClaiming(true);

    try {
      if (account.chainId !== 8453 && switchChainAsync) {
        await switchChainAsync({ chainId: 8453 });
      }

      const data = await fetchClaimSignature({ address, tokenIds: unclaimedTokenIds });

      const hash = await writeContractAsync({
        address: badgesAddress,
        abi: basePlayBadgesAbi as Abi,
        functionName: "claimBadgesBatch",
        args: [unclaimedTokenIds.map(BigInt), BigInt(data.deadline), data.signature]
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      await queryClient.invalidateQueries({ queryKey: ["on-chain-badges", address] });
    } catch (err: any) {
      console.error("[QuestsClient] Batch claim error:", err);
      setActionError(err?.shortMessage || err?.message || "Batch badge claim failed.");
    } finally {
      setIsBatchClaiming(false);
    }
  }

  // Find all earned badges that haven't been claimed on-chain yet
  const unmintedEarnedTokenIds = useMemo(() => {
    return earnedBadges
      .map((eb) => {
        const badgeDef = allBadges.find((b) => b.id === eb.badge_id);
        return badgeDef?.token_id;
      })
      .filter((id): id is number => typeof id === "number" && !onChainClaimedSet.has(id));
  }, [earnedBadges, allBadges, onChainClaimedSet]);

  return (
    <main className="quests-page mx-auto w-full max-w-7xl px-4 py-8 md:py-10">
      <section className="quests-hero">
        <div>
          <div className="quests-kicker">
            <Sparkles size={14} />
            <span>Progression & Rewards</span>
          </div>
          <h1 className="display-heading text-3xl font-bold text-[var(--text-1)] md:text-5xl">Quests & Badges</h1>
          <p>
            Complete daily and weekly goals to earn XP rewards and unlock exclusive collectible badges on Base. All progression is indexed from settled on-chain rounds.
          </p>
        </div>
        <div className="quests-hero-actions">
          <button
            type="button"
            onClick={() => {
              void definitions.refetch();
              void badgeDefinitions.refetch();
              void profile.refetch();
              void onChainBadgesQuery.refetch();
            }}
            className="control-shell inline-flex h-9 items-center gap-2 px-3 text-xs font-bold md:h-10"
          >
            <RefreshCw
              size={13}
              className={definitions.isFetching || badgeDefinitions.isFetching || profile.isFetching || onChainBadgesQuery.isFetching ? "animate-spin text-[var(--accent)]" : ""}
            />
            <span>Refresh</span>
          </button>
        </div>
      </section>

      {actionError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-400">
          {actionError}
        </div>
      )}

      {!address && (
        <section className="quests-connect panel">
          <div className="quests-connect-icon">
            <Gift size={22} />
          </div>
          <div className="quests-connect-content">
            <h2 className="text-base font-bold text-[var(--text-1)] md:text-lg">Connect wallet to track progression</h2>
            <p>
              Connect your wallet to earn XP, track completed daily and weekly quests, and claim collectible NFT badges on Base.
            </p>
            <div className="mt-3">
              <WalletStatus />
            </div>
          </div>
        </section>
      )}

      <section className="quests-summary-grid">
        <SummaryCard
          icon={<Zap size={16} />}
          label="Player Level"
          value={address ? `Level ${level}` : "Level 1"}
          detail={address ? `${xp} Lifetime XP` : "Connect to track"}
        />
        <SummaryCard
          icon={<Flame size={16} />}
          label="Next Level"
          value={address ? `${Math.round(progress.percent)}%` : "0%"}
          detail={address ? `${progress.current}/${progress.required} XP needed` : "Play to level up"}
        />
        <SummaryCard
          icon={<CheckCircle2 size={16} />}
          label="Quests Done"
          value={address ? `${completed.length}` : "0"}
          detail={address ? `${dailyDoneCount} daily · ${weeklyDoneCount} weekly` : "Active quests ready"}
          tone="win"
        />
        <SummaryCard
          icon={<BadgeCheck size={16} />}
          label="Badges Unlocked"
          value={address ? `${earnedBadges.length}` : "0"}
          detail={address ? `${onChainClaimedSet.size} claimed on Base` : "20 total available"}
          tone="win"
        />
      </section>

      <section className="quests-panel-card panel">
        <div className="quests-board-switch-wrap">
          <div className="quests-board-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={board === "quests"}
              onClick={() => setBoard("quests")}
              className={`quests-board-tab ${board === "quests" ? "quests-board-tab-active" : ""}`}
            >
              <div className="quests-board-tab-main">
                <Gift size={15} />
                <span>Quests Board</span>
              </div>
              <span className="quests-board-tab-badge">
                {completed.length} / {quests.length} Done
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={board === "badges"}
              onClick={() => setBoard("badges")}
              className={`quests-board-tab ${board === "badges" ? "quests-board-tab-active" : ""}`}
            >
              <div className="quests-board-tab-main">
                <BadgeCheck size={15} />
                <span>Badges Board</span>
              </div>
              <span className="quests-board-tab-badge">
                {earnedBadges.length} / {allBadges.length || DEFAULT_BADGE_DEFINITIONS.length} Earned
              </span>
            </button>
          </div>
        </div>

        {board === "quests" ? (
          <div className="quests-board">
            <div className="quests-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={view === "daily"}
                onClick={() => setView("daily")}
                className={`quests-tab ${view === "daily" ? "quests-tab-active" : ""}`}
              >
                <CalendarDays size={14} />
                <span className="quests-tab-label">Daily</span>
                <span className="quests-tab-count">{daily.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={view === "weekly"}
                onClick={() => setView("weekly")}
                className={`quests-tab ${view === "weekly" ? "quests-tab-active" : ""}`}
              >
                <Flame size={14} />
                <span className="quests-tab-label">Weekly</span>
                <span className="quests-tab-count">{weekly.length}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={view === "completed"}
                onClick={() => setView("completed")}
                className={`quests-tab quests-tab-complete ${view === "completed" ? "quests-tab-active" : ""}`}
              >
                <CheckCircle2 size={14} />
                <span className="quests-tab-label">Completed</span>
                <span className="quests-tab-count quests-tab-count-done">{completed.length}</span>
              </button>
            </div>

            <div className="quests-grid">
              {visible.map((quest) => (
                <QuestCard key={quest.quest_id} quest={quest} connected={Boolean(address)} />
              ))}

              {!definitions.isLoading && !profile.isLoading && visible.length === 0 && (
                <div className="quest-empty">
                  <div className="quest-empty-icon">
                    <Gift size={20} />
                  </div>
                  <strong>No quests in this section</strong>
                  <p>
                    {view === "completed"
                      ? "Complete daily or weekly goals to see your claimed rewards here."
                      : "Check back when the next quest cycle resets."}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="quests-badges-board">
            <div className="quests-section-head">
              <div>
                <div className="quests-kicker">
                  <BadgeCheck size={14} />
                  <span>On-Chain ERC-1155 Badges</span>
                </div>
                <h2 className="display-heading text-xl font-bold text-[var(--text-1)] md:text-2xl">Collectible NFT Badges</h2>
                <p className="quests-section-sub">
                  Badges represent major progression milestones. Earned badges can be claimed as on-chain ERC-1155 NFTs directly on Base.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {unmintedEarnedTokenIds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleBatchClaim(unmintedEarnedTokenIds)}
                    disabled={isBatchClaiming || claimingTokenId !== null}
                    className="quests-badge-batch-btn"
                  >
                    {isBatchClaiming ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>Claim All Ready ({unmintedEarnedTokenIds.length})</span>
                  </button>
                )}

                <div className="quests-badge-counter-pill">
                  <BadgeCheck size={14} />
                  <span>{earnedBadges.length} / {allBadges.length || DEFAULT_BADGE_DEFINITIONS.length} Earned</span>
                </div>
              </div>
            </div>

            <div className="quests-badge-grid">
              {allBadges.map((badge) => {
                const earned = earnedBadges.find((item) => item.badge_id === badge.id);
                const isClaimedOnChain = badge.token_id ? onChainClaimedSet.has(badge.token_id) : false;
                const isClaiming = badge.token_id ? claimingTokenId === badge.token_id : false;

                return (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    earned={earned}
                    isClaimedOnChain={isClaimedOnChain}
                    isClaiming={isClaiming}
                    badgesAddress={badgesAddress}
                    onClaim={() => badge.token_id && handleClaimBadge(badge.token_id)}
                  />
                );
              })}

              {!badgeDefinitions.isLoading && allBadges.length === 0 && (
                <div className="quest-empty">
                  <Trophy size={22} />
                  <strong>Badges are loading...</strong>
                  <span>Definitions will appear shortly.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function QuestCard({ quest, connected }: { quest: QuestProgressItem; connected: boolean }) {
  const percent = connected && quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;
  const currentProgress = connected ? Math.min(quest.progress, quest.target) : 0;
  const isDone = Boolean(quest.completed);

  return (
    <article className={`quest-card ${isDone ? "quest-card-complete" : ""}`}>
      <div className="quest-card-header">
        <div className="quest-card-header-left">
          <div className={`quest-card-icon ${isDone ? "quest-card-icon-done" : ""}`}>
            {isDone ? (
              <CheckCircle2 size={16} />
            ) : quest.period === "daily" ? (
              <CalendarDays size={16} />
            ) : (
              <Flame size={16} />
            )}
          </div>
          <div className="quest-card-titles">
            <h3 className="quest-card-title">{quest.title}</h3>
            <span className="quest-card-period-tag">{quest.period}</span>
          </div>
        </div>

        <div className="quest-card-status-wrap">
          {isDone ? (
            <span className="quest-status-badge quest-status-done">
              <CheckCircle2 size={12} />
              <span>Claimed</span>
            </span>
          ) : (
            <span className="quest-status-badge quest-status-active">
              <span>{connected ? `${Math.round(percent)}%` : "Active"}</span>
            </span>
          )}
        </div>
      </div>

      <p className="quest-card-desc">{quest.description}</p>

      <div className="quest-card-progress-section">
        <div className="quest-card-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <i
            className={`quest-card-track-fill ${isDone ? "quest-card-track-fill-done" : ""}`}
            style={{ width: `${isDone ? 100 : percent}%` }}
          />
        </div>
      </div>

      <div className="quest-card-footer">
        <div className="quest-card-progress-num">
          <span className="quest-card-label">Progress:</span>
          <strong>
            {connected ? `${currentProgress} / ${quest.target}` : `Target: ${quest.target}`}
          </strong>
        </div>

        <div className="quest-card-rewards">
          {quest.badge_id && (
            <span className={`quest-card-badge-pill ${isDone ? "quest-card-badge-pill-done" : ""}`} title="Unlocks a collectible badge">
              <BadgeCheck size={12} />
              <span>{isDone ? "Badge Unlocked" : "Badge"}</span>
            </span>
          )}

          <span className={`quest-card-xp-pill ${isDone ? "quest-card-xp-pill-done" : ""}`}>
            {isDone ? <CheckCircle2 size={12} /> : <Sparkles size={11} />}
            <span>{isDone ? `+${quest.reward_xp} XP Earned` : `+${quest.reward_xp} XP`}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

function BadgeCard({
  badge,
  earned,
  isClaimedOnChain,
  isClaiming,
  badgesAddress,
  onClaim
}: {
  badge: BadgeDefinition;
  earned?: any;
  isClaimedOnChain?: boolean;
  isClaiming?: boolean;
  badgesAddress?: string;
  onClaim?: () => void;
}) {
  const isEarned = Boolean(earned);

  return (
    <article className={`quests-badge-card ${isEarned ? "quests-badge-earned" : "quests-badge-locked"}`}>
      <div className="quests-badge-top">
        <div className="quests-badge-emblem">
          {isEarned ? <BadgeCheck size={20} /> : <LockKeyhole size={18} />}
        </div>
        <div className="quests-badge-meta-pills">
          {badge.token_id && (
            <span className="quests-badge-token-id">#{String(badge.token_id).padStart(2, "0")}</span>
          )}
          <span className={`quests-badge-state ${isEarned ? "quests-badge-state-earned" : "quests-badge-state-locked"}`}>
            {isEarned ? <CheckCircle2 size={11} /> : <LockKeyhole size={11} />}
            <span>{isEarned ? "Earned" : "Locked"}</span>
          </span>
        </div>
      </div>

      <div className="quests-badge-body">
        <h3 className="quests-badge-title">{badge.title}</h3>
        <p className="quests-badge-desc">{badge.description}</p>
      </div>

      <div className="quests-badge-footer">
        <span className="quests-badge-category">{badge.category}</span>

        {isEarned ? (
          isClaimedOnChain ? (
            <a
              href={`https://basescan.org/token/${badgesAddress}?a=${badge.token_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="quests-badge-claimed-link"
              title="View your NFT on BaseScan"
            >
              <CheckCircle2 size={11} />
              <span>NFT Claimed</span>
              <ExternalLink size={10} />
            </a>
          ) : (
            <button
              type="button"
              onClick={onClaim}
              disabled={isClaiming}
              className="quests-badge-claim-btn"
            >
              {isClaiming ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              <span>{isClaiming ? "Claiming..." : "Claim NFT"}</span>
            </button>
          )
        ) : (
          <span className="quests-badge-nft-status quests-badge-nft-locked">
            <span>Play to Unlock</span>
          </span>
        )}
      </div>
    </article>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: "win" | "accent";
}) {
  return (
    <div className={`quests-summary-card ${tone === "win" ? "quests-summary-card-win" : ""}`}>
      <div className="quests-summary-card-top">
        {icon}
        <span>{label}</span>
      </div>
      <strong className="quests-summary-card-value">{value}</strong>
      {detail && <small className="quests-summary-card-detail">{detail}</small>}
    </div>
  );
}

function useBadgeDefinitions() {
  return useQuery({
    queryKey: ["badge-definitions"],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) return DEFAULT_BADGE_DEFINITIONS;
      const { data, error } = await supabase
        .from("badge_definitions")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.warn("[BasePlay] Badge definitions query failed", error.message);
        return DEFAULT_BADGE_DEFINITIONS;
      }
      return data?.length ? (data as BadgeDefinition[]) : DEFAULT_BADGE_DEFINITIONS;
    },
    staleTime: 30 * 60_000,
    gcTime: 3 * 60 * 60_000,
    refetchOnWindowFocus: false
  });
}
