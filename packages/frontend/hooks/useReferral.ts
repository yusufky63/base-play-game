"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildReferralClaimMessage, normalizeReferralInput } from "@baseplay/shared/utils/referral";
import { getAddress } from "viem";
import { useAccount, useSignMessage } from "wagmi";
import { fetchBackendJson } from "@/lib/backend";
import { useToast } from "@/components/ui/ToastProvider";

export type ReferralSummary = {
  player: string;
  code: string | null;
  referralUrlPath: string | null;
  referredBy: string | null;
  totalReferrals: number;
  activeReferrals: number;
  totalXp: number;
  dailyXp: number;
  referrals: Array<{
    referred_player: string;
    referrer_player: string;
    referral_code: string | null;
    source: string;
    claimed_at: string;
  }>;
  recentRewards: Array<{
    id: string;
    referrer_player: string;
    referred_player: string;
    round_id: string;
    xp_awarded: number;
    reward_day: string;
    created_at: string;
  }>;
};

export function useReferralSummary(address?: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["referral-summary", address?.toLowerCase() ?? "none"],
    queryFn: async () => {
      const data = await fetchBackendJson<ReferralSummary>(`/api/player/${address}/referrals`);
      if (!data) throw new Error("Backend is not configured");
      return data;
    },
    enabled: Boolean(address) && enabled,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false
  });
}

export function useClaimReferral() {
  const { address } = useAccount();
  const { signMessageAsync, isPending } = useSignMessage();
  const toast = useToast();

  const claim = useCallback(async (rawReferrer: string) => {
    if (!address) {
      toast({ tone: "error", title: "Connect wallet first" });
      return null;
    }

    const referrer = normalizeReferralInput(rawReferrer);
    if (!referrer) return null;

    const player = getAddress(address);
    const message = buildReferralClaimMessage({ player, referrer });
    const signature = await signMessageAsync({ message });
    const result = await fetchBackendJson<{ status: "claimed" | "existing" | "locked" }>(
      "/api/referrals/claim",
      {
        method: "POST",
        body: JSON.stringify({ player, referrer, message, signature })
      }
    );

    if (result?.status === "locked") {
      toast({ tone: "info", title: "Referral already linked", description: "This wallet already has another referrer." });
    } else {
      toast({ tone: "success", title: "Referral linked", description: "Referral XP and badges can now be tracked from settled rounds." });
    }
    return result;
  }, [address, signMessageAsync, toast]);

  return { claim, isPending };
}
