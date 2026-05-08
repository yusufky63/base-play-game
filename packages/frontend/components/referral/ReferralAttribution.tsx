"use client";

import { useEffect } from "react";
import { REFERRAL_STORAGE_KEY, normalizeReferralInput } from "@baseplay/shared/utils/referral";
import miniAppSdk from "@farcaster/miniapp-sdk";
import { useAccount } from "wagmi";
import { useClaimReferral } from "@/hooks/useReferral";

export function ReferralAttribution() {
  const { address, isConnected } = useAccount();
  const { claim } = useClaimReferral();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = normalizeReferralInput(params.get("ref"));
    if (ref) {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !address) return;
    let active = true;
    const ref = normalizeReferralInput(window.localStorage.getItem(REFERRAL_STORAGE_KEY));
    if (!ref) return;

    const promptedKey = `${REFERRAL_STORAGE_KEY}:prompted:${address.toLowerCase()}:${ref.toLowerCase()}`;
    const claimedKey = `${REFERRAL_STORAGE_KEY}:claimed:${address.toLowerCase()}:${ref.toLowerCase()}`;
    if (window.localStorage.getItem(promptedKey) || window.localStorage.getItem(claimedKey)) return;

    let timer: number | undefined;
    miniAppSdk
      .isInMiniApp()
      .then((isInMiniApp) => {
        if (!active || isInMiniApp) return;
        window.localStorage.setItem(promptedKey, new Date().toISOString());
        timer = window.setTimeout(() => {
          void claim(ref).then((result) => {
            if (result?.status === "claimed" || result?.status === "existing") {
              window.localStorage.setItem(claimedKey, new Date().toISOString());
            }
          });
        }, 1_200);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [address, claim, isConnected]);

  return null;
}
