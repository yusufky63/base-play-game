import { fallback, http } from "viem";
import { createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { createBaseAccountSDK } from "@base-org/account";
import { BASE_MAINNET_FRONTEND_RPC_URLS, BASE_SEPOLIA_FRONTEND_RPC_URLS } from "@baseplay/shared/config/networks";
import { walletConnectProjectId } from "@/lib/env";

const baseSepoliaTransports = BASE_SEPOLIA_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 1, retryDelay: 250 }));

const baseMainnetTransports = BASE_MAINNET_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 1, retryDelay: 250 }));

export const chains = [baseSepolia, base] as const;
export const rainbowKitEnabled = Boolean(walletConnectProjectId);

const baseAccount = injected({
  target: () => ({
    id: "baseAccount",
    name: "Base Account",
    provider: () => createBaseAccountSDK({ appName: "BasePlay" }).getProvider() as any
  })
});

export const wagmiConfig = createConfig({
  chains,
  ssr: true,
  connectors: [
    baseAccount,
    injected({ target: "metaMask" }),
    injected(),
    coinbaseWallet({ appName: "BasePlay" }),
    ...(walletConnectProjectId ? [walletConnect({ projectId: walletConnectProjectId })] : [])
  ],
  transports: {
    [baseSepolia.id]: fallback(baseSepoliaTransports),
    [base.id]: fallback(baseMainnetTransports)
  }
});
