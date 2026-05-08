import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BasePlay",
    short_name: "BasePlay",
    description:
      "Provably fair mini games on Base with on-chain settlement, Chainlink VRF randomness, instant payouts, XP, quests, referrals, and weekly plus all-time leaderboards.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b5cff",
    categories: ["games", "finance"],
    icons: [
      {
        src: "/brand/baseplay-mark-transparent.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand/baseplay-mark-transparent.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
