# 01 — Architecture

## Tech Stack

| Layer | Technology | Version | Docs |
|-------|-----------|---------|------|
| Frontend | Next.js (App Router) | 14.x | [nextjs.org/docs](https://nextjs.org/docs) |
| Wallet | Wagmi + RainbowKit | v2 | [wagmi.sh](https://wagmi.sh) |
| Low-level ETH | Viem | v2 | [viem.sh](https://viem.sh) |
| Styling | Tailwind CSS | 3.x | [tailwindcss.com/docs](https://tailwindcss.com/docs) |
| Animation | Framer Motion | 11.x | [motion.dev/docs](https://motion.dev/docs) |
| Icons | Lucide React | latest | [lucide.dev](https://lucide.dev) |
| Fonts | Inter + JetBrains Mono | — | [fonts.google.com](https://fonts.google.com) |
| Theme | next-themes | 0.3.x | [github.com/pacocoursey/next-themes](https://github.com/pacocoursey/next-themes) |
| Identity | OnchainKit (Basename) | 0.35.x | [docs.base.org/base-account](https://docs.base.org/base-account/overview/what-is-base-account) |
| Mini-app | OnchainKit MiniKit | 0.35.x | [docs.base.org/apps](https://docs.base.org/apps) |
| Backend | Node.js + Express | 20 LTS | [nodejs.org/docs](https://nodejs.org/docs/latest/api/) |
| WebSocket | Socket.io | 4.x | [socket.io/docs/v4](https://socket.io/docs/v4/) |
| Cache | Redis + ioredis | 7.x | [redis.io/docs](https://redis.io/docs/) |
| Database | Supabase (PostgreSQL) | — | [supabase.com/docs](https://supabase.com/docs) |
| Blockchain | Solidity 0.8.24 | — | [docs.soliditylang.org](https://docs.soliditylang.org) |
| Contracts | OpenZeppelin | 5.x | [docs.openzeppelin.com](https://docs.openzeppelin.com) |
| Randomness | Chainlink VRF v2.5 | — | [docs.chain.link/vrf](https://docs.chain.link/vrf) |
| Deploy | Remix IDE | — | [remix-ide.readthedocs.io](https://remix-ide.readthedocs.io) |
| Tests | Hardhat | 2.x | [hardhat.org/docs](https://hardhat.org/docs) |
| Hosting FE | Vercel | — | [vercel.com/docs](https://vercel.com/docs) |
| Hosting BE | Railway | — | [docs.railway.com](https://docs.railway.com) |
| RPC | Alchemy | — | [docs.alchemy.com](https://docs.alchemy.com) |

---

## Network Configuration

All network definitions live in one file. Adding a new chain = adding one object.

```ts
// packages/shared/config/networks.ts

export interface VRFConfig {
  coordinator:          string;
  keyHash:              string;
  subId:                string;
  callbackGasLimit:     number;
  requestConfirmations: number;
}

export interface ChainConfig {
  chainId:        number;
  name:           string;
  shortName:      string;
  rpcUrls:        string[]; // priority order — primary first
  blockExplorer:  string;
  vrf:            VRFConfig;
  mainnet:        boolean;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const NETWORKS: Record<string, ChainConfig> = {
  baseMainnet: {
    chainId:   8453,
    name:      "Base mainnet",
    shortName: "base",
    rpcUrls: [
      process.env.ALCHEMY_BASE_MAINNET_URL!,                    // Primary (Alchemy)
      "https://mainnet.base.org",                                // Fallback 1 (official)
      "https://base-rpc.publicnode.com",                 // Fallback 2
      "https://base.blockpi.network/v1/rpc/public",      // Fallback 3
    ],
    blockExplorer: "https://basescan.org",
    vrf: {
      coordinator:          "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE",
      keyHash:              "0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71",
      subId:                process.env.VRF_SUB_ID_mainnet!,
      callbackGasLimit:     200_000,
      requestConfirmations: 3,
    },
    mainnet:        true,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },

  baseMainnet: {
    chainId:   8453,
    name:      "Base",
    shortName: "base",
    rpcUrls: [
      process.env.ALCHEMY_BASE_MAINNET_URL!,
      "https://mainnet.base.org",
      "https://base-rpc.publicnode.com",
      "https://base.blockpi.network/v1/rpc/public",
    ],
    blockExplorer: "https://basescan.org",
    vrf: {
      coordinator:          "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634",
      keyHash:              "0xcc294a196eeeb44da2888d17c0625cc88d70d9760a69d58d853ba6581a9ab0cd",
      subId:                process.env.VRF_SUB_ID_MAINNET!,
      callbackGasLimit:     200_000,
      requestConfirmations: 3,
    },
    mainnet:        false,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },

  // To add a new chain: add one object here — everything else adapts automatically.
};

export type NetworkKey        = keyof typeof NETWORKS;
export const ACTIVE_NETWORKS  = ["baseMainnet"] as const;
export const DEFAULT_NETWORK: NetworkKey = "baseMainnet";

export function getNetworkByChainId(chainId: number): ChainConfig | undefined {
  return Object.values(NETWORKS).find(n => n.chainId === chainId);
}

export function getNetworkKey(chainId?: number): NetworkKey | undefined {
  if (!chainId) return undefined;
  const entry = Object.entries(NETWORKS).find(([, v]) => v.chainId === chainId);
  return entry?.[0] as NetworkKey;
}
```

---

## Contract Addresses Map

Update this file after each Remix deploy.

```ts
// packages/shared/config/addresses.ts

export const CONTRACT_ADDRESSES: Record<number, Record<string, `0x${string}`>> = {
  8453: { // Base mainnet
    GameVault:    "0x...",
    CoinFlipGame: "0x...",
    DiceGame:     "0x...",
    CrashGame:    "0x...",
    MinesGame:    "0x...",
    HiLoGame:     "0x...",
    Leaderboard:  "0x...",
    Referral:     "0x...",
  },
  8453: { // Base Mainnet
    GameVault:    "0x...",
    CoinFlipGame: "0x...",
    DiceGame:     "0x...",
    CrashGame:    "0x...",
    MinesGame:    "0x...",
    HiLoGame:     "0x...",
    Leaderboard:  "0x...",
    Referral:     "0x...",
  },
};

export function getContractAddress(
  chainId: number,
  name: string
): `0x${string}` {
  const addr = CONTRACT_ADDRESSES[chainId]?.[name];
  if (!addr) throw new Error(`Contract "${name}" not found for chainId ${chainId}`);
  return addr;
}
```

---

## Game Registry

Adding a new game = adding one object here. Frontend, backend, and leaderboard adapt automatically.

```ts
// packages/shared/config/games.registry.ts

export interface GameConfig {
  id:                string;
  name:              string;
  description:       string;
  path:              string;
  contractName:      string;   // key in addresses.ts
  minBetEth:         string;   // "0.0002"
  maxBetEth:         string;   // "0.001"
  houseEdgePercent:  number;
  maxMultiplier:     number;
  active:            boolean;
  chains:            string[]; // keys from NETWORKS
  requiresWebSocket: boolean;  // true only for Crash
  tags:              string[];
}

export const GAMES_REGISTRY: GameConfig[] = [
  {
    id: "coin-flip", name: "Coin Flip",
    description: "Heads or tails? Simplest onchain bet.",
    path: "/games/coin-flip",
    contractName: "CoinFlipGame",
    minBetEth: "0.0002", maxBetEth: "0.001",
    houseEdgePercent: 3, maxMultiplier: 2,
    active: true, chains: ["baseMainnet"],
    requiresWebSocket: false, tags: ["simple", "fast"],
  },
  {
    id: "dice", name: "Dice",
    description: "Guess 1–6. Right guess pays 5.82×.",
    path: "/games/dice",
    contractName: "DiceGame",
    minBetEth: "0.0002", maxBetEth: "0.001",
    houseEdgePercent: 3, maxMultiplier: 6,
    active: true, chains: ["baseMainnet"],
    requiresWebSocket: false, tags: ["simple", "fast"],
  },
  {
    id: "crash", name: "Crash",
    description: "Multiplier rises — cash out before it crashes.",
    path: "/games/crash",
    contractName: "CrashGame",
    minBetEth: "0.0002", maxBetEth: "0.001",
    houseEdgePercent: 3, maxMultiplier: 10,
    active: true, chains: ["baseMainnet"],
    requiresWebSocket: true, tags: ["popular", "realtime"],
  },
  {
    id: "mines", name: "Mines",
    description: "Reveal gems, avoid bombs. Multiplier grows.",
    path: "/games/mines",
    contractName: "MinesGame",
    minBetEth: "0.0002", maxBetEth: "0.001",
    houseEdgePercent: 3, maxMultiplier: 20,
    active: true, chains: ["baseMainnet"],
    requiresWebSocket: false, tags: ["strategy"],
  },
  {
    id: "hilo", name: "Hi-Lo",
    description: "Predict next card. Chain wins to multiply.",
    path: "/games/hilo",
    contractName: "HiLoGame",
    minBetEth: "0.0002", maxBetEth: "0.001",
    houseEdgePercent: 3, maxMultiplier: 8,
    active: true, chains: ["baseMainnet"],
    requiresWebSocket: false, tags: ["strategy", "fast"],
  },
  // Add new games here — everything else adapts automatically.
];

export const getGame        = (id: string)          => GAMES_REGISTRY.find(g => g.id === id);
export const getActiveGames = (networkKey: string)  =>
  GAMES_REGISTRY.filter(g => g.active && g.chains.includes(networkKey));
```

---

## Monorepo Folder Structure

```
baseplay/
├── package.json                       # pnpm workspaces
├── pnpm-workspace.yaml
├── .env.example
│
├── packages/
│   ├── shared/                        # Shared between frontend and backend
│   │   ├── abis/                      # ABI files copied from Remix
│   │   │   ├── GameVault.json
│   │   │   ├── CoinFlipGame.json
│   │   │   ├── DiceGame.json
│   │   │   ├── CrashGame.json
│   │   │   ├── MinesGame.json
│   │   │   ├── HiLoGame.json
│   │   │   ├── Leaderboard.json
│   │   │   └── Referral.json
│   │   ├── types/
│   │   │   ├── game.types.ts
│   │   │   ├── network.types.ts
│   │   │   └── supabase.types.ts      # Generated by: supabase gen types
│   │   └── config/
│   │       ├── networks.ts            # All network definitions
│   │       ├── games.registry.ts      # All game definitions
│   │       └── addresses.ts           # chainId → contract address map
│   │
│   ├── contracts/                     # Solidity (deployed via Remix)
│   │   ├── core/
│   │   │   ├── GameVault.sol
│   │   │   └── VRFConsumer.sol
│   │   ├── games/
│   │   │   ├── BaseGame.sol           # Abstract — all games extend this
│   │   │   ├── CoinFlipGame.sol
│   │   │   ├── DiceGame.sol
│   │   │   ├── CrashGame.sol
│   │   │   ├── MinesGame.sol
│   │   │   └── HiLoGame.sol
│   │   ├── periphery/
│   │   │   ├── Leaderboard.sol
│   │   │   └── Referral.sol
│   │   └── test/
│   │       ├── MockVRFCoordinator.sol
│   │       └── ReentrancyAttack.sol
│   │
│   ├── frontend/                      # Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Home — game list
│   │   │   ├── globals.css            # Design tokens
│   │   │   ├── games/
│   │   │   │   ├── coin-flip/page.tsx
│   │   │   │   ├── dice/page.tsx
│   │   │   │   ├── crash/page.tsx
│   │   │   │   ├── mines/page.tsx
│   │   │   │   └── hilo/page.tsx
│   │   │   ├── leaderboard/page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx           # Dashboard
│   │   │   │   ├── games/page.tsx
│   │   │   │   ├── vault/page.tsx
│   │   │   │   └── logs/page.tsx
│   │   │   └── api/
│   │   │       └── frame/
│   │   │           └── [game]/route.ts  # Farcaster Frame API
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── Footer.tsx
│   │   │   ├── wallet/
│   │   │   │   ├── WalletProvider.tsx
│   │   │   │   ├── BasenameDisplay.tsx
│   │   │   │   └── ChainSwitcher.tsx
│   │   │   ├── game/
│   │   │   │   ├── BetPanel.tsx
│   │   │   │   ├── GameHistory.tsx
│   │   │   │   ├── LiveFeed.tsx
│   │   │   │   ├── RecentWinners.tsx
│   │   │   │   ├── WinTicker.tsx
│   │   │   │   ├── BigWinToast.tsx
│   │   │   │   ├── FairnessModal.tsx
│   │   │   │   └── VRFPendingOverlay.tsx
│   │   │   ├── leaderboard/
│   │   │   │   ├── LeaderboardTable.tsx
│   │   │   │   └── WeeklyCountdown.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Toast.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Logo.tsx
│   │   │       ├── ThemeToggle.tsx
│   │   │       └── ErrorBoundary.tsx
│   │   ├── games/
│   │   │   ├── coin-flip/
│   │   │   │   ├── CoinFlipCanvas.tsx
│   │   │   │   └── useCoinFlip.ts
│   │   │   ├── dice/
│   │   │   │   ├── DiceCanvas.tsx
│   │   │   │   └── useDice.ts
│   │   │   ├── crash/
│   │   │   │   ├── CrashCanvas.tsx
│   │   │   │   ├── CrashControls.tsx
│   │   │   │   └── useCrash.ts
│   │   │   ├── mines/
│   │   │   │   ├── MinesGrid.tsx
│   │   │   │   ├── MinesControls.tsx
│   │   │   │   └── useMines.ts
│   │   │   └── hilo/
│   │   │       ├── HiLoCard.tsx
│   │   │       ├── HiLoControls.tsx
│   │   │       └── useHiLo.ts
│   │   ├── hooks/
│   │   │   ├── useGame.ts             # Common hook for all games
│   │   │   ├── useRPC.ts              # Multi-RPC with fallback
│   │   │   ├── useVRF.ts              # VRF state machine
│   │   │   ├── useLeaderboard.ts
│   │   │   ├── useLiveFeed.ts
│   │   │   ├── useContractAddress.ts
│   │   │   ├── useBalance.ts
│   │   │   └── useMounted.ts          # SSR hydration fix
│   │   ├── lib/
│   │   │   ├── wagmi.config.ts
│   │   │   ├── rpc.ts                 # Fallback + rate limit
│   │   │   ├── supabase.ts
│   │   │   ├── env.ts                 # Zod env validation
│   │   │   ├── formatters.ts
│   │   │   └── errors.ts
│   │   └── middleware.ts              # Admin route protection
│   │
│   └── backend/
│       ├── src/
│       │   ├── index.ts
│       │   ├── config/env.ts          # Zod env validation
│       │   ├── services/
│       │   │   ├── eventListener.ts
│       │   │   ├── websocket.ts
│       │   │   └── crashEngine.ts
│       │   ├── games/
│       │   │   ├── coinflip.handler.ts
│       │   │   ├── dice.handler.ts
│       │   │   ├── crash.handler.ts
│       │   │   ├── mines.handler.ts
│       │   │   └── hilo.handler.ts
│       │   ├── supabase/
│       │   │   ├── client.ts
│       │   │   ├── queries.ts
│       │   │   └── migrations/
│       │   │       ├── 001_init.sql
│       │   │       ├── 002_leaderboard.sql
│       │   │       └── 003_rls_policies.sql
│       │   └── middleware/
│       │       ├── rateLimit.ts
│       │       └── errorHandler.ts
│       └── Dockerfile
│
├── scripts/
│   ├── copy-abis.sh                   # Copy ABIs from Remix to shared/abis/
│   ├── verify-contracts.sh            # Basescan verification
│   └── payout-leaderboard.ts          # Weekly prize payout
│
└── docs/                              # This documentation
```



