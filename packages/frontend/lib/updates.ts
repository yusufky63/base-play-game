export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 15, 2026",
    title: "On-chain Lucky Draw",
    body: "Lucky Draw now has contract and VRF status panels, USD values on wins, own rewards, and cached paginated public history."
  },
  {
    date: "May 14, 2026",
    title: "Lucky Draw rewards",
    body: "Players now unlock an ETH-denominated Lucky Draw after every 10 qualifying settled rounds, with admin controls for pause state, prize weights, ETH reference pricing, and payout status."
  },
  {
    date: "May 13, 2026",
    title: "RPC resilience",
    body: "BasePlay now keeps Base public RPCs first and batches backend event indexing into one log scan across deployed games per poll window."
  },
  {
    date: "May 8, 2026",
    title: "BasePlay live deploy",
    body: "BasePlay is live at baseplay.games with Base mainnet games, Chainlink VRF settlement, wallet support, social previews, cached stats, referrals, and production UI."
  }
];
