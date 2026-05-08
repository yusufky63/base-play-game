import type { useConnect } from "wagmi";

type WalletConnector = ReturnType<typeof useConnect>["connectors"][number];

export function getPreferredWalletConnector(connectors: readonly WalletConnector[], isInFarcaster = false) {
  const farcaster = connectors.find((item) => item.id === "farcaster");
  const walletConnect = connectors.find((item) => item.id === "walletConnect");
  const injected = connectors.find((item) => item.id === "injected") ?? connectors.find((item) => item.id === "metaMask");
  const baseAccount = connectors.find((item) => item.id === "baseAccount");
  const coinbaseWallet = connectors.find((item) => item.id === "coinbaseWalletSDK" || item.id === "coinbaseWallet");

  if (isInFarcaster && farcaster) return farcaster;
  if (hasInjectedWalletProvider()) return injected ?? baseAccount ?? coinbaseWallet ?? walletConnect ?? connectors[0];
  if (isMobileBrowser()) return baseAccount ?? coinbaseWallet ?? walletConnect ?? injected ?? connectors[0];

  return walletConnect ?? baseAccount ?? coinbaseWallet ?? injected ?? connectors[0];
}

function hasInjectedWalletProvider() {
  if (typeof window === "undefined") return false;
  return Boolean((window as typeof window & { ethereum?: unknown }).ethereum);
}

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|mobile/.test(ua) || navigator.maxTouchPoints > 1;
}
