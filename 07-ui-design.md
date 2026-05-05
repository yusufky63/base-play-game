# 07 — UI & Design System

> next-themes: [github.com/pacocoursey/next-themes](https://github.com/pacocoursey/next-themes)
> Framer Motion: [motion.dev/docs](https://motion.dev/docs)
> Lucide Icons: [lucide.dev](https://lucide.dev)
> Inter Font: [fonts.google.com/specimen/Inter](https://fonts.google.com/specimen/Inter)
> JetBrains Mono: [fonts.google.com/specimen/JetBrains+Mono](https://fonts.google.com/specimen/JetBrains+Mono)

---

## Brand

```
Name:    BasePlay
Tagline: Mini games. Real stakes. On Base.
Accent:  #0052FF (light) / #4C82FB (dark) — matches Base brand blue
```

### Logo Component

```tsx
// components/ui/Logo.tsx
// Hexagon shape (nod to Base's hex motif) + play triangle

export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 32 32" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="BasePlay"
      className={className}
    >
      <path
        d="M16 2L29 9.5V22.5L16 30L3 22.5V9.5L16 2Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
      />
      <path d="M13 11L22 16L13 21V11Z" fill="currentColor" />
    </svg>
  );
}
```

---

## Design Tokens (Light & Dark)

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

/* Light mode */
[data-theme="light"] {
  --bg:           #FAFAFA;
  --surface:      #FFFFFF;
  --surface-2:    #F4F4F5;
  --surface-3:    #E4E4E7;
  --border:       #E4E4E7;
  --border-2:     #D4D4D8;
  --text-1:       #09090B;
  --text-2:       #52525B;
  --text-3:       #A1A1AA;
  --accent:       #0052FF;
  --accent-light: #EBF0FF;
  --win:          #16A34A;
  --win-light:    #DCFCE7;
  --lose:         #DC2626;
  --lose-light:   #FEE2E2;
  --pending:      #D97706;
}

/* Dark mode (default) */
[data-theme="dark"] {
  --bg:           #09090B;
  --surface:      #18181B;
  --surface-2:    #27272A;
  --surface-3:    #3F3F46;
  --border:       #27272A;
  --border-2:     #3F3F46;
  --text-1:       #FAFAFA;
  --text-2:       #A1A1AA;
  --text-3:       #52525B;
  --accent:       #4C82FB;
  --accent-light: rgba(76, 130, 251, 0.1);
  --win:          #22C55E;
  --win-light:    rgba(34, 197, 94, 0.1);
  --lose:         #EF4444;
  --lose-light:   rgba(239, 68, 68, 0.1);
  --pending:      #F59E0B;
}
```

---

## Theme Toggle

```tsx
// components/ui/ThemeToggle.tsx
"use client";

import { useTheme }  from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useMounted } from "@/hooks/useMounted";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="w-8 h-8 flex items-center justify-center rounded-lg
                 border border-[var(--border-2)] bg-[var(--surface-2)]
                 text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
```

---

## Design Principles

```
ALWAYS                              NEVER
──────────────────────────────────  ──────────────────────────────────
Flat surfaces                       Gradient backgrounds
Single accent color per context     Neon / glow effects
Border for elevation                Box shadows (except modals)
Meaningful motion only              Decorative animations
Typography-led hierarchy            Gradient text
Dark mode as default                Multiple vibrant colors
Monochrome base palette             Emojis as icons (use Lucide)
Generous whitespace (p-4+)          Cluttered layouts
English for all text                Text in other languages
```

---

## Icon Map (Lucide React)

```tsx
import {
  Coins,          // Coin Flip game
  Dices,          // Dice game
  TrendingUp,     // Crash game
  Bomb,           // Mines game
  CreditCard,     // Hi-Lo game
  Trophy,         // Leaderboard
  ShieldCheck,    // Provably Fair / VRF proof
  ExternalLink,   // Basescan link
  ChevronRight,   // Breadcrumb separator
  Sun, Moon,      // Theme toggle
  LayoutGrid,     // Admin dashboard
  Settings2,      // Admin games
  Vault,          // Admin vault
  ScrollText,     // Admin logs
  Zap,            // Live indicator
  ArrowUpRight,   // Win result
  ArrowDownRight, // Loss result
} from "lucide-react";
```

---

## Animations

```ts
// lib/animations.ts

export const animations = {
  page: {
    initial:    { opacity: 0, y: 8 },
    animate:    { opacity: 1, y: 0 },
    exit:       { opacity: 0, y: -8 },
    transition: { duration: 0.2, ease: "easeOut" },
  },
  card: {
    initial:    { opacity: 0, scale: 0.98 },
    animate:    { opacity: 1, scale: 1 },
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  win: {
    animate:    { scale: [1, 1.06, 1] },
    transition: { duration: 0.35, ease: "easeOut" },
  },
  lose: {
    animate:    { x: [0, -5, 5, -3, 3, 0] },
    transition: { duration: 0.35 },
  },
  pending: {
    animate:    { opacity: [0.4, 1, 0.4] },
    transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
  },
  listItem: {
    initial:    { opacity: 0, x: -8 },
    animate:    { opacity: 1, x: 0 },
    transition: { type: "spring", stiffness: 400, damping: 35 },
  },
  coinSpin: {
    animate:    { rotateY: [0, 360, 720, 1080] },
    transition: { duration: 1.2, ease: "easeOut" },
  },
  diceRoll: {
    animate:    { rotate: [0, 15, -15, 10, -10, 0], scale: [1, 1.1, 1] },
    transition: { duration: 0.8, ease: "easeOut" },
  },
};
```

---

## VRF Pending Overlay

```tsx
// components/game/VRFPendingOverlay.tsx
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck }             from "lucide-react";
import type { VRFState }           from "@/hooks/useVRF";

export function VRFPendingOverlay({ state }: { state: VRFState }) {
  return (
    <AnimatePresence>
      {state === "pending_vrf" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex flex-col items-center justify-center
                     gap-3 bg-[var(--surface)]/80 backdrop-blur-sm rounded-xl z-10"
        >
          <div className="w-7 h-7 border-2 border-[var(--border-2)]
                          border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-sm font-medium text-[var(--text-1)]">Verifying on-chain</p>
          <p className="text-xs text-[var(--text-2)] flex items-center gap-1">
            <ShieldCheck size={11} className="text-[var(--win)]" />
            Chainlink VRF processing
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## FairnessModal

```tsx
// components/game/FairnessModal.tsx
import { Modal }       from "@/components/ui/Modal";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { useAccount }  from "wagmi";
import { NETWORKS }    from "@baseplay/shared/config/networks";
import { getNetworkByChainId } from "@baseplay/shared/config/networks";

interface Props {
  open:      boolean;
  onClose:   () => void;
  requestId: string | null;
  txHash:    string | null;
}

export function FairnessModal({ open, onClose, requestId, txHash }: Props) {
  const { chain }   = useAccount();
  const net         = getNetworkByChainId(chain?.id ?? 84532);
  const explorerBase = net?.blockExplorer ?? "https://sepolia.basescan.org";

  return (
    <Modal open={open} onClose={onClose} title="Provably Fair">
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--win-light)]">
          <ShieldCheck size={15} className="text-[var(--win)] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[var(--text-2)]">
            This game result was generated by Chainlink VRF.
            The outcome cannot be manipulated by anyone, including BasePlay.
            You can independently verify every result on-chain.
          </p>
        </div>

        {txHash && (
          <Row label="Transaction">
            <a href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
               className="text-[var(--accent)] font-mono text-xs flex items-center gap-1 hover:underline">
              {txHash.slice(0, 12)}...{txHash.slice(-6)}
              <ExternalLink size={10} />
            </a>
          </Row>
        )}
        {requestId && (
          <Row label="VRF Request ID">
            <span className="font-mono text-xs text-[var(--text-2)] break-all">{requestId}</span>
          </Row>
        )}
        <Row label="Oracle">
          <a href="https://docs.chain.link/vrf" target="_blank" rel="noopener noreferrer"
             className="text-[var(--accent)] text-xs flex items-center gap-1 hover:underline">
            Chainlink VRF v2.5 <ExternalLink size={10} />
          </a>
        </Row>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--border)]">
      <span className="text-xs text-[var(--text-3)] flex-shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
```

---

## Responsive Breakpoints

```tsx
// Mobile-first — all layouts use these patterns

// Navbar
// Mobile: logo + wallet only
// Desktop: logo + nav links + wallet

// Game grid
<div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">

// Game page layout
// Mobile: canvas stacked above bet panel, no sidebar
// Desktop: canvas + bet panel left, live feed right
<div className="flex flex-col md:grid md:grid-cols-[1fr_176px]">

// Leaderboard
// Mobile: rank + player + profit (3 cols)
// Desktop: rank + player + games + volume + profit (5 cols)
<div className="grid grid-cols-[28px_1fr_80px] md:grid-cols-[28px_1fr_60px_80px_80px]">
```
