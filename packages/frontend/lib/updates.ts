export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 6, 2026",
    title: "Indexer polling hardened",
    body: "The backend indexer now avoids fragile RPC filter subscriptions, polls settled Base events from saved checkpoints, skips unreliable BlockPI endpoints, and keeps admin health errors short and readable."
  },
  {
    date: "May 6, 2026",
    title: "Vercel monorepo build fixed",
    body: "Production deploys now install build dependencies explicitly and compile the shared workspace before the frontend, so Tailwind and shared contract config resolve correctly on Vercel."
  },
  {
    date: "May 6, 2026",
    title: "Wallet build dependency fixed",
    body: "The frontend now includes the bs58 dependency required by the Base/Coinbase wallet connector chain, preventing production builds from failing during wallet component SSR."
  },
  {
    date: "May 6, 2026",
    title: "Admin analytics and public contract links added",
    body: "Game pages and Docs now expose explorer-ready contract addresses, while Admin adds per-game totals, paginated logs, vault liquidity USD/risk alerts, emergency withdraw controls, and Supabase fallback health."
  },
  {
    date: "May 6, 2026",
    title: "XP, refunds, and player docs clarified",
    body: "XP now follows wager size instead of win luck, pending refund tracking explains reopen/reconnect behavior, Scratch Card now presents one VRF ticket, and the Docs page includes a player-focused FAQ."
  },
  {
    date: "May 6, 2026",
    title: "Refund flow separated from VRF status",
    body: "Claim refund now clears the active game verification state and no longer shows refund transactions as if they were new Chainlink VRF rounds."
  },
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
