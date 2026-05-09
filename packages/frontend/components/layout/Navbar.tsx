"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, LogOut, Menu, Sparkles, Trophy, UserRound, Wallet, X } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { BasenameLabel } from "@/components/base/BasenameLabel";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LiveFeed } from "@/components/game/LiveFeed";
import { HeaderAccountMenu } from "@/components/layout/HeaderAccountMenu";
import { WalletStatus } from "@/components/wallet/WalletStatus";
import { ChainSwitcher } from "@/components/wallet/ChainSwitcher";
import { useBalance } from "@/hooks/useBalance";
import { markManualWalletDisconnect } from "@/lib/walletConnectors";

const navItems = [
  { href: "/", label: "Games", icon: Gamepad2 },
  { href: "/quests", label: "Quests", icon: Sparkles },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: UserRound }
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="app-header sticky top-0 z-30">
      <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 text-[var(--text-1)]">
          <span className="brand-image-mark">
            <Logo size={34} />
          </span>
          <span>
            <span className="display-heading block text-[17px] font-bold leading-none">BasePlay</span>
            <span className="hidden pt-1 font-mono text-[10px] uppercase text-[var(--text-3)] sm:block">On-chain games</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <HeaderAccountMenu />
          </div>
          <ThemeToggle />
          <MobileHeaderMenu pathname={pathname} />
        </div>
      </div>
      <div className="live-feed-rail border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl items-center overflow-hidden px-4 py-3">
          <LiveFeed compact limit={4} />
        </div>
      </div>
    </header>
  );
}

function MobileHeaderMenu({ pathname }: { pathname: string }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { formatted, symbol } = useBalance();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="control-shell flex h-10 w-10 items-center justify-center p-0"
        aria-label="Open menu"
        aria-expanded={open}
      >
        {open ? <X size={17} /> : <Menu size={17} />}
      </button>

      {open && (
        <div className="header-mobile-menu">
          <div className="mobile-menu-head">
            <div>
              <span>BasePlay</span>
              <strong>{isConnected ? "Player menu" : "Navigation"}</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={15} />
            </button>
          </div>

          <nav className="mobile-menu-grid">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`mobile-menu-link ${active ? "mobile-menu-link-active" : ""}`}>
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mobile-menu-network">
            <ChainSwitcher />
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-3">
            {!isConnected ? (
              <WalletStatus />
            ) : (
              <div className="grid gap-2">
                <Link href="/profile" className="mobile-wallet-row">
                  <span className="header-account-icon">
                    <Wallet size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-[var(--text-1)]">
                      {address ? <BasenameLabel address={address as `0x${string}`} /> : "Player"}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase text-[var(--text-3)]">
                      {formatted} {symbol}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    markManualWalletDisconnect();
                    disconnect();
                  }}
                  className="mobile-menu-link text-[var(--lose)]"
                >
                  <LogOut size={15} />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
