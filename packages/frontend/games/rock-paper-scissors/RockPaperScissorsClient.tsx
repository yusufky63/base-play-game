"use client";

import { useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import { Hand, Scissors, ScrollText } from "lucide-react";
import rpsAbi from "@baseplay/shared/abis/RockPaperScissorsGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const moves = [
  { id: 0, label: "Rock", Icon: Hand },
  { id: 1, label: "Paper", Icon: ScrollText },
  { id: 2, label: "Scissors", Icon: Scissors }
] as const;

export function RockPaperScissorsClient() {
  const [amount, setAmount] = useState("0.00023");
  const [choice, setChoice] = useState(0);
  const [roundChoice, setRoundChoice] = useState(0);
  const game = useGame("rock-paper-scissors", "RockPaperScissorsGame", rpsAbi as Abi);
  const event = findEventArgs(game.vrfResult, "RockPaperScissorsResult");
  const houseMove = toNumber(event?.houseMove);
  const playerMove = toNumber(event?.playerMove);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const PlayerIcon = moves[playerMove ?? roundChoice]?.Icon ?? Hand;
  const HouseIcon = moves[houseMove ?? ((roundChoice + 1) % 3)]?.Icon ?? Hand;

  async function play() {
    setRoundChoice(choice);
    const params = encodeAbiParameters([{ type: "uint8" }], [choice]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="rock-paper-scissors"
      title="Rock Paper Scissors"
      description="Choose a move. VRF picks the house move and removes ties."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Move</span>
              <span className="font-mono text-[var(--text-1)]">2.00x gross</span>
            </div>
            <div className="grid gap-2">
              {moves.map((item) => (
                <button key={item.id} type="button" disabled={isBusy} onClick={() => setChoice(item.id)} className={`rps-choice ${choice === item.id ? "rps-choice-active" : ""}`}>
                  <item.Icon size={18} />
                  {item.label}
                </button>
              ))}
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="rock-paper-scissors" title="RPS feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[520px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className={`rps-arena ${isBusy ? "rps-running" : ""}`}>
            <div className="rps-card rps-player-card">
              <span>You</span>
              <PlayerIcon size={66} />
              <strong>{moves[playerMove ?? roundChoice].label}</strong>
            </div>
            <div className="rps-versus">VS</div>
            <div className="rps-card">
              <span>House</span>
              <HouseIcon size={66} />
              <strong>{settled ? moves[houseMove ?? 0].label : isBusy ? "VRF" : "Waiting"}</strong>
            </div>
          </div>
          <RoundSummaryStrip
            items={[
              { label: "You", value: moves[playerMove ?? roundChoice].label },
              { label: "House", value: settled ? moves[houseMove ?? 0].label : isBusy ? "VRF" : "-" },
              { label: "Pays", value: "2x" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "House move is resolving" : won ? "Your move won" : "House won"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `${moves[playerMove ?? 0].label} vs ${moves[houseMove ?? 0].label}` : undefined}
            share={settled && won ? { game: "Rock Paper Scissors", detail: `${moves[playerMove ?? 0].label} beat ${moves[houseMove ?? 0].label}.`, txHash: game.txHash } : undefined}
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
