import { base } from "viem/chains";
import { BASE_MAINNET_FRONTEND_RPC_URLS, NETWORKS, type NetworkKey } from "@baseplay/shared/config/networks";
import { defaultChainId, defaultNetworkKey } from "@/lib/env";

export function getDefaultNetworkConfig() {
  return getNetworkConfig(defaultNetworkKey);
}

export function getNetworkConfig(networkKey: NetworkKey) {
  const network = NETWORKS[networkKey];
  return {
    networkKey,
    network,
    chainId: network.chainId as 8453,
    viemChain: base,
    rpcUrls: BASE_MAINNET_FRONTEND_RPC_URLS
  };
}

export function getNetworkConfigByChainId(chainId = defaultChainId) {
  return getNetworkConfig(chainId === 8453 ? "baseMainnet" : defaultNetworkKey);
}
