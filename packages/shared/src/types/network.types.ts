export interface VRFConfig {
  coordinator: string;
  keyHash: string;
  subId: string;
  callbackGasLimit: number;
  requestConfirmations: number;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrls: string[];
  frontendRpcUrls: string[];
  backendRpcUrls: string[];
  blockExplorer: string;
  vrf: VRFConfig;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}
