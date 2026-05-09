"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import miniAppSdk from "@farcaster/miniapp-sdk";
import { useAccount, useReconnect } from "wagmi";
import {
  clearPendingWalletConnector,
  getReconnectConnectorCandidates,
  hasManualWalletDisconnectHold
} from "@/lib/walletConnectors";

export function WalletReconnectSync() {
  const { isConnected, status } = useAccount();
  const { connectors, isPending, reconnectAsync } = useReconnect();
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  const reconnectingRef = useRef(false);

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

  const syncWalletSession = useCallback(async () => {
    if (isInFarcaster || isConnected || isPending || status !== "disconnected" || reconnectingRef.current) return;
    if (hasManualWalletDisconnectHold()) return;

    const reconnectConnectors = getReconnectConnectorCandidates(connectors, isInFarcaster);
    if (!reconnectConnectors.length) return;

    reconnectingRef.current = true;
    try {
      const connections = await reconnectAsync({ connectors: reconnectConnectors });
      if (connections.length > 0) clearPendingWalletConnector();
    } catch {
      // Reconnect is opportunistic after a mobile wallet round-trip; failed attempts should not block the UI.
    } finally {
      reconnectingRef.current = false;
    }
  }, [connectors, isConnected, isInFarcaster, isPending, reconnectAsync, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void syncWalletSession(), 350);
    return () => window.clearTimeout(timeout);
  }, [syncWalletSession]);

  useEffect(() => {
    function scheduleSync() {
      if (document.visibilityState === "hidden") return;
      window.setTimeout(() => void syncWalletSession(), 450);
      window.setTimeout(() => void syncWalletSession(), 1_500);
    }

    window.addEventListener("focus", scheduleSync);
    window.addEventListener("pageshow", scheduleSync);
    document.addEventListener("visibilitychange", scheduleSync);
    return () => {
      window.removeEventListener("focus", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
      document.removeEventListener("visibilitychange", scheduleSync);
    };
  }, [syncWalletSession]);

  return null;
}
