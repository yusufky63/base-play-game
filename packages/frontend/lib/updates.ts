export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 12, 2026",
    title: "RPC resilience",
    body: "BasePlay now runs mainnet-only in the app and backend, tries public Base RPC first, batches event polling per game window, and keeps direct frontend status fallback if backend reads degrade."
  },
  {
    date: "May 8, 2026",
    title: "BasePlay live deploy",
    body: "BasePlay is live at baseplay.games with Base mainnet games, Chainlink VRF settlement, wallet support, social previews, cached stats, referrals, and production UI."
  }
];
