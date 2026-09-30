"use client";

import { useEffect, useRef } from "react";
import miniAppSdk from "@farcaster/miniapp-sdk";
import { useTheme } from "next-themes";
import { useAccount, useConnect } from "wagmi";
import { applyEmbedMode, embedNewTabUrl, readEmbedRequest } from "@/lib/embed";
import { hasManualWalletDisconnectHold } from "@/lib/walletConnectors";

type HostProvider = {
  on?: (event: "accountsChanged", listener: (accounts: readonly string[]) => void) => void;
  removeListener?: (event: "accountsChanged", listener: (accounts: readonly string[]) => void) => void;
  request: (args: { method: "eth_accounts" }) => Promise<readonly string[]>;
};

/**
 * Tells a mini app host the page is ready, and turns on embed mode first when a partner site asked for it
 * (lib/embed.ts): the chrome is gone and the theme set before the host reveals the frame.
 */
export function MiniAppBoot() {
  const { setTheme } = useTheme();
  const { isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const live = useRef({ connectAsync, connectors, isConnected });

  useEffect(() => {
    live.current = { connectAsync, connectors, isConnected };
  });

  useEffect(() => {
    let active = true;
    let stopEmbed: (() => void) | undefined;

    // The host's wallet is the player's wallet: connect to it as soon as it has an account, with no prompt. The chain
    // is left alone here; the bet panel asks for Base when the player is about to play.
    const connectToHost = () => {
      const { connectAsync: connect, connectors: all, isConnected: connected } = live.current;
      const farcaster = all.find((connector) => connector.id === "farcaster");
      if (connected || !farcaster || hasManualWalletDisconnectHold()) return;
      void connect({ connector: farcaster }).catch(() => undefined);
    };

    async function startEmbed() {
      const request = readEmbedRequest();
      if (!request) return;
      applyEmbedMode(request.host);
      if (request.theme) setTheme(request.theme);

      const onClick = (event: MouseEvent) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        const url = anchor ? embedNewTabUrl(anchor, window.location) : null;
        if (!url) return;
        event.preventDefault();
        window.open(url, "_blank", "noopener,noreferrer");
      };
      document.addEventListener("click", onClick, true);

      const provider = (await miniAppSdk.wallet.getEthereumProvider().catch(() => undefined)) as HostProvider | undefined;
      const onAccounts = (accounts: readonly string[]) => {
        if (accounts.length > 0) connectToHost();
      };
      provider?.on?.("accountsChanged", onAccounts);
      const accounts = provider ? await provider.request({ method: "eth_accounts" }).catch(() => []) : [];
      if (active) onAccounts(accounts);

      stopEmbed = () => {
        document.removeEventListener("click", onClick, true);
        provider?.removeListener?.("accountsChanged", onAccounts);
      };
      if (!active) stopEmbed();
    }

    miniAppSdk
      .isInMiniApp()
      .then(async (isInMiniApp) => {
        if (!active || !isInMiniApp) return;
        await startEmbed().catch(() => undefined);
        await miniAppSdk.actions.ready();
      })
      .catch(() => undefined);

    return () => {
      active = false;
      stopEmbed?.();
    };
  }, [setTheme]);

  return null;
}
