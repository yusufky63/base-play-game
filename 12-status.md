# 12 - Current Status

Last checked: 2026-05-04.

## Implemented

- Frontend routes: `/`, 16 game pages, `/leaderboard`, `/live-feed`, `/profile`, `/profile/[address]`, `/docs`, `/updates`, `/base-app`, and `/admin/*`.
- Active games: Coin Flip, Dice, Crash, Mines, Hi-Lo, Over/Under, Limbo, Wheel, Plinko Lite, Color Pick, Treasure Chest, Lucky Seven, Roulette Lite, Scratch Card, Rock Paper Scissors, Slots.
- Contracts: `GameVault`, `VRFConsumer`, `BaseGame`, and all 16 game contracts above.
- New utility contracts:
  - `RouletteLiteGame`: 12-slot roulette with exact, color, and range bets. Max gross payout 12x.
  - `ScratchCardGame`: no client choice; VRF selects prize tier. Max gross payout 30x.
  - `RockPaperScissorsGame`: player move is locked pre-tx, VRF creates non-tie house move. Gross payout 2x.
  - `SlotsGame`: three VRF reels, pair/triple/jackpot payout table. Max gross payout 25x.
- Logic review update:
  - `CrashGame` uses a fair gross crash curve; the 3% house edge is applied once by `GameVault`.
  - `HiLoGame` rejects one-card edge choices that would exceed the 8x max payout instead of silently capping them.
  - `MinesGame` rejects reveal counts above the 20x max payout instead of silently capping them.
- Base Sepolia addresses and ABIs are present for all active games plus `GameVault`.
- Home game library has search, category filters, and per-game play counts.
- Global stats, game stats, compact live feed, full live feed, profile stats, and player rounds use React Query with Supabase-first reads, on-chain fallback, stale times, interval refresh, and manual refresh.
- Full live feed supports game filtering and cursor-style "Load older" pagination.
- Public profile exists at `/profile` and `/profile/[address]`; leaderboard/feed addresses link to profiles.
- Supabase migration `005_profile_stats_and_feed_pagination.sql` adds aggregate stats, player-game stats, weekly ranked view, RLS, Data API grants, indexes, backfill, and aggregate triggers.
- Shared Supabase type definitions include the new tables/views.
- Backend builds with Express, Socket.io, Redis, Supabase client, rate limiting, event listener, and crash engine.
- Basename display is wired through a local API resolver with short address fallback.
- Toasts, live feed fallback polling, fairness modal request/tx wiring, and refund UI are implemented.

## Verification

- `npm run test --workspace @baseplay/contracts`: passing, 39 tests.
- `npm --workspace @baseplay/contracts exec hardhat run scripts/economics-simulation.ts`: passing; 100-round smoke and 10,000-round stable simulation cover 16 game scenarios.
- Latest 10,000-round economics:
  - Roulette Lite exact: 97.31% player RTP, 2.69% vault profit.
  - Scratch Card: 95.45% player RTP, 4.55% vault profit.
  - Rock Paper Scissors: 97.04% player RTP, 2.96% vault profit.
  - Crash 2.50x: 96.71% player RTP, 3.29% vault profit.
  - Slots: 99.02% player RTP in latest 10,000-round sample; theoretical net RTP is lower, but jackpot variance is visible at this sample size.
- `npm --workspace @baseplay/shared run build`: passing.
- `npm run build --workspace @baseplay/backend`: passing.
- `npm run typecheck --workspace @baseplay/frontend`: passing.
- `npm run build --workspace @baseplay/frontend`: passing.

## Deployed On Base Sepolia

- `GameVault`: `0x3f82c3435d24dD723C9361517C0818672380ba91`
- `CoinFlipGame`: `0xdD69B92f6fAE6da3825b7d126Fe058e78E7F8482`
- `DiceGame`: `0x0DF136b94f99CAfcC010723b51f8D8EC10A0B907`
- `CrashGame`: `0x631347ae0178B14e216ed11B9559e334657063B4`
- `MinesGame`: `0x805E6206b52cd33BE2992e954d7f9d0e60698588`
- `HiLoGame`: `0x522fA3265D077B34572E088748164529641Fa5fc`
- `OverUnderGame`: `0x4B33c84CdCa6647D75dE93462292edA665c35800`
- `LimboGame`: `0x5D1e0f56b450cce7133CDb5c67d8ee758c2D6Bb8`
- `WheelGame`: `0x19BeE74068d18cF357798D36Dc2Ddc3e8D053c62`
- `PlinkoLiteGame`: `0x403597D06A9c28dbFb895fB160ece110F446F00F`
- `ColorPickGame`: `0x6a400e38066153964f8CF65CFBD00c4cAb1e752D`
- `TreasureChestGame`: `0xdCb405C7D581C9E53d19aac89B03c21925550aBf`
- `LuckySevenGame`: `0x1BCeD69DA32fD1272c0172455217aB87e0FFd394`
- `RouletteLiteGame`: `0x330695936b9A2ADbB3BaF69C526B03B75E372Be8`
- `ScratchCardGame`: `0xA9868B0511726522Ddf463489B51B7B7dC9Cd235`
- `RockPaperScissorsGame`: `0x40983083BcE51b7d36F17Ab8a84A0Ad078430F5b`
- `SlotsGame`: `0x6f3F319E2cfe256aaCf573D035CDB06c6fF7dd5C`

## Still Open

- Supabase remote migration has not been applied because the MCP server currently returns `Auth required`. Run `codex mcp login supabase`, then apply `packages/backend/supabase/migrations/005_profile_stats_and_feed_pagination.sql`.
- Base mainnet addresses are empty; mainnet deploy is blocked until `VRF_SUB_ID_MAINNET`, production liquidity, and final review are ready.
- Basescan verification is not automated yet.
- `Referral.sol` and `Leaderboard.sol` are not implemented. Decide whether to build them or keep progression/leaderboard fully off-chain in Supabase.
- Farcaster Frame routes and per-game OG image routes are not implemented.
- Mainnet still needs an independent security/risk review and a funded production VRF subscription before deploy.
