"use client";

import { useQuery } from "@tanstack/react-query";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { getSupabaseBrowser } from "@/lib/supabase";

export type QuestDefinition = Database["public"]["Tables"]["quest_definitions"]["Row"];
export type PlayerQuestRow = Database["public"]["Views"]["player_quest_summary"]["Row"];

const definitionTimestamp = "1970-01-01T00:00:00.000Z";

export const DEFAULT_QUEST_DEFINITIONS: QuestDefinition[] = [
  { id: "daily-round-1", title: "Play one round", description: "Settle one round today.", period: "daily", metric: "rounds", target: 1, reward_xp: 8, badge_id: null, active: true, sort_order: 10, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "daily-round-5", title: "Play five rounds", description: "Settle five rounds today.", period: "daily", metric: "rounds", target: 5, reward_xp: 18, badge_id: null, active: true, sort_order: 20, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "daily-three-games", title: "Try three games", description: "Settle rounds in three different games today.", period: "daily", metric: "distinct_games", target: 3, reward_xp: 16, badge_id: null, active: true, sort_order: 30, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "daily-win-1", title: "Get a win", description: "Win one settled round today.", period: "daily", metric: "wins", target: 1, reward_xp: 10, badge_id: null, active: true, sort_order: 40, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "daily-round-10", title: "Play ten rounds", description: "Settle ten rounds today.", period: "daily", metric: "rounds", target: 10, reward_xp: 30, badge_id: "daily-climber", active: true, sort_order: 45, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "daily-win-2", title: "Win twice", description: "Win two settled rounds today.", period: "daily", metric: "wins", target: 2, reward_xp: 16, badge_id: null, active: true, sort_order: 46, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "daily-five-games", title: "Try five games", description: "Settle rounds in five different games today.", period: "daily", metric: "distinct_games", target: 5, reward_xp: 24, badge_id: "daily-explorer", active: true, sort_order: 47, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "weekly-round-10", title: "Weekly grinder", description: "Settle ten rounds this week.", period: "weekly", metric: "rounds", target: 10, reward_xp: 45, badge_id: "weekly-grinder", active: true, sort_order: 50, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "weekly-five-games", title: "Game explorer", description: "Settle rounds in five different games this week.", period: "weekly", metric: "distinct_games", target: 5, reward_xp: 45, badge_id: "game-explorer", active: true, sort_order: 60, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "weekly-streak-7", title: "Seven day streak", description: "Keep a seven day streak this week.", period: "weekly", metric: "current_streak", target: 7, reward_xp: 60, badge_id: "seven-day-streak", active: true, sort_order: 70, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "weekly-round-25", title: "25-round week", description: "Settle twenty-five rounds this week.", period: "weekly", metric: "rounds", target: 25, reward_xp: 85, badge_id: "twenty-five-rounds", active: true, sort_order: 80, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "weekly-win-10", title: "Ten-win week", description: "Win ten settled rounds this week.", period: "weekly", metric: "wins", target: 10, reward_xp: 70, badge_id: "weekly-winner", active: true, sort_order: 90, created_at: definitionTimestamp, updated_at: definitionTimestamp },
  { id: "weekly-eight-games", title: "Wide board", description: "Settle rounds in eight different games this week.", period: "weekly", metric: "distinct_games", target: 8, reward_xp: 75, badge_id: "wide-board", active: true, sort_order: 100, created_at: definitionTimestamp, updated_at: definitionTimestamp }
];

export interface QuestProgressItem {
  quest_id: string;
  title: string;
  description: string;
  period: string;
  metric: string;
  target: number;
  reward_xp: number;
  badge_id: string | null;
  sort_order: number;
  period_start: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  updated_at: string | null;
}

export function useQuestDefinitions() {
  return useQuery({
    queryKey: ["quest-definitions"],
    queryFn: async () => {
      const supabase = getSupabaseBrowser();
      if (!supabase) return DEFAULT_QUEST_DEFINITIONS;
      const { data, error } = await supabase
        .from("quest_definitions")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.warn("[BasePlay] Quest definitions query failed", error.message);
        return DEFAULT_QUEST_DEFINITIONS;
      }
      return data?.length ? (data as QuestDefinition[]) : DEFAULT_QUEST_DEFINITIONS;
    },
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000
  });
}

export function mergeQuestRows(definitions: QuestDefinition[], rows: PlayerQuestRow[] = []): QuestProgressItem[] {
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
