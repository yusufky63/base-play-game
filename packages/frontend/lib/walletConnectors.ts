import type { useConnect } from "wagmi";

type WalletConnector = ReturnType<typeof useConnect>["connectors"][number];

export const OPEN_WALLET_MODAL_EVENT = "baseplay:open-wallet-modal";

const PENDING_WALLET_CONNECTOR_KEY = "baseplay:pending-wallet-connector";
const MANUAL_WALLET_DISCONNECT_KEY = "baseplay:manual-wallet-disconnect-until";
const PENDING_WALLET_CONNECTOR_TTL_MS = 10 * 60_000;
const MANUAL_DISCONNECT_HOLD_MS = 10 * 60_000;

export function openWalletModal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_WALLET_MODAL_EVENT));
}

export function getWalletConnectorOptions(connectors: readonly WalletConnector[], isInFarcaster = false) {
  const visible = connectors.filter((connector) => {
    if (!isInFarcaster && connector.id === "farcaster") return false;
    if (!isInFarcaster && connector.id === "baseAccount") return false;
    if (isMetaMaskConnector(connector) && !hasMetaMaskProvider()) return false;
    if (connector.id === "injected" && !hasStandaloneInjectedProvider()) return false;
    return true;
  });
  const unique = new Map<string, WalletConnector>();

  for (const connector of visible) {
    const key = normalizeConnectorId(connector);
    const current = unique.get(key);
    if (!current || (!current.icon && connector.icon)) unique.set(key, connector);
  }

  return Array.from(unique.values()).sort((left, right) => getConnectorPriority(left, isInFarcaster) - getConnectorPriority(right, isInFarcaster));
}

export function getNativeAppConnector(connectors: readonly WalletConnector[], isInFarcaster = false) {
  if (isInFarcaster) return connectors.find((connector) => connector.id === "farcaster");
  if (!isNativeBaseWalletEnvironment()) return undefined;
  return (
    connectors.find((connector) => connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") ??
    connectors.find((connector) => connector.id === "baseAccount") ??
    connectors.find((connector) => connector.id === "injected")
  );
}

export function getReconnectConnectorCandidates(connectors: readonly WalletConnector[], isInFarcaster = false) {
  if (isInFarcaster) return [];

  const pendingConnectorId = getPendingWalletConnectorId();
  if (pendingConnectorId) {
    const pendingConnector = connectors.find((connector) => connectorIdsMatch(connector, pendingConnectorId));
    return pendingConnector ? [pendingConnector] : [];
  }

  const nativeConnector = getNativeAppConnector(connectors, false);
  if (nativeConnector) return [nativeConnector];

  return getWalletConnectorOptions(connectors, false);
}

export function getWalletConnectorLabel(connector: WalletConnector) {
  if (connector.id === "walletConnect") return "WalletConnect";
  if (connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") return "Coinbase Wallet";
  if (connector.id === "baseAccount") return "Base Account";
  if (connector.id === "farcaster") return "Farcaster Wallet";
  if (isMetaMaskConnector(connector)) return "MetaMask";
  if (connector.id === "injected") return "Browser wallet";
  return connector.name;
}

export function getWalletConnectorDescription(connector: WalletConnector) {
  if (connector.id === "walletConnect") return "Open the wallet picker or scan with a supported wallet.";
  if (connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") return "Use Coinbase Wallet or the native Base App wallet.";
  if (connector.id === "baseAccount") return "Use Base Account when you explicitly want it.";
  if (connector.id === "farcaster") return "Use the wallet provided by Farcaster.";
  if (isMetaMaskConnector(connector)) return "Use MetaMask if it is injected in this browser.";
  if (connector.id === "injected") return "Use the wallet injected into this browser.";
  return "Connect with this wallet provider.";
}

export function getWalletConnectorIconKey(connector: WalletConnector) {
  if (connector.icon) return "image";
  if (connector.id === "walletConnect") return "walletconnect";
  if (connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") return "coinbase";
  if (connector.id === "baseAccount") return "base";
  if (connector.id === "farcaster") return "farcaster";
  if (isMetaMaskConnector(connector)) return "metamask";
  return "injected";
}

export function getWalletConnectorIconLabel(connector: WalletConnector) {
  if (connector.id === "walletConnect") return "WC";
  if (connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") return "CB";
  if (connector.id === "baseAccount") return "BA";
  if (connector.id === "farcaster") return "FC";
  if (isMetaMaskConnector(connector)) return "MM";
  return "W";
}

export function markWalletConnectAttempt(connectorId: string) {
  if (typeof window === "undefined") return;
  clearManualWalletDisconnectHold();
  writeStorage(PENDING_WALLET_CONNECTOR_KEY, {
    connectorId,
    createdAt: Date.now()
  });
}

export function clearPendingWalletConnector() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_WALLET_CONNECTOR_KEY);
}

export function getPendingWalletConnectorId() {
  if (typeof window === "undefined") return null;
  const value = readStorage<{ connectorId?: string; createdAt?: number }>(PENDING_WALLET_CONNECTOR_KEY);
  if (!value?.connectorId || !value.createdAt) return null;
  if (Date.now() - value.createdAt > PENDING_WALLET_CONNECTOR_TTL_MS) {
    clearPendingWalletConnector();
    return null;
  }
  return value.connectorId;
}

export function markManualWalletDisconnect() {
  if (typeof window === "undefined") return;
  clearPendingWalletConnector();
  window.sessionStorage.setItem(MANUAL_WALLET_DISCONNECT_KEY, String(Date.now() + MANUAL_DISCONNECT_HOLD_MS));
}

export function clearManualWalletDisconnectHold() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(MANUAL_WALLET_DISCONNECT_KEY);
}

export function hasManualWalletDisconnectHold() {
  if (typeof window === "undefined") return false;
  const until = Number(window.sessionStorage.getItem(MANUAL_WALLET_DISCONNECT_KEY));
  if (!Number.isFinite(until) || until <= 0) return false;
  if (Date.now() <= until) return true;
  clearManualWalletDisconnectHold();
  return false;
}

function normalizeConnectorId(connector: WalletConnector | string) {
  if (typeof connector === "string") {
    if (connector === "coinbaseWallet") return "coinbaseWalletSDK";
    return connector;
  }
  if (isMetaMaskConnector(connector)) return "metaMask";
  if (connector.id === "coinbaseWallet") return "coinbaseWalletSDK";
  return connector.id;
}

function connectorIdsMatch(left: WalletConnector, right: string) {
  return left.id === right || normalizeConnectorId(left) === normalizeConnectorId(right);
}

function getConnectorPriority(connector: WalletConnector, isInFarcaster: boolean) {
  if (isInFarcaster && connector.id === "farcaster") return 0;
  if (isMetaMaskConnector(connector)) return 1;
  if (connector.id === "walletConnect") return 2;
  if (connector.id === "coinbaseWalletSDK" || connector.id === "coinbaseWallet") return 3;
  if (connector.id === "injected") return 4;
  if (connector.id === "baseAccount") return 4;
  return 9;
}

function hasInjectedProvider() {
  if (typeof window === "undefined") return false;
  return getEthereumProviders().length > 0;
}

function hasMetaMaskProvider() {
  return getEthereumProviders().some((provider) => Boolean(provider.isMetaMask));
}

function isMetaMaskConnector(connector: WalletConnector) {
  return /metamask/i.test(`${connector.id} ${connector.name}`);
}

function hasStandaloneInjectedProvider() {
  const providers = getEthereumProviders();
  if (providers.length === 0) return false;
  return providers.some((provider) => !provider.isMetaMask && !provider.isCoinbaseWallet && !provider.isBaseApp && !provider.isBaseWallet);
}

function isNativeBaseWalletEnvironment() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  if (/baseapp|base app/i.test(userAgent)) return true;

  const providers = getEthereumProviders();
  const hasCoinbaseProvider = providers.some((provider) => Boolean(provider.isCoinbaseWallet || provider.isBaseApp || provider.isBaseWallet));
  if (!hasCoinbaseProvider) return false;
  if (/coinbasewallet|coinbase wallet/i.test(userAgent)) return true;
  return isMobileUserAgent(userAgent) && !hasMetaMaskProvider();
}

function isMobileUserAgent(userAgent: string) {
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent);
}

type EthereumProviderLike = {
  isBaseApp?: boolean;
  isBaseWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isMetaMask?: boolean;
  providers?: EthereumProviderLike[];
};

function getEthereumProviders() {
  if (typeof window === "undefined") return [];
  const ethereum = (window as typeof window & { ethereum?: EthereumProviderLike }).ethereum;
  if (!ethereum) return [];
  return Array.isArray(ethereum.providers) ? ethereum.providers : [ethereum];
}

function writeStorage(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function readStorage<T>(key: string) {
  try {
    const value = window.sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}
