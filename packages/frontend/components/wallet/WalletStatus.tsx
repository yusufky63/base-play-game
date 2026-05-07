"use client";

import { LogOut, PlugZap } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useMounted } from "@/hooks/useMounted";
import { BasenameLabel } from "@/components/base/BasenameLabel";

export function WalletStatus({ compact = false, hideIcon = false, accountOnly = false }: { compact?: boolean; hideIcon?: boolean; accountOnly?: boolean }) {
  const mounted = useMounted();
  const { disconnect } = useDisconnect();

  if (!mounted) {
    return <div className="h-9 w-9 rounded-md border border-[var(--border)] sm:w-28" />;
  }

  return <FallbackWalletButton compact={compact} hideIcon={hideIcon} accountOnly={accountOnly} />;
}

function FallbackWalletButton({ compact, hideIcon, accountOnly }: { compact: boolean; hideIcon: boolean; accountOnly: boolean }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors.find((item) => item.id === "injected") ?? connectors[0];

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        title={accountOnly ? "Disconnect wallet" : undefined}
        aria-label={accountOnly ? "Disconnect wallet" : undefined}
        className={`control-shell flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-1)] ${
          compact || accountOnly ? "w-9 px-0" : "px-3"
        }`}
      >
        {!hideIcon && <LogOut size={15} className="text-[var(--accent)]" />}
        {!compact && !accountOnly && <BasenameLabel address={address as `0x${string}`} className="font-mono text-xs" />}
        {!compact && !accountOnly && <LogOut size={13} className="text-[var(--text-3)]" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending || !connector}
      onClick={() => connector && connect({ connector })}
      title="Connect wallet"
      className={`control-shell flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-45 ${
        compact ? "w-9 px-0" : "px-3"
      }`}
    >
      {!hideIcon && <PlugZap size={15} className="text-[var(--accent)]" />}
      {!compact && "Connect"}
    </button>
  );
}
