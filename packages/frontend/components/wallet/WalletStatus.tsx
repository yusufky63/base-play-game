"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LogOut, PlugZap } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { frontendEnvStatus } from "@/lib/env";
import { rainbowKitEnabled } from "@/lib/wagmi.config";
import { useMounted } from "@/hooks/useMounted";
import { BasenameLabel } from "@/components/base/BasenameLabel";

export function WalletStatus({ compact = false, hideIcon = false, accountOnly = false }: { compact?: boolean; hideIcon?: boolean; accountOnly?: boolean }) {
  const mounted = useMounted();
  const { disconnect } = useDisconnect();

  if (!mounted) {
    return <div className="h-9 w-9 rounded-md border border-[var(--border)] sm:w-28" />;
  }

  if (rainbowKitEnabled) {
    return (
      <ConnectButton.Custom>
        {({ account, mounted: ready, openAccountModal, openConnectModal }) => {
          const connected = ready && account;
          if (connected) {
            return (
              <button
                type="button"
                onClick={accountOnly ? () => disconnect() : openAccountModal}
                title={accountOnly ? "Disconnect wallet" : undefined}
                aria-label={accountOnly ? "Disconnect wallet" : undefined}
                className={`control-shell flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-1)] ${
                  compact || accountOnly ? "w-9 px-0" : "px-3"
                }`}
              >
                {!hideIcon && <LogOut size={15} className="text-[var(--accent)]" />}
                {!compact && !accountOnly && <BasenameLabel address={account.address as `0x${string}`} className="max-w-28 truncate font-mono text-xs" />}
              </button>
            );
          }

          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={`control-shell flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-1)] ${
                compact ? "w-9 px-0" : "px-3"
              }`}
            >
              {!hideIcon && <PlugZap size={15} className="text-[var(--accent)]" />}
              {!compact && "Connect"}
            </button>
          );
        }}
      </ConnectButton.Custom>
    );
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
      title={frontendEnvStatus.walletConnectReady ? "Connect wallet" : "WalletConnect ID missing; injected wallet fallback is active"}
      className={`control-shell flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-45 ${
        compact ? "w-9 px-0" : "px-3"
      }`}
    >
      {!hideIcon && <PlugZap size={15} className="text-[var(--accent)]" />}
      {!compact && "Connect"}
    </button>
  );
}
