"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";

export type VRFState = "idle" | "pending_tx" | "pending_vrf" | "settled" | "error";

export const VRF_MESSAGES: Record<VRFState, string> = {
  idle: "",
  pending_tx: "Sending transaction...",
  pending_vrf: "Verifying on-chain...",
  settled: "",
  error: "Timed out. Use claimRefund() to recover your bet."
};

export function useVRF() {
  const [state, setState] = useState<VRFState>("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !requestId || state !== "pending_vrf") return;

    const channel = supabase
      .channel(`vrf_${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_rounds",
          filter: `vrf_request_id=eq.${requestId}`
        },
        (payload: { new: Record<string, unknown> }) => {
          setResult(payload.new);
          setState("settled");
        }
      )
      .subscribe();

    const timeout = window.setTimeout(() => setState("error"), 120_000);

    return () => {
      void supabase.removeChannel(channel);
      window.clearTimeout(timeout);
    };
  }, [requestId, state]);

  function reset() {
    setState("idle");
    setRequestId(null);
    setResult(null);
  }

  function settle(nextResult: Record<string, unknown>) {
    setResult(nextResult);
    setState("settled");
  }

  return { state, setState, requestId, setRequestId, result, reset, settle };
}
