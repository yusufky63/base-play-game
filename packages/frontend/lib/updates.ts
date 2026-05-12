export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 12, 2026",
    title: "RPC resilience",
    body: "Base mainnet reads now try public Base RPC first, production indexing defaults to mainnet, event polling is batched per game window, and the frontend can verify status directly if backend reads degrade."
  },
  {
    date: "May 8, 2026",
    title: "BasePlay live deploy",
    body: "BasePlay is live at baseplay.games with Base mainnet games, Chainlink VRF settlement, wallet support, social previews, cached stats, referrals, and production UI."
  }
];
