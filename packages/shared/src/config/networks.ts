import type { ChainConfig } from "../types/network.types.js";

export const BASE_SEPOLIA_RPC_URLS = [
  "https://sepolia.base.org",
  "https://base-sepolia.g.alchemy.com/v2/qeMia_xnXrvUzsNNiuFiH",
  "https://base-sepolia-rpc.publicnode.com",
  "https://base-sepolia.blockpi.network/v1/rpc/public"
];

export const BASE_MAINNET_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base-mainnet.g.alchemy.com/v2/qeMia_xnXrvUzsNNiuFiH",
  "https://base-rpc.publicnode.com",
  "https://base.blockpi.network/v1/rpc/public"
];

const env = (name: string) => process.env[name] ?? "";

export const NETWORKS = {
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    shortName: "base-sep",
    rpcUrls: BASE_SEPOLIA_RPC_URLS,
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
