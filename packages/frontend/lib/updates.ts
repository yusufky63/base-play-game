export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 6, 2026",
    title: "Round verification and game feedback improved",
    body: "Live feed no longer exposes internal data-source labels, Mines now shows a clear risk preview for selected mine count, and round polling handles Base RPC log-range limits more safely."
  },
  {
    date: "May 6, 2026",
    title: "Pending refund tracking added",
    body: "Connected players can now see unresolved on-chain rounds in the wallet menu and profile page, including refund availability after the contract timeout window."
  },
  {
    date: "May 6, 2026",
    title: "Profile and leaderboard data fixed",
    body: "Supabase production migrations now expose profile game stats, global stats, ranked weekly leaderboard data, and backend indexer checkpoints with stricter public access controls."
  },
  {
    date: "May 6, 2026",
    title: "Production data checks added",
    body: "Backend startup now reports missing production variables clearly, and Supabase schema checks help verify profile, leaderboard, and live feed data before launch."
  },
  {
    date: "May 6, 2026",
    title: "Base mainnet contracts deployed",
    body: "BasePlay contracts are now deployed on Base mainnet with Chainlink VRF consumers configured, vault reserves enabled, production default network set to Base, and Railway backend packaging prepared."
  }
];
