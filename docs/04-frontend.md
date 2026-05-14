# 04 — Frontend

> Next.js 14: [nextjs.org/docs](https://nextjs.org/docs)
> Wagmi: [wagmi.sh](https://wagmi.sh)
> RainbowKit: [rainbowkit.com/docs](https://www.rainbowkit.com/docs/introduction)
> Viem: [viem.sh](https://viem.sh)

---

## Dependencies

```bash
npm install \
  wagmi@^2 \
  viem@^2 \
  @tanstack/react-query@^5 \
  @rainbow-me/rainbowkit@^2 \
  @coinbase/onchainkit@^0.35 \
  next-themes@^0.3 \
  lucide-react \
  framer-motion@^11 \
  zod@^3 \
  @supabase/supabase-js@^2 \
  @farcaster/frame-sdk
```

---

## Environment Validation (Zod)

Fails at startup if any required variable is missing.

```ts
// lib/env.ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_DEFAULT_CHAIN:     z.enum(["baseMainnet"]),
  NEXT_PUBLIC_ALCHEMY_mainnet:   z.string().url(),
  NEXT_PUBLIC_ALCHEMY_MAINNET:   z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_WALLETCONNECT_ID:  z.string().min(1),
  NEXT_PUBLIC_OWNER_ADDRESS:     z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  NEXT_PUBLIC_APP_URL:           z.string().url(),
});

export const env = schema.parse({
  NEXT_PUBLIC_DEFAULT_CHAIN:     process.env.NEXT_PUBLIC_DEFAULT_CHAIN,
  NEXT_PUBLIC_ALCHEMY_mainnet:   process.env.NEXT_PUBLIC_ALCHEMY_mainnet,
  NEXT_PUBLIC_ALCHEMY_MAINNET:   process.env.NEXT_PUBLIC_ALCHEMY_MAINNET,
  NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_WALLETCONNECT_ID:  process.env.NEXT_PUBLIC_WALLETCONNECT_ID,
  NEXT_PUBLIC_OWNER_ADDRESS:     process.env.NEXT_PUBLIC_OWNER_ADDRESS,
  NEXT_PUBLIC_APP_URL:           process.env.NEXT_PUBLIC_APP_URL,
});
```

---

## Wagmi Config

```ts
// lib/wagmi.config.ts
import { createConfig } from "wagmi";
import { base, baseMainnet } from "wagmi/chains";
import { fallback, http } from "viem";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet, coinbaseWallet,
  walletConnectWallet, rainbowWallet, injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { env } from "./env";

const connectors = connectorsForWallets([
  { groupName: "Recommended", wallets: [metaMaskWallet, coinbaseWallet, rainbowWallet] },
  { groupName: "Other",       wallets: [walletConnectWallet, injectedWallet] },
], { appName: "BasePlay", projectId: env.NEXT_PUBLIC_WALLETCONNECT_ID });

export const wagmiConfig = createConfig({
  chains:     [baseMainnet, base],
  connectors,
  ssr:        true,
  transports: {
    [baseMainnet.id]: fallback([
      http(env.NEXT_PUBLIC_ALCHEMY_mainnet),
      http("https://mainnet.base.org"),
      http("https://base-rpc.publicnode.com"),
    ]),
    [base.id]: fallback([
      http(env.NEXT_PUBLIC_ALCHEMY_MAINNET),
      http("https://mainnet.base.org"),
      http("https://base-rpc.publicnode.com"),
    ]),
  },
});
```

---

## Multi-RPC Fallback

```ts
// lib/rpc.ts
import { createPublicClient, fallback, http } from "viem";
import { NETWORKS, NetworkKey } from "@baseplay/shared/config/networks";

export function createResilientClient(networkKey: NetworkKey) {
  const net = NETWORKS[networkKey];
  const transports = net.rpcUrls
    .filter(Boolean)
    .map(url => http(url, { timeout: 8_000, retryCount: 2, retryDelay: 200 }));

  return createPublicClient({
    transport: fallback(transports, {
      rank: {
        interval:    60_000,
        sampleCount: 5,
        timeout:     3_000,
        weights: { latency: 0.3, stability: 0.7 },
      },
      retryCount: 3,
    }),
  });
}

// Exponential backoff for rate-limited RPC calls
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  { retries = 4, baseDelay = 500, maxDelay = 10_000 } = {}
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRetryable = err?.status === 429
        || err?.message?.includes("rate limit")
        || err?.message?.includes("fetch failed");
      if (!isRetryable || i === retries - 1) throw err;
      const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay) + Math.random() * 200;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## WalletProvider

```tsx
// components/wallet/WalletProvider.tsx
"use client";

import { WagmiProvider }      from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig }        from "@/lib/wagmi.config";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

---

## Root Layout

```tsx
// app/layout.tsx
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider }         from "next-themes";
import { WalletProvider }        from "@/components/wallet/WalletProvider";
import { MiniKitProvider }       from "@coinbase/onchainkit/minikit";
import { Toaster }               from "@/components/ui/Toast";
import type { Metadata }         from "next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono  = JetBrains_Mono({
  subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500"],
});

export const metadata: Metadata = {
  title:       { default: "BasePlay", template: "%s — BasePlay" },
  description: "Mini onchain games on Base L2. Provably fair, instant payouts.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!),
  openGraph: {
    title:    "BasePlay — Mini Onchain Games",
    description: "Provably fair games on Base L2. $0.50–$3 bets.",
    images:   [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <MiniKitProvider>
            <WalletProvider>
              {children}
              <Toaster />
            </WalletProvider>
          </MiniKitProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## Admin Route Protection

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const OWNER = process.env.NEXT_PUBLIC_OWNER_ADDRESS!.toLowerCase();

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const wallet = req.cookies.get("wallet_address")?.value?.toLowerCase();
    if (!wallet || wallet !== OWNER) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
```

---

## useMounted (SSR Hydration Fix)

```ts
// hooks/useMounted.ts
import { useEffect, useState } from "react";

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
```

---

## useContractAddress

```ts
// hooks/useContractAddress.ts
import { useAccount } from "wagmi";
import { baseMainnet } from "wagmi/chains";
import { getContractAddress } from "@baseplay/shared/config/addresses";

export function useContractAddress(contractName: string): `0x${string}` | null {
  const { chain } = useAccount();
  const chainId   = chain?.id ?? baseMainnet.id;
  try {
    return getContractAddress(chainId, contractName);
  } catch {
    return null;
  }
}
```

---

## useBalance

```ts
// hooks/useBalance.ts
import { useBalance as useWagmiBalance, useAccount } from "wagmi";
import { formatEther } from "viem";

export function useBalance() {
  const { address } = useAccount();
  const { data, isLoading, refetch } = useWagmiBalance({
    address,
    query: { refetchInterval: 10_000 },
  });

  return {
    raw:       data?.value ?? 0n,
    formatted: data ? parseFloat(formatEther(data.value)).toFixed(4) : "0.0000",
    symbol:    "ETH",
    isLoading,
    refetch,
  };
}
```

---

## useVRF (State Machine)

```ts
// hooks/useVRF.ts
import { useState, useEffect } from "react";
import { supabase }            from "@/lib/supabase";

export type VRFState = "idle" | "pending_tx" | "pending_vrf" | "settled" | "error";

export const VRF_MESSAGES: Record<VRFState, string> = {
  idle:        "",
  pending_tx:  "Sending transaction...",
  pending_vrf: "Verifying on-chain...",
  settled:     "",
  error:       "Timed out — use claimRefund() to recover your bet",
};

export function useVRF(gameId: string) {
  const [state, setState]         = useState<VRFState>("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [result, setResult]       = useState<any>(null);

  useEffect(() => {
    if (!requestId || state !== "pending_vrf") return;

    // Supabase Realtime subscription — no polling
    const sub = supabase
      .channel(`vrf_${requestId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "game_rounds",
        filter: `vrf_request_id=eq.${requestId}`,
      }, payload => {
        setResult(payload.new);
        setState("settled");
      })
      .subscribe();

    // 90-second timeout (VRF_TIMEOUT_BLOCKS ≈ 2 min, UI shows earlier)
    const timeout = setTimeout(() => setState("error"), 90_000);

    return () => {
      supabase.removeChannel(sub);
      clearTimeout(timeout);
    };
  }, [requestId, state]);

  function reset() { setState("idle"); setRequestId(null); setResult(null); }

  return { state, setState, requestId, setRequestId, result, reset };
}
```

---

## useGame (Common Hook)

```ts
// hooks/useGame.ts
import { useWriteContract, useAccount } from "wagmi";
import { parseEther }                   from "viem";
import { useVRF }                       from "./useVRF";
import { useContractAddress }           from "./useContractAddress";
import { parseContractError }           from "@/lib/errors";

export function useGame(gameId: string, abiName: string) {
  const { address }      = useAccount();
  const contractAddress  = useContractAddress(abiName);
  const abi              = require(`@baseplay/shared/abis/${abiName}.json`);
  const vrf              = useVRF(gameId);
  const { writeContractAsync, isPending } = useWriteContract();

  async function placeBet(amountEth: string, params: `0x${string}`) {
    if (!contractAddress || !address) throw new Error("Wallet not connected");
    vrf.setState("pending_tx");
    try {
      const hash = await writeContractAsync({
        address: contractAddress, abi,
        functionName: "placeBet",
        args:  [params],
        value: parseEther(amountEth),
      });
      vrf.setState("pending_vrf");
      return hash;
    } catch (err) {
      vrf.setState("idle");
      throw parseContractError(err);
    }
  }

  return {
    placeBet,
    vrfState:    vrf.state,
    vrfResult:   vrf.result,
    isTxPending: isPending,
    isConnected: !!address,
    reset:       vrf.reset,
    setRequestId: vrf.setRequestId,
  };
}
```

---

## ChainSwitcher

```tsx
// components/wallet/ChainSwitcher.tsx
"use client";

import { useSwitchChain, useAccount } from "wagmi";
import { base, baseMainnet }          from "wagmi/chains";
import { motion }                     from "framer-motion";
import { useMounted }                 from "@/hooks/useMounted";

const CHAINS = [
  { chain: baseMainnet, label: "mainnet", tag: "mainnet" },
  { chain: base,        label: "Base",    tag: "mainnet" },
];

export function ChainSwitcher() {
  const mounted                    = useMounted();
  const { chain }                  = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!mounted) return null;

  return (
    <div className="flex gap-1.5">
      {CHAINS.map(({ chain: c, label, tag }) => (
        <motion.button
          key={c.id}
          whileTap={{ scale: 0.96 }}
          disabled={chain?.id === c.id || isPending}
          onClick={() => switchChain({ chainId: c.id })}
          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
            chain?.id === c.id
              ? "bg-[var(--surface-2)] border-[var(--border-2)] text-[var(--text-1)] font-medium"
              : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
          }`}
        >
          {label}
          {tag === "mainnet" && (
            <span className="ml-1 opacity-40 text-[10px]">test</span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
```

---

## BetPanel

```tsx
// components/game/BetPanel.tsx
"use client";

import { useState }    from "react";
import { motion }      from "framer-motion";
import { useBalance }  from "@/hooks/useBalance";
import type { VRFState } from "@/hooks/useVRF";

const QUICK_AMOUNTS  = ["0.0002", "0.0005", "0.001"];
const MIN_BET        = 0.0002;
const MAX_BET        = 0.001;

interface BetPanelProps {
  onBet:     (amount: string) => Promise<void>;
  disabled:  boolean;
  vrfState:  VRFState;
}

export function BetPanel({ onBet, disabled, vrfState }: BetPanelProps) {
  const [amount, setAmount]   = useState("0.0005");
  const [loading, setLoading] = useState(false);
  const { formatted }         = useBalance();

  async function handleBet() {
    const val = parseFloat(amount);
    if (isNaN(val) || val < MIN_BET || val > MAX_BET) return;
    setLoading(true);
    try { await onBet(amount); }
    finally { setLoading(false); }
  }

  const isDisabled = disabled || loading || vrfState !== "idle";

  const btnLabel: Record<VRFState, string> = {
    idle:        `Play — ${amount} ETH`,
    pending_tx:  "Sending...",
    pending_vrf: "Verifying...",
    settled:     "Play again",
    error:       "Retry",
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
      <div className="flex justify-between text-xs text-[var(--text-3)]">
        <span>Balance</span>
        <span className="font-mono text-[var(--text-1)]">{formatted} ETH</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number" value={amount}
          onChange={e => setAmount(e.target.value)}
          min={MIN_BET} max={MAX_BET} step={0.0001}
          disabled={isDisabled}
          className="flex-1 bg-[var(--surface-2)] border border-[var(--border-2)]
                     rounded-md px-3 py-2 text-sm font-mono text-[var(--text-1)]
                     focus:outline-none focus:border-[var(--accent)] disabled:opacity-40"
        />
        <span className="text-sm text-[var(--text-2)] font-medium">ETH</span>
      </div>

      <div className="flex gap-1.5">
        {QUICK_AMOUNTS.map(q => (
          <button
            key={q}
            onClick={() => setAmount(q)}
            disabled={isDisabled}
            className={`flex-1 py-1.5 text-xs rounded-md border transition-colors
                        font-mono disabled:opacity-40 ${
              amount === q
                ? "bg-[var(--surface-2)] border-[var(--border-2)] text-[var(--text-1)]"
                : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      <motion.button
        whileTap={!isDisabled ? { scale: 0.97 } : {}}
        onClick={handleBet}
        disabled={isDisabled}
        className="w-full py-2.5 text-sm font-semibold rounded-md
                   bg-[var(--accent)] text-white hover:opacity-90
                   disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        {btnLabel[vrfState]}
      </motion.button>

      <p className="text-center text-[10px] text-[var(--text-3)]">
        Min $0.50 · Max $3.00 · 3% house edge
      </p>
    </div>
  );
}
```

---

## Error Handling

```ts
// lib/errors.ts

export enum GameErrorCode {
  WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED",
  WRONG_NETWORK        = "WRONG_NETWORK",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  TX_REJECTED          = "TX_REJECTED",
  VRF_TIMEOUT          = "VRF_TIMEOUT",
  ROUND_ACTIVE         = "ROUND_ACTIVE",
  CONTRACT_PAUSED      = "CONTRACT_PAUSED",
  RPC_ERROR            = "RPC_ERROR",
  UNKNOWN              = "UNKNOWN",
}

export class GameError extends Error {
  constructor(public code: GameErrorCode, message: string, public cause?: unknown) {
    super(message);
  }
}

export function parseContractError(err: unknown): GameError {
  const msg = (err as any)?.message ?? "";
  if (msg.includes("user rejected"))   return new GameError(GameErrorCode.TX_REJECTED,          "Transaction rejected");
  if (msg.includes("insufficient"))    return new GameError(GameErrorCode.INSUFFICIENT_BALANCE,  "Insufficient balance");
  if (msg.includes("RoundAlreadyAct")) return new GameError(GameErrorCode.ROUND_ACTIVE,          "A round is already active");
  if (msg.includes("GameIsPaused"))    return new GameError(GameErrorCode.CONTRACT_PAUSED,       "Game is temporarily paused");
  if (msg.includes("rate limit"))      return new GameError(GameErrorCode.RPC_ERROR,             "Network busy, please retry");
  return new GameError(GameErrorCode.UNKNOWN, "Unexpected error", err);
}
```

---

## Current Data And Cache Model

- Global stats, game stats, compact live feed, full live feed, profile stats, and player rounds are read through React Query hooks.
- Supabase is the primary source for settled public data. When Supabase is unavailable or empty, the first page can fall back to on-chain event reads.
- Compact header/live feed: `useRecentRounds`, 20s stale time, 30s interval refresh while mounted.
- Home global stats and game counts: `useGlobalStats` and `useGameStats`, 90s stale time, interval/manual refresh.
- Full live feed: `useRoundPages`, first 50 rows, game filter, manual refresh, and "Load older" pagination.
- Profile data: `/profile` uses the connected wallet; `/profile/[address]` can show any public player address. Recent rounds are paginated and played-game summaries come from `player_game_stats`.
- Route changes should not force full refetches of global stats/feed because query keys and stale times keep cached data alive across pages.

## Current Game Library

- The home game library uses `games.registry.ts` as the source of truth.
- Search matches game name, description, and category tags.
- Category filters group games without hiding inactive metadata from the registry.
- Game cards show aggregate play counts from Supabase `game_stats` when available.

## Page Routes Summary

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Public | Home — game grid, recent wins, stats |
| `/games/coin-flip` | Public | Coin Flip game |
| `/games/dice` | Public | Dice game |
| `/games/crash` | Public | Crash game |
| `/games/mines` | Public | Mines game |
| `/games/hilo` | Public | Hi-Lo game |
| `/games/over-under` | Public | Over/Under game |
| `/games/limbo` | Public | Limbo game |
| `/games/wheel` | Public | Wheel game |
| `/games/plinko-lite` | Public | Plinko Lite game |
| `/games/color-pick` | Public | Color Pick game |
| `/games/treasure-chest` | Public | Treasure Chest game |
| `/games/lucky-seven` | Public | Lucky Seven game |
| `/games/roulette-lite` | Public | Roulette Lite game |
| `/games/scratch-card` | Public | Scratch Card game |
| `/games/rock-paper-scissors` | Public | Rock Paper Scissors game |
| `/games/slots` | Public | Slots game |
| `/leaderboard` | Public | Weekly leaderboard |
| `/live-feed` | Public | Paginated public settled rounds |
| `/profile` | Public | Connected wallet profile or connect prompt |
| `/profile/[address]` | Public | Public player profile |
| `/docs` | Public | User-facing game and fairness docs |
| `/updates` | Public | Product updates |
| `/admin` | Owner only | Dashboard stats |
| `/admin/games` | Owner only | Pause/resume, update limits |
| `/admin/lucky-draw` | Owner only | Lucky Draw pause/config/prize weights/payout status |
| `/admin/vault` | Owner only | Balance, withdraw |
| `/admin/logs` | Owner only | Transaction history |
| `/api/frame/[game]` | Public | Farcaster Frame endpoint |

## Lucky Draw UI

Lucky Draw appears in two player-facing surfaces:

- Game pages show a compact animated `LuckyDrawCard` in the side stack below the bet controls.
- Profile pages include a `Lucky Draw` tab with progress, available draws, lifetime draw counts, recent results, and prize tiers.

The card reads `/api/player/:address/lucky-draw` through the backend and only enables `Open Lucky Draw` when the connected wallet has an available draw. Claiming signs a short wallet message before the backend calls the Supabase atomic claim function. Admin controls live at `/admin/lucky-draw` and require an allowed admin wallet plus a signed admin message.


