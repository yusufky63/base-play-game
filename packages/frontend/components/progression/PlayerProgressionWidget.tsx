"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, Sparkles, Trophy } from "lucide-react";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { useAccount } from "wagmi";
import { getSupabaseBrowser } from "@/lib/supabase";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";

type QuestDefinition = Database["public"]["Tables"]["quest_definitions"]["Row"];

export function PlayerProgressionWidget({ variant = "home" }: { variant?: "home" | "game" }) {
  const account = useAccount();
  const address = account.address?.toLowerCase() ?? null;
  const profile = usePlayerProfile(address);
  const definitions = useQuestDefinitions();
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
        <Link href={address ? "/profile" : "/docs?section=rewards"} className="progression-widget-link">
          {address ? "Profile" : "Rewards"}
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
                    <strong>{quest.completed ? <CheckCircle2 size={13} /> : `+${quest.reward_xp} XP`}</strong>
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

function useQuestDefinitions() {
  return useQuery({
    queryKey: ["quest-definitions"],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from("quest_definitions")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.warn("[BasePlay] Quest definitions query failed", error.message);
        return [];
      }
      return (data ?? []) as QuestDefinition[];
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000
  });
}

function mergeQuestRows(definitions: QuestDefinition[], rows: NonNullable<ReturnType<typeof usePlayerProfile>["data"]>["quests"]) {
  const rowById = new Map(rows.map((row) => [row.quest_id, row]));
  return definitions.map((definition) => {
    const row = rowById.get(definition.id);
    return {
      quest_id: definition.id,
      title: definition.title,
      description: definition.description,
      period: definition.period,
      metric: definition.metric,
      target: definition.target,
      reward_xp: definition.reward_xp,
      badge_id: definition.badge_id,
      sort_order: definition.sort_order,
      period_start: row?.period_start ?? "",
      progress: row?.progress ?? 0,
      completed: row?.completed ?? false,
      completed_at: row?.completed_at ?? null,
      updated_at: row?.updated_at ?? null
    };
  });
}
