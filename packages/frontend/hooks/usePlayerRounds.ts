"use client";

import { useRoundPages } from "@/hooks/useRecentRounds";

export function usePlayerRounds(address?: string | null, limit = 20, { enabled = true }: { enabled?: boolean } = {}) {
  return useRoundPages({ player: address ?? undefined, limit, enabled: Boolean(address) && enabled });
}
