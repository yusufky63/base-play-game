import { base, baseSepolia } from "viem/chains";
import { BASE_MAINNET_RPC_URLS, BASE_SEPOLIA_RPC_URLS, NETWORKS, type NetworkKey } from "@baseplay/shared/config/networks";
import { defaultChainId, defaultNetworkKey } from "@/lib/env";

export function getDefaultNetworkConfig() {
  return getNetworkConfig(defaultNetworkKey);
}

export function getNetworkConfig(networkKey: NetworkKey) {
  const network = NETWORKS[networkKey];
  return {
    networkKey,
    network,
    chainId: network.chainId as 8453 | 84532,
    viemChain: network.chainId === 8453 ? base : baseSepolia,
    rpcUrls: network.chainId === 8453 ? BASE_MAINNET_RPC_URLS : BASE_SEPOLIA_RPC_URLS
  };
}

export function getNetworkConfigByChainId(chainId = defaultChainId) {
  return chainId === 8453 ? getNetworkConfig("baseMainnet") : getNetworkConfig("baseSepolia");
}
