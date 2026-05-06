"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, CalendarDays, CheckCircle2, Flame, Gift, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { useAccount } from "wagmi";
import { WalletStatus } from "@/components/wallet/WalletStatus";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { mergeQuestRows, type QuestProgressItem, useQuestDefinitions } from "@/hooks/useQuestDefinitions";
import { levelProgress } from "@/lib/progression";

type QuestView = "daily" | "weekly" | "completed";

export function QuestsClient() {
  const account = useAccount();
  const address = account.address?.toLowerCase() ?? null;
  const definitions = useQuestDefinitions();
  const profile = usePlayerProfile(address);
  const [view, setView] = useState<QuestView>("daily");
  const quests = useMemo(
    () => mergeQuestRows(definitions.data ?? [], profile.data?.quests ?? []),
    [definitions.data, profile.data?.quests]
  );
  const daily = quests.filter((quest) => quest.period === "daily");
  const weekly = quests.filter((quest) => quest.period === "weekly");
  const completed = quests.filter((quest) => quest.completed);
  const visible = view === "daily" ? daily : view === "weekly" ? weekly : completed;
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
              void profile.refetch();
            }}
            className="control-shell inline-flex h-10 items-center gap-2 px-3 text-xs font-bold"
          >
            <RefreshCw size={13} className={definitions.isFetching || profile.isFetching ? "animate-spin text-[var(--accent)]" : ""} />
            Refresh
          </button>
          <Link href="/profile" className="play-button-ghost inline-flex h-10 items-center rounded-md px-4 text-sm font-bold">
            Profile
          </Link>
        </div>
      </section>

      {!address && (
        <section className="quests-connect panel">
          <div className="quests-connect-icon">
            <Gift size={22} />
          </div>
          <div>
            <h2 className="display-heading text-2xl font-bold text-[var(--text-1)]">Connect to track quests</h2>
            <p>Quest rules are visible below. Connect your wallet to see live progress, completed rewards, and earned badges.</p>
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
          <SummaryCard icon={<BadgeCheck size={17} />} label="Badges" value={String(profile.data?.badges.length ?? 0)} detail="Shown on profile" />
        </section>
      )}

      <section className="quests-board">
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
      </section>

      <section className="quests-badge-note">
        <div>
          <div className="quests-kicker">
            <BadgeCheck size={15} />
            Badges
          </div>
          <h2 className="display-heading text-2xl font-bold text-[var(--text-1)]">Badges live on your public profile</h2>
          <p>
            Quests can unlock badges, but badges are presented as a profile achievement shelf so other players can inspect them from your public wallet profile.
          </p>
        </div>
        <Link href="/profile" className="primary-action inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-bold text-white">
          Open profile
        </Link>
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
