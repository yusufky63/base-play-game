"use client";

import { useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import { Gem, LockKeyhole } from "lucide-react";
import treasureAbi from "@baseplay/shared/abis/TreasureChestGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

export function TreasureChestClient() {
  const [amount, setAmount] = useState("0.0005");
  const [choice, setChoice] = useState(4);
  const [roundChoice, setRoundChoice] = useState(4);
  const game = useGame("treasure-chest", "TreasureChestGame", treasureAbi as Abi);
  const event = findEventArgs(game.vrfResult, "TreasureChestResult");
  const winningChest = toNumber(event?.winningChest);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";

  async function play() {
    setRoundChoice(choice);
    const params = encodeAbiParameters([{ type: "uint8" }], [choice]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="treasure-chest"
      title="Treasure Chest"
      description="Pick one of nine chests. VRF reveals where the prize was hidden."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Prize odds</span>
              <span className="font-mono text-[var(--text-1)]">9.00x gross</span>
            </div>
            <p className="text-xs leading-5 text-[var(--text-3)]">One prize chest is selected by VRF. Your pick is locked before randomness is requested.</p>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="treasure-chest" title="Treasure feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[500px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className="treasure-grid">
            {Array.from({ length: 9 }).map((_, index) => {
              const active = choice === index;
              const prize = settled && winningChest === index;
              return (
                <button key={index} type="button" disabled={isBusy} onClick={() => setChoice(index)} className={`treasure-cell ${active ? "treasure-cell-selected" : ""} ${prize ? "treasure-cell-prize" : ""} ${isBusy ? "treasure-cell-shuffle" : ""}`}>
                  {prize ? <Gem size={25} /> : <LockKeyhole size={22} />}
                  <span>{index + 1}</span>
                </button>
              );
            })}
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Pick", value: `${roundChoice + 1}` },
              { label: "Prize", value: settled ? `${Number(winningChest ?? 0) + 1}` : isBusy ? "Shuffling" : "-" },
              { label: "Pays", value: "9x" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Chests are shuffling" : won ? "Prize found" : "Empty chest"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `Picked ${roundChoice + 1}, prize was ${Number(winningChest ?? 0) + 1}` : undefined}
            share={settled && won ? { game: "Treasure Chest", detail: `Opened chest ${roundChoice + 1} and found the prize.` } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function findEventArgs(result: Record<string, unknown> | null, eventName: string) {
  const events = result?.events;
  if (!Array.isArray(events)) return null;
  const event = events.find((entry) => typeof entry === "object" && entry !== null && "eventName" in entry && entry.eventName === eventName) as { args?: Record<string, unknown> } | undefined;
  return event?.args ?? null;
}

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return null;
}
