"use client";

import { UserRound } from "lucide-react";
import { useAccount } from "wagmi";
import { WalletStatus } from "@/components/wallet/WalletStatus";
import { ProfileClient } from "@/components/profile/ProfileClient";

export function ProfileSelfPageClient() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-10">
        <section className="profile-empty panel p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-[var(--border-2)] bg-[var(--accent-light)] text-[var(--accent)]">
            <UserRound size={24} />
          </div>
          <h1 className="mt-4 display-heading text-3xl font-bold text-[var(--text-1)]">Player profile</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-2)]">
            Connect your wallet to see XP, level, streaks, game history, and weekly ranks.
          </p>
          <div className="mt-5">
            <WalletStatus />
          </div>
        </section>
      </main>
    );
  }

  return <ProfileClient address={address} />;
}
