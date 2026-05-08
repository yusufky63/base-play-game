"use client";

import { useEffect, useState } from "react";
import miniAppSdk from "@farcaster/miniapp-sdk";
import { PlugZap } from "lucide-react";
import { base } from "wagmi/chains";
import { useConnect } from "wagmi";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import {
  OPEN_WALLET_MODAL_EVENT,
  getWalletConnectorDescription,
  getWalletConnectorLabel,
  getWalletConnectorOptions
} from "@/lib/walletConnectors";

export function WalletConnectModal() {
  const { connectAsync, connectors, isPending } = useConnect();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [isInFarcaster, setIsInFarcaster] = useState(false);
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

  async function connectWallet(connector: (typeof connectors)[number]) {
    setOpen(false);
    try {
      await connectAsync({ connector, chainId: base.id });
    } catch (error) {
      toast({
        tone: "error",
        title: getWalletConnectErrorTitle(error),
        description: getWalletConnectErrorDescription(error)
      });
    }
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Connect wallet">
      <div className="wallet-modal-options">
        {connectorOptions.map((connector) => (
          <button
            key={connector.uid ?? connector.id}
            type="button"
            disabled={isPending}
            onClick={() => void connectWallet(connector)}
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
  );
}

function getWalletConnectErrorTitle(error: unknown) {
  const message = getErrorMessage(error);
  if (/origin|domain|unauthori[sz]ed|project/i.test(message)) return "Wallet setup blocked";
  if (/reject|denied|cancel|closed/i.test(message)) return "Wallet connection cancelled";
  return "Wallet connection failed";
}

function getWalletConnectErrorDescription(error: unknown) {
  const message = getErrorMessage(error);
  if (/origin|domain|unauthori[sz]ed|project/i.test(message)) {
    return "Check the Reown project domain allowlist for baseplay.games and www.baseplay.games.";
  }
  if (/reject|denied|cancel|closed/i.test(message)) {
    return "Choose a wallet and approve the connection before placing a wager.";
  }
  return message ? message.slice(0, 160) : "Try another wallet option or open BasePlay inside your wallet browser.";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}
