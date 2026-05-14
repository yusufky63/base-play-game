import { createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { BASE_MAINNET_FRONTEND_RPC_URLS } from "@baseplay/shared/config/networks";
import { BASEPLAY_BUILDER_CODE_SUFFIX } from "@/lib/builderCode";
import { walletConnectProjectId } from "@/lib/env";
import { createPublicFirstTransport } from "@/lib/rpc";

export const chains = [base] as const;

export const wagmiConfig = createConfig({
  chains,
  ssr: true,
  connectors: [
    farcasterMiniApp(),
    injected(),
    coinbaseWallet({ appName: "BasePlay" }),
    walletConnect({
      projectId: walletConnectProjectId,
      showQrModal: true,
      metadata: {
        name: "BasePlay",
        description:
          "Provably fair mini games on Base with on-chain settlement, Chainlink VRF randomness, instant payouts, XP, quests, referrals, and weekly plus all-time leaderboards.",
        url: "https://baseplay.games",
        icons: ["https://baseplay.games/brand/baseplay-mark-transparent.png"]
      }
    })
  ],
  batch: {
    multicall: {
      wait: 16
    }
  },
  dataSuffix: BASEPLAY_BUILDER_CODE_SUFFIX,
  transports: {
    [base.id]: createPublicFirstTransport(BASE_MAINNET_FRONTEND_RPC_URLS, { timeout: 8_000, retryCount: 1, retryDelay: 250 })
  }
});
