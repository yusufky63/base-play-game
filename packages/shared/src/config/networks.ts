import type { ChainConfig } from "../types/network.types.js";

const env = (name: string) => process.env[name] ?? "";
const optionalEnvUrl = (name: string) => {
  const value = env(name).trim();
  return value.length > 0 ? value : null;
};

function urls(...values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export const BASE_SEPOLIA_FRONTEND_RPC_URLS = urls(
  optionalEnvUrl("NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL"),
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com"
);

export const BASE_MAINNET_FRONTEND_RPC_URLS = urls(
  optionalEnvUrl("NEXT_PUBLIC_BASE_MAINNET_RPC_URL"),
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com"
);

export const BASE_SEPOLIA_BACKEND_RPC_URLS = urls(
  optionalEnvUrl("BASE_SEPOLIA_BACKEND_RPC_URL"),
  optionalEnvUrl("BASE_SEPOLIA_RPC_URL"),
  optionalEnvUrl("NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL"),
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com"
);

export const BASE_MAINNET_BACKEND_RPC_URLS = urls(
  optionalEnvUrl("BASE_MAINNET_BACKEND_RPC_URL"),
  optionalEnvUrl("BASE_MAINNET_RPC_URL"),
  optionalEnvUrl("NEXT_PUBLIC_BASE_MAINNET_RPC_URL"),
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com"
);

export const BASE_SEPOLIA_RPC_URLS = BASE_SEPOLIA_FRONTEND_RPC_URLS;
export const BASE_MAINNET_RPC_URLS = BASE_MAINNET_FRONTEND_RPC_URLS;

export const NETWORKS = {
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    shortName: "base-sep",
    rpcUrls: BASE_SEPOLIA_RPC_URLS,
    frontendRpcUrls: BASE_SEPOLIA_FRONTEND_RPC_URLS,
    backendRpcUrls: BASE_SEPOLIA_BACKEND_RPC_URLS,
    blockExplorer: "https://sepolia.basescan.org",
    vrf: {
      coordinator: "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE",
      keyHash: "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71",
      subId: env("VRF_SUB_ID_SEPOLIA"),
      callbackGasLimit: 200_000,
      requestConfirmations: 3
    },
    testnet: true,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
  },
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
    testnet: false,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
  }
} satisfies Record<string, ChainConfig>;

export type NetworkKey = keyof typeof NETWORKS;
export const ACTIVE_NETWORKS = ["baseSepolia", "baseMainnet"] as const;
export const DEFAULT_NETWORK: NetworkKey = "baseSepolia";

export function getNetworkByChainId(chainId: number): ChainConfig | undefined {
  return Object.values(NETWORKS).find((network) => network.chainId === chainId);
}

export function getNetworkKey(chainId?: number): NetworkKey | undefined {
  if (!chainId) return undefined;
  const entry = Object.entries(NETWORKS).find(([, network]) => network.chainId === chainId);
  return entry?.[0] as NetworkKey | undefined;
}
