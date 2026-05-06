"use client";

import { useEffect, useState } from "react";
import { base } from "wagmi/chains";
import { useAccount } from "wagmi";
import { defaultChainId } from "@/lib/env";

export function NetworkStatusPill() {
  const { chain } = useAccount();
  const [preferredChainId, setPreferredChainId] = useState<number>(defaultChainId);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("baseplay:chainId"));
    setPreferredChainId(chain?.id ?? (stored || defaultChainId));

    function onChainChange(event: Event) {
      setPreferredChainId((event as CustomEvent<number>).detail);
    }

    window.addEventListener("baseplay:chain-change", onChainChange);
    return () => window.removeEventListener("baseplay:chain-change", onChainChange);
  }, [chain?.id]);

  const isMainnet = preferredChainId === base.id;

  return (
    <div className="hidden items-center gap-2 rounded-md border border-[var(--border-2)] px-3 py-2 text-xs lg:flex">
      <span className={`h-2 w-2 rounded-full ${isMainnet ? "bg-[var(--pending)]" : "bg-[var(--win)]"}`} />
      <span className="font-mono text-[var(--text-2)]">{isMainnet ? "Base mainnet" : "Base Sepolia"}</span>
    </div>
  );
}
