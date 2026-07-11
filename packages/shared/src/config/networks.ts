import type { ChainConfig } from "../types/network.types.js";

const env = (name: string) => process.env[name] ?? "";
const optionalEnvUrl = (name: string) => {
  const value = env(name).trim();
  return value.length > 0 ? value : null;
};

const optionalEnvUrls = (name: string) => {
  const value = env(name).trim();
  if (!value) return [];
  return value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
};

function urls(...values: Array<string | string[] | null | undefined>) {
  const flattened = values.flatMap((value) => Array.isArray(value) ? value : [value]);
  return Array.from(new Set(flattened.filter((value): value is string => Boolean(value))));
}

export const BASE_MAINNET_PUBLIC_RPC_URLS = urls(
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com"
);

export const BASE_MAINNET_FRONTEND_RPC_URLS = urls(
  BASE_MAINNET_PUBLIC_RPC_URLS,
  optionalEnvUrls("NEXT_PUBLIC_BASE_MAINNET_RPC_URLS"),
  optionalEnvUrl("NEXT_PUBLIC_BASE_MAINNET_RPC_URL")
);

export const BASE_MAINNET_BACKEND_RPC_URLS = urls(
  optionalEnvUrls("BASE_MAINNET_BACKEND_RPC_URLS"),
  optionalEnvUrl("BASE_MAINNET_BACKEND_RPC_URL"),
  optionalEnvUrls("BASE_MAINNET_RPC_URLS"),
  optionalEnvUrl("BASE_MAINNET_RPC_URL"),
  optionalEnvUrls("NEXT_PUBLIC_BASE_MAINNET_RPC_URLS"),
  optionalEnvUrl("NEXT_PUBLIC_BASE_MAINNET_RPC_URL"),
  BASE_MAINNET_PUBLIC_RPC_URLS
);

export const BASE_MAINNET_RPC_URLS = BASE_MAINNET_FRONTEND_RPC_URLS;

export const NETWORKS = {
  baseMainnet: {
    chainId: 8453,
    name: "Base",
    shortName: "base",
    rpcUrls: BASE_MAINNET_RPC_URLS,
    frontendRpcUrls: BASE_MAINNET_FRONTEND_RPC_URLS,
    backendRpcUrls: BASE_MAINNET_BACKEND_RPC_URLS,
    blockExplorer: "https://basescan.org",
    vrf: {
      coordinator: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634",
      keyHash: "0xdc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d70",
      subId: env("VRF_SUB_ID_MAINNET"),
      callbackGasLimit: 200_000,
      requestConfirmations: 3
    },
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
  }
} satisfies Record<string, ChainConfig>;

export type NetworkKey = keyof typeof NETWORKS;
export const ACTIVE_NETWORKS = ["baseMainnet"] as const;
export const DEFAULT_NETWORK: NetworkKey = "baseMainnet";

export function getNetworkByChainId(chainId: number): ChainConfig | undefined {
  return Object.values(NETWORKS).find((network) => network.chainId === chainId);
}

export function getNetworkKey(chainId?: number): NetworkKey | undefined {
  if (!chainId) return undefined;
  const entry = Object.entries(NETWORKS).find(([, network]) => network.chainId === chainId);
  return entry?.[0] as NetworkKey | undefined;
}
