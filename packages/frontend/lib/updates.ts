export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 20, 2026",
    title: "Render backend integration",
    body: "The production backend is now wired to the Render service at base-play-game.onrender.com with a backend-only workspace build, /health checks, and the same admin allowlist variables used by Lucky Draw and VRF operations. Backend indexing also creates missing player rows before settled rounds are stored, Lucky Draw proof candidates are checked against the live game contracts before the Open Lucky Draw button can use them, Render proxy headers are trusted for rate limiting, and contract failures now show draw-specific messages."
  },
  {
    date: "May 19, 2026",
    title: "Lucky Draw settlement tracking",
    body: "Lucky Draw now keeps the draw request ID and transaction visible while Chainlink VRF is pending, picks up resolved rewards from wallet history if the VRF event arrives after the first wait window, waits for prize claim transactions to be mined before showing success, removes claimed rows from the connected wallet claimable list immediately, highlights claimable history rows in green with a clearer claim button, over-reads the next proof bucket so available and progress counters stay more stable while indexing catches up, and preserves decimal prize labels such as $2.50 in the reward reel."
  },
  {
    date: "May 18, 2026",
    title: "Admin operations data restore",
    body: "Admin VRF and Lucky Draw operation reads now tolerate escaped line breaks in public backend URL environment values, production admin access supports a configured multi-wallet allowlist, backend admin reads use that allowlist so Subscription health and Reward treasury data can load again, and Lucky Draw daily cap controls fall back to 10/day instead of rendering undefined if an older admin response is cached."
  },
  {
    date: "May 18, 2026",
    title: "Lucky Draw and progression cleanup",
    body: "Lucky Draw now keeps only the top available, progress, and today counters, removes duplicated reward detail/reset cards, and uses the same VRF verification card pattern as game pages once a draw starts. Quests now include new daily and weekly goals, five new badge rewards, and clearer earned/locked or done states across the Quests page, profile badges, and progression widgets."
  },
  {
    date: "May 17, 2026",
    title: "Lucky Draw progress counter",
    body: "Lucky Draw progress now keeps counting the next draw after an available draw is earned, so one available draw can show 1/10, 2/10, and continue until the next available draw unlocks instead of staying at 10/10."
  },
  {
    date: "May 17, 2026",
    title: "Admin and Lucky Draw hardening",
    body: "Admin Lucky Draw and VRF operation reads now require the connected owner wallet signature, production no longer relies on hardcoded admin fallback wallets, Lucky Draw cards read active prize ETH values from config, and Supabase internal progression plus Lucky Draw functions have tighter execute grants."
  },
  {
    date: "May 17, 2026",
    title: "Lucky Draw How it works refresh",
    body: "Lucky Draw now uses the same collapsible How it works behavior as game pages, with a cleaner four-step flow for qualifying rounds, unlocked draws, the daily cap, and on-chain claiming."
  },
  {
    date: "May 17, 2026",
    title: "Lucky Draw daily status fallback",
    body: "Lucky Draw now keeps rendering if an older cached summary is missing the daily cap object, falling back to the configured cap while fresh daily status loads."
  },
  {
    date: "May 17, 2026",
    title: "Lucky Draw daily cap",
    body: "Lucky Draw now uses a 0.000115 ETH minimum eligible bet, a 2187 USD/ETH reference, and a soft 10 earned-draw daily cap that resets at 03:00 TSI. The Lucky Draw page and cards show available draws, next progress, today's cap status, and Base contract plus VRF verification panels above the draw area, while VRF operations have their own admin sidebar page."
  },
  {
    date: "May 17, 2026",
    title: "Lucky Draw claim visibility",
    body: "Lucky Draw now derives available draws from unconsumed proof-backed rounds, so 25 qualifying rounds can show two available draws plus 5/10 progress, and connected wallet history refreshes from player-filtered on-chain logs so resolved but unclaimed prizes stay visible as claimable."
  },
  {
    date: "May 16, 2026",
    title: "Lucky Draw prize weights",
    body: "Lucky Draw prize weights now favor smaller reward tiers, with the $1, $2.50, $5, and $10 tiers reduced for tighter promotional costs."
  },
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
