"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Circle, Flame, LogOut, Sparkles, Wallet } from "lucide-react";
import { baseSepolia } from "wagmi/chains";
import { useAccount, useDisconnect } from "wagmi";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { ChainSwitcher } from "@/components/wallet/ChainSwitcher";
import { SiweButton } from "@/components/wallet/SiweButton";
import { WalletStatus } from "@/components/wallet/WalletStatus";
import { PendingRoundsPanel } from "@/components/wallet/PendingRoundsPanel";
import { useBalance } from "@/hooks/useBalance";
import { useMounted } from "@/hooks/useMounted";
import { usePlayerProgress } from "@/hooks/usePlayerProgress";
import { levelProgress } from "@/lib/progression";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";

export function HeaderAccountMenu() {
  const mounted = useMounted();
  const { address, chain, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { formatted, symbol } = useBalance();
  const { progress, ready } = usePlayerProgress();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const level = progress?.level ?? 1;
  const xp = progress?.lifetime_xp ?? 0;
  const streak = progress?.current_streak ?? 0;
  const bar = levelProgress(xp, level);
  const network = getNetworkByChainId(chain?.id ?? baseSepolia.id);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-40 rounded-md border border-[var(--border)]" />;
  }

  if (!isConnected) {
    return <WalletStatus />;
  }

  return (
    <div ref={rootRef} className="header-account relative">
      <div className="header-account-control">
        <div className="header-account-trigger">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Open player panel"
            aria-expanded={open}
            className="header-account-main"
          >
            <span className="header-account-icon">
              <Wallet size={15} />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-bold leading-none text-[var(--text-1)]">
                {address ? <BasenameLabel address={address as `0x${string}`} className="truncate" /> : "Player"}
              </span>
              <span className="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase leading-none text-[var(--text-3)]">
                <span>{formatted} {symbol}</span>
                <span>{network?.shortName ?? "Sepolia"}</span>
              </span>
            </span>
            <ChevronDown size={14} className={`text-[var(--text-3)] transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <button type="button" onClick={() => disconnect()} className="header-account-exit" aria-label="Disconnect wallet" title="Disconnect wallet">
            <LogOut size={15} />
          </button>
        </div>
      </div>

      {open && (
        <div className="header-account-menu">
          <section className="header-account-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">Player progress</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-bold text-[var(--text-1)]">
                  <Sparkles size={14} className="text-[var(--accent)]" />
                  Level {ready ? level : "-"}
                </div>
              </div>
              <div className="header-streak">
                <Flame size={13} />
                {streak}d
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
              <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${bar.percent}%` }} />
            </div>
            <div className="mt-2 flex justify-between gap-3 font-mono text-[10px] text-[var(--text-3)]">
              <span>{xp} XP</span>
              <span>{bar.current}/{bar.required}</span>
            </div>
            {address && (
              <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <div className="font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">Player</div>
                <div className="mt-1 truncate font-mono text-xs font-bold text-[var(--text-1)]">
                  <BasenameLabel address={address as `0x${string}`} />
                </div>
              </div>
            )}
            <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <div className="font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">Wallet balance</div>
              <div className="mt-1 font-mono text-xs font-bold text-[var(--text-1)]">
                {formatted} {symbol}
              </div>
            </div>
          </section>

          <section className="header-account-row">
            <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-2)]">
              <Circle size={12} className="fill-[var(--accent)] text-[var(--accent)]" />
              Network
            </span>
            <ChainSwitcher />
          </section>

          <section className="header-account-row">
            <span className="text-xs font-bold text-[var(--text-2)]">SIWE</span>
            <SiweButton />
          </section>

          <PendingRoundsPanel compact />

        </div>
      )}
    </div>
  );
}
