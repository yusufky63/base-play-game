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
  blockExplorer: string;
  vrf: VRFConfig;
  testnet: boolean;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}
