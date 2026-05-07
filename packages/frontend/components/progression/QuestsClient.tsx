"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CalendarDays, CheckCircle2, Flame, Gift, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { useAccount } from "wagmi";
import type { Database } from "@baseplay/shared/types/supabase.types";
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
  { id: "first-round", title: "First Round", description: "Played your first settled BasePlay round.", category: "progression", token_id: 1, metadata_uri: "/badges/first-round.json", mint_ready: false, active: true, sort_order: 10, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "first-win", title: "First Win", description: "Won your first settled BasePlay round.", category: "progression", token_id: 2, metadata_uri: "/badges/first-win.json", mint_ready: false, active: true, sort_order: 20, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "ten-rounds", title: "10 Rounds", description: "Played 10 settled BasePlay rounds.", category: "progression", token_id: 3, metadata_uri: "/badges/ten-rounds.json", mint_ready: false, active: true, sort_order: 30, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "hundred-rounds", title: "100 Rounds", description: "Played 100 settled BasePlay rounds.", category: "progression", token_id: 4, metadata_uri: "/badges/hundred-rounds.json", mint_ready: false, active: true, sort_order: 40, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "seven-day-streak", title: "7-Day Streak", description: "Kept a seven day play streak.", category: "streak", token_id: 5, metadata_uri: "/badges/seven-day-streak.json", mint_ready: false, active: true, sort_order: 50, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "weekly-grinder", title: "Weekly Grinder", description: "Completed the weekly 10-round quest.", category: "quest", token_id: 6, metadata_uri: "/badges/weekly-grinder.json", mint_ready: false, active: true, sort_order: 60, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "game-explorer", title: "Game Explorer", description: "Played five different BasePlay games.", category: "quest", token_id: 7, metadata_uri: "/badges/game-explorer.json", mint_ready: false, active: true, sort_order: 70, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "referral-starter", title: "Referral Starter", description: "Invited a player into BasePlay.", category: "social", token_id: 8, metadata_uri: "/badges/referral-starter.json", mint_ready: false, active: true, sort_order: 80, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "big-win-5x", title: "Big Win 5x", description: "Hit a 5x or higher winning payout.", category: "win", token_id: 9, metadata_uri: "/badges/big-win-5x.json", mint_ready: false, active: true, sort_order: 90, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "daily-climber", title: "Daily Climber", description: "Completed a 10-round daily quest.", category: "quest", token_id: 10, metadata_uri: "/badges/daily-climber.json", mint_ready: false, active: true, sort_order: 100, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "daily-explorer", title: "Daily Explorer", description: "Played five different BasePlay games in one day.", category: "quest", token_id: 11, metadata_uri: "/badges/daily-explorer.json", mint_ready: false, active: true, sort_order: 110, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "five-wins", title: "Five Wins", description: "Won five settled BasePlay rounds.", category: "win", token_id: 12, metadata_uri: "/badges/five-wins.json", mint_ready: false, active: true, sort_order: 120, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "twenty-five-rounds", title: "25 Rounds", description: "Played 25 settled BasePlay rounds.", category: "progression", token_id: 13, metadata_uri: "/badges/twenty-five-rounds.json", mint_ready: false, active: true, sort_order: 130, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "weekly-winner", title: "Weekly Winner", description: "Completed the weekly 10-win quest.", category: "quest", token_id: 14, metadata_uri: "/badges/weekly-winner.json", mint_ready: false, active: true, sort_order: 140, created_at: badgeTimestamp, updated_at: badgeTimestamp },
  { id: "wide-board", title: "Wide Board", description: "Played eight different BasePlay games in one week.", category: "quest", token_id: 15, metadata_uri: "/badges/wide-board.json", mint_ready: false, active: true, sort_order: 150, created_at: badgeTimestamp, updated_at: badgeTimestamp }
];

export function QuestsClient() {
  const account = useAccount();
  const address = account.address?.toLowerCase() ?? null;
  const definitions = useQuestDefinitions();
  const badgeDefinitions = useBadgeDefinitions();
  const profile = usePlayerProfile(address);
  const [view, setView] = useState<QuestView>("daily");
  const [board, setBoard] = useState<QuestBoard>("quests");
  const quests = useMemo(
    () => mergeQuestRows(definitions.data ?? [], profile.data?.quests ?? []),
    [definitions.data, profile.data?.quests]
  );
  const daily = quests.filter((quest) => quest.period === "daily");
  const weekly = quests.filter((quest) => quest.period === "weekly");
  const completed = quests.filter((quest) => quest.completed);
  const visible = view === "daily" ? daily : view === "weekly" ? weekly : completed;
  const earnedBadges = profile.data?.badges ?? [];
  const xp = profile.data?.stats.lifetime_xp ?? 0;
  const level = profile.data?.stats.level ?? 1;
  const progress = levelProgress(xp, level);
  const isLoading = definitions.isLoading || profile.isLoading;

  return (
    <main className="quests-page mx-auto w-full max-w-7xl px-4 py-10">
      <section className="quests-hero">
        <div>
          <div className="quests-kicker">
            <Sparkles size={15} />
            Progression
          </div>
          <h1 className="display-heading text-4xl font-bold text-[var(--text-1)] md:text-5xl">Quests</h1>
          <p>
            Daily and weekly goals give XP and badge progress without changing game odds or payouts. Only settled on-chain rounds count.
          </p>
        </div>
        <div className="quests-hero-actions">
          <button
            type="button"
            onClick={() => {
              void definitions.refetch();
              void badgeDefinitions.refetch();
              void profile.refetch();
            }}
            className="control-shell inline-flex h-10 items-center gap-2 px-3 text-xs font-bold"
          >
            <RefreshCw size={13} className={definitions.isFetching || badgeDefinitions.isFetching || profile.isFetching ? "animate-spin text-[var(--accent)]" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {!address && (
        <section className="quests-connect panel">
          <div className="quests-connect-icon">
            <Gift size={22} />
          </div>
          <div>
            <h2 className="display-heading text-2xl font-bold text-[var(--text-1)]">Connect to track quests</h2>
            <p>Quest and badge rules are visible below. Connect your wallet to see live progress, completed rewards, and earned badges.</p>
            <div className="mt-4">
              <WalletStatus />
            </div>
          </div>
        </section>
      )}

      {address && (
        <section className="quests-summary-grid">
          <SummaryCard icon={<Sparkles size={17} />} label="Level" value={String(level)} detail={`${progress.percent.toFixed(0)}% to next`} />
          <SummaryCard icon={<CalendarDays size={17} />} label="Daily done" value={`${daily.filter((quest) => quest.completed).length}/${daily.length}`} />
          <SummaryCard icon={<Trophy size={17} />} label="Weekly done" value={`${weekly.filter((quest) => quest.completed).length}/${weekly.length}`} />
          <SummaryCard icon={<BadgeCheck size={17} />} label="Badges" value={String(earnedBadges.length)} detail="Shown on profile" />
        </section>
      )}

      <section className="quests-panel-card panel">
        <div className="quests-board-switch" role="tablist" aria-label="Progression sections">
          {[
            { id: "quests" as const, label: "Quests", detail: `${daily.length + weekly.length} active` },
            { id: "badges" as const, label: "Badges", detail: `${earnedBadges.length} earned` }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={board === item.id}
              onClick={() => setBoard(item.id)}
              className={`quests-board-tab ${board === item.id ? "quests-board-tab-active" : ""}`}
            >
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>

      {board === "badges" && (
        <div className="quests-badges-board">
          <div className="quests-section-head">
            <div>
              <div className="quests-kicker">
                <BadgeCheck size={15} />
                Badge collection
              </div>
              <h2 className="display-heading text-2xl font-bold text-[var(--text-1)]">Progress badges</h2>
            </div>
            <span>{earnedBadges.length} earned</span>
          </div>
          <div className="quests-badge-grid">
            {(badgeDefinitions.data ?? []).map((badge) => {
              const earned = earnedBadges.find((item) => item.badge_id === badge.id);
              return (
                <div key={badge.id} className={`quests-badge-card ${earned ? "quests-badge-earned" : ""}`}>
                  <div className="quests-badge-emblem">
                    <BadgeCheck size={18} />
                  </div>
                  <div>
                    <strong>{badge.title}</strong>
                    <p>{badge.description}</p>
                    <span>{earned ? `Earned ${new Date(earned.awarded_at).toLocaleDateString()}` : "Locked"}</span>
                  </div>
                </div>
              );
            })}
            {!badgeDefinitions.isLoading && (badgeDefinitions.data?.length ?? 0) === 0 && (
              <div className="quest-empty">
                <Trophy size={19} />
                <strong>Badges are not loaded yet</strong>
                <span>They will appear after badge definitions are available.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {board === "quests" && (
      <div className="quests-board">
        <div className="quests-tabs" role="tablist" aria-label="Quest filters">
          {[
            { id: "daily" as const, label: "Daily", count: daily.length },
            { id: "weekly" as const, label: "Weekly", count: weekly.length },
            { id: "completed" as const, label: "Completed", count: completed.length }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              onClick={() => setView(item.id)}
              className={`quests-tab ${view === item.id ? "quests-tab-active" : ""}`}
            >
              <span>{item.label}</span>
              <small>{item.count}</small>
            </button>
          ))}
        </div>

        <div className="quests-grid">
          {isLoading && visible.length === 0 && Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="quest-card quest-card-loading">
              <i />
              <b />
              <b />
            </div>
          ))}
          {!isLoading && visible.length === 0 && (
            <div className="quest-empty">
              <CheckCircle2 size={19} />
              <strong>{view === "completed" ? "No completed quests yet" : "No quests in this section"}</strong>
              <span>Settle rounds on BasePlay and this board will update after indexing.</span>
            </div>
          )}
          {visible.map((quest) => (
            <QuestCard key={`${quest.quest_id}-${quest.period_start}`} quest={quest} connected={Boolean(address)} />
          ))}
        </div>
      </div>
      )}
      </section>
    </main>
  );
}

function QuestCard({ quest, connected }: { quest: QuestProgressItem; connected: boolean }) {
  const percent = connected && quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;
  const progressLabel = connected ? `${Math.min(quest.progress, quest.target)} / ${quest.target}` : `Goal ${quest.target}`;

  return (
    <article className={`quest-card ${quest.completed ? "quest-card-complete" : ""}`}>
      <div className="quest-card-top">
        <div className="quest-card-icon">
          {quest.period === "daily" ? <CalendarDays size={18} /> : <Flame size={18} />}
        </div>
        <span>{quest.period}</span>
      </div>
      <h3>{quest.title}</h3>
      <p>{quest.description}</p>
      <div className="quest-card-track">
        <i style={{ width: `${percent}%` }} />
      </div>
      <div className="quest-card-meta">
        <span>{progressLabel}</span>
        <strong>{quest.completed ? "Done" : `+${quest.reward_xp} XP`}</strong>
      </div>
      {quest.badge_id && (
        <div className="quest-card-badge">
          <BadgeCheck size={13} />
          Badge reward
        </div>
      )}
    </article>
  );
}

function SummaryCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="quests-summary-card">
      <div>
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
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
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000
  });
}
