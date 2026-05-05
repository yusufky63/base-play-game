"use client";

import { useRoundPages } from "@/hooks/useRecentRounds";

export function usePlayerRounds(address?: string | null, limit = 20) {
  return useRoundPages({ player: address ?? undefined, limit });
}
