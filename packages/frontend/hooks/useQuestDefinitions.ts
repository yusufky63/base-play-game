"use client";

import { useQuery } from "@tanstack/react-query";
import type { Database } from "@baseplay/shared/types/supabase.types";
import { getSupabaseBrowser } from "@/lib/supabase";

export type QuestDefinition = Database["public"]["Tables"]["quest_definitions"]["Row"];
export type PlayerQuestRow = Database["public"]["Views"]["player_quest_summary"]["Row"];

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
