"use client";

import Link from "next/link";
import { BadgeCheck, CheckCircle2, Sparkles, Trophy } from "lucide-react";
import { useAccount } from "wagmi";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { mergeQuestRows, useQuestDefinitions } from "@/hooks/useQuestDefinitions";

export function PlayerProgressionWidget({ variant = "home" }: { variant?: "home" | "game" }) {
  const account = useAccount();
  const address = account.address?.toLowerCase() ?? null;
  const profile = usePlayerProfile(address, { includeQuests: true, includeBadges: true });
  const definitions = useQuestDefinitions({ enabled: Boolean(address) });
  const quests = mergeQuestRows(definitions.data ?? [], profile.data?.quests ?? []);
  const visibleQuests = quests
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.sort_order - b.sort_order)
    .slice(0, variant === "game" ? 3 : 4);
  const badges = profile.data?.badges ?? [];
  const completedQuestCount = quests.filter((quest) => quest.completed).length;

  return (
    <section className={`progression-widget progression-widget-${variant}`}>
      <div className="progression-widget-head">
        <div>
          <div className="progression-widget-kicker">
            <Sparkles size={14} />
            Player progress
          </div>
          <h2>{address ? "Quests and badges" : "Play toward XP rewards"}</h2>
        </div>
        <Link href="/quests" className="progression-widget-link">
          Quests
        </Link>
      </div>

      {!address && (
        <p className="progression-widget-empty">
          Connect your wallet to track daily quests, badge unlocks, streaks, and referral XP across BasePlay.
        </p>
      )}

      {address && (
        <>
          <div className="progression-widget-score">
            <div>
              <span>Level</span>
              <strong>{profile.data?.stats.level ?? 1}</strong>
            </div>
            <div>
              <span>Quest wins</span>
              <strong>{completedQuestCount}</strong>
            </div>
            <div>
              <span>Badges</span>
              <strong>{badges.length}</strong>
            </div>
          </div>

          <div className="progression-mini-quests">
            {visibleQuests.map((quest) => {
              const percent = quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;
              return (
                <div key={`${quest.quest_id}-${quest.period_start}`} className={`progression-mini-quest ${quest.completed ? "progression-mini-quest-done" : ""}`}>
                  <div className="progression-mini-row">
                    <span>{quest.title}</span>
                    <strong>
                      {quest.completed ? (
                        <span className="progression-mini-done">
                          <CheckCircle2 size={13} />
                          Done
                        </span>
                      ) : (
                        `+${quest.reward_xp} XP`
                      )}
                    </strong>
                  </div>
                  <div className="progression-mini-track">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                  <div className="progression-mini-meta">
                    <span>{Math.min(quest.progress, quest.target)} / {quest.target}</span>
                    <span>{quest.period}</span>
                  </div>
                </div>
              );
            })}
            {!profile.isLoading && visibleQuests.length === 0 && (
              <p className="progression-widget-empty">Quests appear after settled rounds are indexed.</p>
            )}
          </div>

          <div className="progression-badge-strip" aria-label="Recent badges">
            {badges.slice(0, 4).map((badge) => (
              <div key={badge.badge_id} className="progression-badge-chip" title={badge.title}>
                <BadgeCheck size={14} />
                <span>{badge.title}</span>
              </div>
            ))}
            {badges.length === 0 && (
              <div className="progression-badge-chip progression-badge-chip-muted">
                <Trophy size={14} />
                <span>First badge waiting</span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
