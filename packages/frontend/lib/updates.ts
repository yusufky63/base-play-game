export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
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
