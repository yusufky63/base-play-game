"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getGame } from "@baseplay/shared/config/games.registry";
import { GameContractPanel } from "@/components/game/GameContractPanel";
import { FairnessButton } from "@/components/game/FairnessModal";
import { HowItWorks } from "@/components/game/HowItWorks";
import { LuckyDrawCard } from "@/components/lucky-draw/LuckyDrawCard";
import { RoundStatus } from "@/components/game/RoundStatus";
import { ReferralShareCard } from "@/components/share/ReferralShareCard";
import type { VRFState } from "@/hooks/useVRF";
import { useOperationalStatus } from "@/hooks/useOperationalStatus";

export function GameShell({
  gameId,
  title,
  description,
  vrfState = "idle",
  requestId,
  txHash,
  children,
  side,
}: {
  gameId: string;
  title: string;
  description: string;
  vrfState?: VRFState;
  requestId?: string | null;
  txHash?: string | null;
  children: React.ReactNode;
  side: React.ReactNode;
}) {
  const showRoundStatus = vrfState !== "idle" || Boolean(requestId || txHash);
  const game = getGame(gameId);
  const operationalStatus = useOperationalStatus(game?.contractName);
  const showOperationalBanner = operationalStatus.status !== "live" && operationalStatus.status !== "loading";

  return (
    <main className="mx-auto w-full max-w-7xl p-4 md:py-10">
      <div className="mb-5 flex flex-col gap-4 border-b border-[var(--border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-2)] hover:text-[var(--text-1)]"
          >
            <ChevronLeft size={15} />
            Games
          </Link>
          <h1 className="display-heading text-4xl font-bold leading-none text-[var(--text-1)] md:text-5xl">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-2)]">
            {description}
          </p>
        </div>
        <FairnessButton requestId={requestId} txHash={txHash} />
      </div>

      {showOperationalBanner && (
        <section className={`game-operational-banner game-operational-${operationalStatus.status}`}>
          <div>
            <h2>{operationalStatus.title}</h2>
            <p>{operationalStatus.description}</p>
          </div>
        </section>
      )}

      {showRoundStatus && (
        <div className="mb-5">
          <RoundStatus state={vrfState} requestId={requestId} txHash={txHash} />
        </div>
      )}

      <div className="game-shell-grid grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="game-main-stack">
          <div className="game-primary-area">
            {children}
          </div>
          <div className="game-how-area">
            <HowItWorks gameId={gameId} />
          </div>
          <div className="game-contract-area">
            <GameContractPanel gameId={gameId} />
          </div>
        </div>
        <div className="game-side-stack">
          {side}
          <LuckyDrawCard compact />
          <ReferralShareCard />
        </div>
      </div>
    </main>
  );
}
