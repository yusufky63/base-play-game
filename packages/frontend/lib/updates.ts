export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 12, 2026",
    title: "RPC resilience",
    body: "BasePlay now keeps Base public RPCs first across app and backend reads, only falling back to private RPCs when public endpoints fail or rate-limit."
  },
  {
    date: "May 8, 2026",
    title: "BasePlay live deploy",
    body: "BasePlay is live at baseplay.games with Base mainnet games, Chainlink VRF settlement, wallet support, social previews, cached stats, referrals, and production UI."
  }
];
