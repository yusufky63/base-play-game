"use client";

import { useEffect, useState } from "react";
import miniAppSdk from "@farcaster/miniapp-sdk";
import { LogOut, PlugZap } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useMounted } from "@/hooks/useMounted";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { Modal } from "@/components/ui/Modal";
import {
  OPEN_WALLET_MODAL_EVENT,
  getWalletConnectorDescription,
  getWalletConnectorLabel,
  getWalletConnectorOptions
} from "@/lib/walletConnectors";

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
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const [open, setOpen] = useState(false);
  const connectorOptions = getWalletConnectorOptions(connectors, isInFarcaster);

  useEffect(() => {
    let active = true;
    miniAppSdk
      .isInMiniApp()
      .then((value) => {
        if (active) setIsInFarcaster(value);
      })
      .catch(() => {
        if (active) setIsInFarcaster(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleOpenWalletModal() {
      setOpen(true);
    }

    window.addEventListener(OPEN_WALLET_MODAL_EVENT, handleOpenWalletModal);
    return () => window.removeEventListener(OPEN_WALLET_MODAL_EVENT, handleOpenWalletModal);
  }, []);

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
    <>
      <button
        type="button"
        disabled={isPending || connectorOptions.length === 0}
        onClick={() => setOpen(true)}
        title="Connect wallet"
        className={`control-shell flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-45 ${
          compact ? "w-9 px-0" : "px-3"
        }`}
      >
        {!hideIcon && <PlugZap size={15} className="text-[var(--accent)]" />}
        {!compact && "Connect"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Connect wallet">
        <div className="wallet-modal-options">
          {connectorOptions.map((connector) => (
            <button
              key={connector.uid ?? connector.id}
              type="button"
              disabled={isPending}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
              className="wallet-modal-option"
            >
              <span className="wallet-modal-option-icon">
                <PlugZap size={16} />
              </span>
              <span className="min-w-0">
                <span className="wallet-modal-option-title">{getWalletConnectorLabel(connector)}</span>
                <span className="wallet-modal-option-detail">{getWalletConnectorDescription(connector)}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
