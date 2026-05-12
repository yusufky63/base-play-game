"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Circle } from "lucide-react";
import { base } from "wagmi/chains";
import { useAccount, useSwitchChain } from "wagmi";
import { useMounted } from "@/hooks/useMounted";
import { defaultChainId } from "@/lib/env";

const chainOptions = [
  { chain: base, label: "Base Mainnet", shortLabel: "Base", tag: "mainnet" }
];

export function ChainSwitcher() {
  const mounted = useMounted();
  const { chain, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const [selectedChainId, setSelectedChainId] = useState<number>(defaultChainId);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = chainOptions.find((option) => option.chain.id === selectedChainId) ?? chainOptions[0];

  useEffect(() => {
    const stored = Number(window.localStorage.getItem("baseplay:chainId"));
    const next = chain?.id ?? (stored || defaultChainId);
    setSelectedChainId(next);
  }, [chain?.id]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function updateChain(chainId: number) {
    setSelectedChainId(chainId);
    setOpen(false);
    window.localStorage.setItem("baseplay:chainId", String(chainId));
    window.dispatchEvent(new CustomEvent("baseplay:chain-change", { detail: chainId }));
    if (isConnected) switchChain({ chainId });
  }

  if (!mounted) return <div className="h-9 w-[142px] md:w-[190px]" />;

  return (
    <div ref={rootRef} className="chain-switcher relative block">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        title={isConnected ? "Switch network" : "Select preferred network"}
        aria-label="Select network"
        aria-expanded={open}
        className="chain-trigger control-shell"
      >
        <Circle size={13} className="fill-[var(--accent)] text-[var(--accent)]" />
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold leading-none">{selected.shortLabel}</span>
          <span className="mt-0.5 block font-mono text-[9px] uppercase leading-none text-[var(--text-3)]">{selected.tag}</span>
        </span>
        <ChevronDown size={14} className={`text-[var(--text-3)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="chain-menu">
          {chainOptions.map((option) => {
            const active = option.chain.id === selectedChainId;
            return (
              <button
                key={option.chain.id}
                type="button"
                onClick={() => updateChain(option.chain.id)}
                className={`chain-option ${active ? "chain-option-active" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <Circle size={12} className={active ? "fill-[var(--accent)] text-[var(--accent)]" : "text-[var(--text-3)]"} />
                  <span>
                    <span className="block text-sm font-bold text-[var(--text-1)]">{option.label}</span>
                    <span className="font-mono text-[10px] uppercase text-[var(--text-3)]">{option.tag}</span>
                  </span>
                </span>
                {active && <Check size={14} className="text-[var(--accent)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
