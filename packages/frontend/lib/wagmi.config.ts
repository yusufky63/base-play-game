import { fallback, http } from "viem";
import { createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { BASE_MAINNET_FRONTEND_RPC_URLS, BASE_SEPOLIA_FRONTEND_RPC_URLS } from "@baseplay/shared/config/networks";

const baseSepoliaTransports = BASE_SEPOLIA_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 1, retryDelay: 250 }));

const baseMainnetTransports = BASE_MAINNET_FRONTEND_RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 1, retryDelay: 250 }));

export const chains = [baseSepolia, base] as const;

export const wagmiConfig = createConfig({
  chains,
  ssr: true,
  connectors: [
    injected({ target: "metaMask" }),
    injected(),
    coinbaseWallet({ appName: "BasePlay" })
  ],
  transports: {
    [baseSepolia.id]: fallback(baseSepoliaTransports),
    [base.id]: fallback(baseMainnetTransports)
  }
});
