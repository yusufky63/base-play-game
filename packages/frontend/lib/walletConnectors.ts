import type { useConnect } from "wagmi";

type WalletConnector = ReturnType<typeof useConnect>["connectors"][number];

export const OPEN_WALLET_MODAL_EVENT = "baseplay:open-wallet-modal";

export function openWalletModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_WALLET_MODAL_EVENT));
}

export function getWalletConnectorOptions(connectors: readonly WalletConnector[], isInFarcaster = false) {
  const visible = connectors.filter((connector) => {
    if (!isInFarcaster && connector.id === "farcaster") return false;
    if ((connector.id === "injected" || connector.id === "metaMask") && !hasInjectedProvider()) return false;
    return true;
  });
  const unique = new Map<string, WalletConnector>();

  for (const connector of visible) {
    const key = normalizeConnectorId(connector.id);
    if (!unique.has(key)) unique.set(key, connector);
  }

  return Array.from(unique.values()).sort((left, right) => getConnectorPriority(left, isInFarcaster) - getConnectorPriority(right, isInFarcaster));
}

export function getNativeAppConnector(connectors: readonly WalletConnector[], isInFarcaster = false) {
  if (isInFarcaster) return connectors.find((connector) => connector.id === "farcaster");
  if (!isBaseAppBrowser()) return undefined;
  return (
    connectors.find((connector) => connector.id === "baseAccount") ??
    connectors.find((connector) => connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") ??
    connectors.find((connector) => connector.id === "injected")
  );
}

export function getWalletConnectorLabel(connector: WalletConnector) {
  if (connector.id === "walletConnect") return "WalletConnect";
  if (connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") return "Coinbase Wallet";
  if (connector.id === "baseAccount") return "Base Account";
  if (connector.id === "farcaster") return "Farcaster Wallet";
  if (connector.id === "metaMask") return "MetaMask";
  if (connector.id === "injected") return "Browser wallet";
  return connector.name;
}

export function getWalletConnectorDescription(connector: WalletConnector) {
  if (connector.id === "walletConnect") return "Open the wallet picker or scan with a supported wallet.";
  if (connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") return "Use Coinbase Wallet without forcing Base Account.";
  if (connector.id === "baseAccount") return "Use Base Account when you explicitly want it.";
  if (connector.id === "farcaster") return "Use the wallet provided by Farcaster.";
  if (connector.id === "metaMask") return "Use MetaMask if it is injected in this browser.";
  if (connector.id === "injected") return "Use the wallet injected into this browser.";
  return "Connect with this wallet provider.";
}

function normalizeConnectorId(id: string) {
  if (id === "metaMask") return "injected";
  if (id === "coinbaseWallet") return "coinbaseWalletSDK";
  return id;
}

function getConnectorPriority(connector: WalletConnector, isInFarcaster: boolean) {
  if (isInFarcaster && connector.id === "farcaster") return 0;
  if (connector.id === "injected" || connector.id === "metaMask") return 1;
  if (connector.id === "walletConnect") return 2;
  if (connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") return 3;
  if (connector.id === "baseAccount") return 4;
  return 9;
}

function hasInjectedProvider() {
  if (typeof window === "undefined") return false;
  return Boolean((window as typeof window & { ethereum?: unknown }).ethereum);
}

function isBaseAppBrowser() {
  if (typeof navigator === "undefined") return false;
  return /baseapp|base app|coinbasewallet|coinbase wallet/i.test(navigator.userAgent);
}
