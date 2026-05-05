import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FairnessButton } from "@/components/game/FairnessModal";
import { HowItWorks } from "@/components/game/HowItWorks";
import { RoundStatus } from "@/components/game/RoundStatus";
import type { VRFState } from "@/hooks/useVRF";

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

      {showRoundStatus && (
        <div className="mb-5">
          <RoundStatus state={vrfState} requestId={requestId} txHash={txHash} />
        </div>
      )}

      <div className="game-shell-grid grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="game-primary-area lg:col-start-1 lg:row-start-1">
          {children}
        </div>
        <div className="game-side-stack lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {side}
        </div>
        <div className="game-how-area lg:col-start-1 lg:row-start-2">
          <HowItWorks gameId={gameId} />
        </div>
      </div>
    </main>
  );
}
