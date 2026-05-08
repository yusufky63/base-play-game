# 10 — Integrations

> Base Docs: [docs.base.org](https://docs.base.org/get-started/base)
> Build on Base: [docs.base.org/get-started/build-app](https://docs.base.org/get-started/build-app)
> Base Apps: [docs.base.org/apps](https://docs.base.org/apps)
> Basenames: [docs.base.org/base-account/guides/basenames](https://docs.base.org/base-account/guides/basenames)
> OnchainKit: [docs.base.org/base-account/overview/what-is-base-account](https://docs.base.org/base-account/overview/what-is-base-account)
> Farcaster Frames: [docs.farcaster.xyz/developers/frames](https://docs.farcaster.xyz/developers/frames)

---

## Basename Integration

Basenames are Base's native ENS-like names (e.g. `lucky.base.eth`).
Displayed in the navbar, leaderboard, and live feed.

```bash
npm install @coinbase/onchainkit
```

### Header Display

```tsx
// components/wallet/BasenameDisplay.tsx
"use client";

import { useAccount }       from "wagmi";
import { Name, Avatar }     from "@coinbase/onchainkit/identity";
import { base, baseSepolia } from "wagmi/chains";
import { ConnectButton }    from "@rainbow-me/rainbowkit";
import { useBalance }       from "@/hooks/useBalance";
import { useMounted }       from "@/hooks/useMounted";

export function BasenameDisplay() {
  const mounted             = useMounted();
  const { address, chain }  = useAccount();
  const { formatted }       = useBalance();
  const resolveChain        = chain?.id === 8453 ? base : baseSepolia;

  if (!mounted) return <div className="w-36 h-9" />; // prevent SSR flash

  if (!address) {
    return <ConnectButton label="Connect" />;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                    border border-[var(--border-2)] bg-[var(--surface-2)]">
      <Avatar
        address={address}
        chain={resolveChain}
        className="w-5 h-5 rounded-full"
      />
      <Name
        address={address}
        chain={resolveChain}
        className="text-xs font-medium font-mono text-[var(--text-1)]"
      />
      <span className="w-px h-3.5 bg-[var(--border-2)]" />
      <span className="text-xs text-[var(--text-3)] font-mono">{formatted} ETH</span>
    </div>
  );
}
```

### Resolve Basename for Leaderboard

```ts
// lib/basename.ts
import { getName } from "@coinbase/onchainkit/identity";
import { base }    from "wagmi/chains";

const cache = new Map<string, string>();

export async function resolveBasename(address: string): Promise<string> {
  if (cache.has(address)) return cache.get(address)!;

  try {
    const name   = await getName({ address: address as `0x${string}`, chain: base });
    const result = name ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
    cache.set(address, result);
    return result;
  } catch {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}
```

---

## Base Account (Smart Wallet)

Base Account supports EIP-5792 batched calls.
When the user has a smart wallet, transactions can be batched.

```ts
// hooks/useGame.ts — EIP-5792 batch support
import { useCapabilities, useSendCalls } from "wagmi/experimental";
import { useWriteContract, useAccount }  from "wagmi";

export function useGame(gameId: string, abiName: string) {
  const { chain }              = useAccount();
  const { data: caps }         = useCapabilities();
  const { sendCallsAsync }     = useSendCalls();
  const { writeContractAsync } = useWriteContract();
  const contractAddress        = useContractAddress(abiName);
  const abi                    = require(`@baseplay/shared/abis/${abiName}.json`);

  async function placeBet(amountEth: string, params: `0x${string}`) {
    const supportsBatch = caps?.[chain?.id ?? 0]?.atomicBatch?.supported;

    if (supportsBatch) {
      // Smart wallet: single tx for complex interactions
      return sendCallsAsync({
        calls: [{
          address: contractAddress!, abi,
          functionName: "placeBet",
          args: [params],
          value: parseEther(amountEth),
        }],
      });
    } else {
      // Standard EOA wallet
      return writeContractAsync({
        address: contractAddress!, abi,
        functionName: "placeBet",
        args: [params],
        value: parseEther(amountEth),
      });
    }
  }

  return { placeBet };
}
```

---

## MiniKit (Base Mini-App)

MiniKit turns BasePlay into a mini-app usable inside Coinbase Wallet and Base App.

```bash
npm install @coinbase/onchainkit
```

### MiniKit Config

```ts
// lib/minikit.config.ts
export const minikitConfig = {
  appName:             "BasePlay",
  appIconUrl:          "https://baseplay.xyz/icon.png",
  splashImageUrl:      "https://baseplay.xyz/splash.png",
  splashBackgroundColor: "#09090B",
};
```

### Provider (already in layout.tsx)

```tsx
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";

// Wrap children with MiniKitProvider in app/layout.tsx
<MiniKitProvider>{children}</MiniKitProvider>
```

---

## Farcaster Frames

Each game page emits Frame meta tags so the game can be played directly inside Farcaster clients.

### Game Page Metadata

```tsx
// app/games/coin-flip/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coin Flip — BasePlay",
  other: {
    "fc:frame":           "vNext",
    "fc:frame:image":     "https://baseplay.xyz/og/coin-flip.png",
    "fc:frame:button:1":  "Play Heads",
    "fc:frame:button:2":  "Play Tails",
    "fc:frame:post_url":  "https://baseplay.xyz/api/frame/coin-flip",
  },
};
```

### Frame API Route

```ts
// app/api/frame/coin-flip/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body        = await req.json();
  const buttonIndex = body?.untrustedData?.buttonIndex as number; // 1 = Heads, 2 = Tails
  const choice      = buttonIndex === 1 ? "heads" : "tails";

  return NextResponse.json({
    frames: {
      version:  "vNext",
      image:    `https://baseplay.xyz/og/coin-flip-${choice}.png`,
      buttons:  [{ label: `Open BasePlay →` }],
      postUrl:  `https://baseplay.xyz/games/coin-flip?choice=${choice}`,
    },
  });
}
```

---

## Open Graph Images

Per-game OG images for social sharing and Farcaster Frames.

```ts
// app/og/[game]/route.tsx  (Next.js ImageResponse)
import { ImageResponse } from "next/og";

export async function GET(
  _req: Request,
  { params }: { params: { game: string } }
) {
  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630,
        background: "#09090B",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16,
      }}>
        <div style={{ fontSize: 72, color: "#FAFAFA", fontWeight: 600 }}>
          BasePlay
        </div>
        <div style={{ fontSize: 36, color: "#A1A1AA" }}>
          {params.game.replace("-", " ")} on Base
        </div>
        <div style={{ fontSize: 24, color: "#4C82FB" }}>
          Provably fair · $0.50–$3 bets
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```
