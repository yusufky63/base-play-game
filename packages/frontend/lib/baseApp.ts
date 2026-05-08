import { env } from "@/lib/env";

export const BASE_APP_APP_ID = "69f93e9942d4fe010f1c28e7";

const appUrl = env.NEXT_PUBLIC_APP_URL || "https://baseplay.games";

export const BASE_APP_METADATA = {
  appId: BASE_APP_APP_ID,
  name: "BasePlay",
  tagline: "Mini onchain games on Base",
  description: "Provably fair mini games with on-chain settlement and Chainlink VRF randomness.",
  category: "Games",
  iconUrl: `${appUrl}/brand/baseplay-mark-transparent.png`,
  imageUrl: `${appUrl}/brand/baseplay-logo-full.png`,
  primaryUrl: appUrl
};

export function baseProfileUrl(address: string) {
  return `https://base.app/profile/${address}`;
}

export function baseAppChecklist() {
  return [
    "Wallet connection and contract writes use wagmi/viem with Base Account, injected wallet, and Coinbase Wallet connectors, with wallet address as the canonical identity.",
    "The Base App ID meta tag is present in the root Next.js metadata.",
    "Wallet transactions include the registered BasePlay Builder Code attribution suffix.",
    "Shared contract status and pending-round fallback reads use multicall batching to reduce RPC pressure.",
    "Connected wallet address is the user identity in Base App.",
    "Basename display is resolved as a display layer and never replaces wallet-address identity.",
    "No Farcaster-only SDK method is required for core auth, wallet, sharing, or navigation.",
    "App metadata should be registered on Base.dev with primary URL, icon, preview image, screenshots, category, tagline, description, and builder code."
  ];
}
