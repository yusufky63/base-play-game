"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { VRFState } from "@/hooks/useVRF";

export function VRFPendingOverlay({ state }: { state: VRFState }) {
  return (
    <AnimatePresence>
      {state === "pending_vrf" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-[var(--surface)]/85 backdrop-blur"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-2)] border-t-[var(--accent)]" />
          <p className="text-sm font-medium text-[var(--text-1)]">Verifying on-chain</p>
          <p className="flex items-center gap-1 text-xs text-[var(--text-2)]">
            <ShieldCheck size={12} className="text-[var(--win)]" />
            Chainlink VRF processing
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
