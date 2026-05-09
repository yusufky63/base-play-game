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
  clearPendingWalletConnector,
  getNativeAppConnector,
  getWalletConnectorDescription,
  getWalletConnectorIconKey,
  getWalletConnectorIconLabel,
  getWalletConnectorLabel,
  getWalletConnectorOptions,
  markWalletConnectAttempt
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
      const nativeConnector = getNativeAppConnector(connectors, isInFarcaster);
      if (nativeConnector) {
        void connectWallet(nativeConnector);
        return;
      }
      setOpen(true);
    }

    window.addEventListener(OPEN_WALLET_MODAL_EVENT, handleOpenWalletModal);
    return () => window.removeEventListener(OPEN_WALLET_MODAL_EVENT, handleOpenWalletModal);
  }, [connectors, isInFarcaster]);

  async function connectWallet(connector: (typeof connectors)[number]) {
    setOpen(false);
    markWalletConnectAttempt(connector.id);
    try {
      await connectAsync({ connector, chainId: base.id });
      clearPendingWalletConnector();
    } catch (error) {
      if (isUserCancelledWalletConnect(error)) clearPendingWalletConnector();
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
            <WalletConnectorIcon connector={connector} />
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

function WalletConnectorIcon({ connector }: { connector: ReturnType<typeof useConnect>["connectors"][number] }) {
  if (connector.icon) {
    return (
      <span className="wallet-modal-option-icon wallet-modal-option-icon-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={connector.icon} alt="" aria-hidden="true" />
      </span>
    );
  }

  const key = getWalletConnectorIconKey(connector);
  if (key === "injected") {
    return (
      <span className="wallet-modal-option-icon wallet-modal-option-icon-injected">
        <PlugZap size={16} />
      </span>
    );
  }

  return (
    <span className={`wallet-modal-option-icon wallet-modal-option-icon-${key}`}>
      {getWalletConnectorIconLabel(connector)}
    </span>
  );
}

function isUserCancelledWalletConnect(error: unknown) {
  return /reject|denied|cancel|closed/i.test(getErrorMessage(error));
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
