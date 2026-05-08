# 11 — Roadmap & Checklists

## Development Phases

### Phase 1 — MVP (Weeks 1–6)

Goal: 3 games working on Base Sepolia testnet.

```
CONTRACT WORK
─────────────────────────────────────────────────────────────
[ ] Write VRFConsumer.sol
[ ] Write GameVault.sol with all security measures
[ ] Write BaseGame.sol abstract contract
[ ] Write CoinFlipGame.sol
[ ] Write DiceGame.sol
[ ] Write CrashGame.sol
[ ] Write MockVRFCoordinator.sol (for tests)
[ ] Write ReentrancyAttack.sol (for tests)
[ ] Write Hardhat test suite (target: >90% coverage)
[ ] Run all tests: npx hardhat test
[ ] Run Remix Static Analysis — fix all warnings
[ ] Deploy to Base Sepolia (follow docs/03-deploy.md)
[ ] Verify all contracts on sepolia.basescan.org
[ ] Update packages/shared/config/addresses.ts

DATABASE
─────────────────────────────────────────────────────────────
[ ] Create Supabase project
[ ] Run 001_init.sql migration
[ ] Run 002_leaderboard.sql migration
[ ] Run 003_rls_policies.sql migration
[ ] Enable pg_cron extension
[ ] Enable Realtime for game_rounds and leaderboard_weekly
[ ] Run: supabase gen types typescript → shared/types/supabase.types.ts

BACKEND
─────────────────────────────────────────────────────────────
[ ] Set up Node.js + Express project
[ ] Implement env.ts Zod validation
[ ] Implement event listener (CoinFlip, Dice, Crash)
[ ] Implement Crash WebSocket engine (Redis + Socket.io)
[ ] Set up rate limiting middleware
[ ] Deploy to Railway

FRONTEND
─────────────────────────────────────────────────────────────
[ ] Bootstrap Next.js 14 with App Router
[ ] Install all dependencies (see docs/04-frontend.md)
[ ] Configure Wagmi with multi-RPC fallback
[ ] Implement light/dark mode (next-themes)
[ ] Build WalletProvider + BasenameDisplay
[ ] Build ChainSwitcher
[ ] Build BetPanel component
[ ] Build CoinFlip game page + canvas
[ ] Build Dice game page + canvas
[ ] Build Crash game page + canvas
[ ] Build LiveFeed (Supabase Realtime)
[ ] Build WinTicker (Supabase Realtime)
[ ] Build BigWinToast (Supabase Realtime)
[ ] Build VRFPendingOverlay + FairnessModal
[ ] Build Home page (game grid + stats)
[ ] Build Leaderboard page
[ ] Build Admin dashboard
[ ] Deploy to Vercel

INTEGRATION CHECKS
─────────────────────────────────────────────────────────────
[ ] Play one complete CoinFlip round end-to-end
[ ] Play one complete Dice round end-to-end
[ ] Play one complete Crash round end-to-end
[ ] VRF proof visible in FairnessModal
[ ] claimRefund works after timeout
[ ] LiveFeed updates in real time
[ ] Leaderboard updates after each round
[ ] Admin stats show correct numbers
[ ] Chain switch works (Sepolia ↔ Mainnet toggle)
[ ] Both light and dark mode render correctly
[ ] Basename resolves in header
[ ] Mobile layout works on 375px viewport
```

---

### Phase 2 — Expansion (Weeks 7–14)

```
[ ] Write MinesGame.sol + tests
[ ] Write HiLoGame.sol + tests
[ ] Write Referral.sol + tests
[ ] Write Leaderboard.sol + tests
[ ] Add games to registry and deploy
[ ] Build Mines game page + 5×5 grid
[ ] Build Hi-Lo game page + card animation
[ ] Build Referral system UI
[ ] Build weekly leaderboard with prize pool display
[ ] Implement payout-leaderboard.ts script
[ ] Farcaster Frame meta tags on all game pages
[ ] Frame API routes (api/frame/[game]/route.ts)
[ ] MiniKit provider + config
[ ] BigWinToast — 3× threshold
[ ] RecentWinners grid on home page
[ ] Admin: Games page (pause/resume per game)
[ ] Admin: Vault page (balance + withdraw)
[ ] Admin: Logs page (filtered transaction history)
[ ] 48-hour testnet soak test
```

---

### Phase 3 — Mainnet & Social (Weeks 15+)

```
[ ] Independent code review
[ ] Owner wallet → hardware wallet (Ledger/Trezor)
[ ] Consider Gnosis Safe multisig (2-of-3)
[ ] Set up Chainlink VRF email alerts
[ ] Deploy all contracts to Base Mainnet
[ ] Verify all contracts on basescan.org
[ ] Update addresses.ts with mainnet addresses
[ ] OG image generation per game (/og/[game].png)
[ ] Farcaster Mini App submission
[ ] Base App listing
[ ] NFT achievement badges (optional)
[ ] Number Guess game
[ ] Rock Paper Scissors game
[x] Plinko Lite game
[x] Wheel game
[x] Color Pick game
[x] Treasure Chest game
[x] Lucky Seven game
[x] Roulette Lite game
[x] Scratch Card game
[x] Rock Paper Scissors game
[x] Slots game
[x] Public profile pages
[x] Game library search and category filters
[x] Supabase-first cached stats/feed hooks
```

---

## Pre-Testnet Deploy Checklist

```
[ ] npx hardhat test — all passing
[ ] npx hardhat coverage — >90%
[ ] Remix Static Analysis — no high/critical warnings
[ ] GameVault.canAcceptBet(0.001 ETH) → true
[ ] VRF subscription funded with 5+ LINK
[ ] All consumers added to VRF subscription
[ ] contracts verified on Basescan
[ ] Played at least one real round per game
[ ] VRF proof verified manually on Basescan
[ ] claimRefund tested
[ ] Admin pause/unpause tested
[ ] setMinBet/setMaxBet tested via Remix
```

## Pre-Mainnet Deploy Checklist

```
[ ] All testnet checklist items completed
[ ] 48+ hours of testnet operation with no issues
[ ] Independent code review completed
[ ] Owner wallet is a hardware wallet
[ ] Initial vault liquidity ready (min 0.5 ETH)
[ ] VRF subscription funded on mainnet
[ ] Mainnet VRF coordinator and keyHash correct
[ ] addresses.ts updated for chainId 8453
[ ] All Basescan (mainnet) contracts verified
[ ] Monitoring set up (Supabase alerts + VRF alerts)
```

---

## Environment Setup Checklist (First Time)

```
[ ] Node.js v20+ LTS installed
[ ] pnpm v8+ installed: npm install -g pnpm
[ ] Git repository cloned
[ ] pnpm install (root)
[ ] packages/frontend/.env.local created and filled
[ ] packages/backend/.env created and filled
[ ] Supabase project created — URL + keys noted
[ ] Alchemy project created — API keys noted
[ ] WalletConnect project created — project ID noted
[ ] Redis running: docker run -d -p 6379:6379 redis:7-alpine
[ ] Supabase migrations applied (3 files in order)
[ ] pg_cron enabled in Supabase Dashboard → Extensions
[ ] supabase gen types run
[ ] Contracts deployed via Remix (docs/03-deploy.md)
[ ] ABIs copied to shared/abis/ (scripts/copy-abis.sh)
[ ] addresses.ts updated
[ ] pnpm dev (frontend) — no console errors
[ ] pnpm dev (backend) — event listener connected
```

---

## Adding a New Game (Any Phase)

```
[ ] Write GameName.sol → extend BaseGame, implement _processResult()
[ ] Write test/GameNameGame.test.ts → target >90% coverage
[ ] Run tests: npx hardhat test test/GameNameGame.test.ts
[ ] Run Remix Static Analysis
[ ] Deploy via Remix:
    [ ] GameVault.approveGame(GAME_ADDR)
    [ ] VRF Subscription.addConsumer(GAME_ADDR)
[ ] Copy ABI to shared/abis/GameNameGame.json
[ ] Add entry to shared/config/games.registry.ts
[ ] Add address to shared/config/addresses.ts (both chainIds)
[ ] Create app/games/game-name/page.tsx
[ ] Build game-specific canvas component
[ ] Test end-to-end: play one full round
[ ] Verify contract on Basescan
```

---

## Adding a New Network

```
[ ] Add ChainConfig object to shared/config/networks.ts
[ ] Add transport to wagmi.config.ts
[ ] Add addresses object to addresses.ts (fill after deploy)
[ ] Add chain to wagmi config chains array
[ ] Update ACTIVE_NETWORKS array
[ ] Add environment variables (.env files)
[ ] Deploy all contracts on new network (docs/03-deploy.md)
[ ] Update addresses.ts
[ ] Test chain switching in UI
```
