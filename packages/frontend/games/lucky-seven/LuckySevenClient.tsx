"use client";

import { useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import luckyAbi from "@baseplay/shared/abis/LuckySevenGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const choices = [
  { id: 0, label: "Under 7", payout: "2.40x" },
  { id: 1, label: "Exactly 7", payout: "6.00x" },
  { id: 2, label: "Over 7", payout: "2.40x" }
] as const;

export function LuckySevenClient() {
  const [amount, setAmount] = useState("0.0005");
  const [choice, setChoice] = useState(1);
  const [roundChoice, setRoundChoice] = useState(1);
  const game = useGame("lucky-seven", "LuckySevenGame", luckyAbi as Abi);
  const event = findEventArgs(game.vrfResult, "LuckySevenResult");
  const dieA = toNumber(event?.dieA);
  const dieB = toNumber(event?.dieB);
  const total = toNumber(event?.total);
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
      gameId="lucky-seven"
      title="Lucky Seven"
      description="Roll two dice and bet whether the total lands under, exactly, or over seven."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 border-b border-[var(--border)] pb-3 text-sm text-[var(--text-2)]">Bet type</div>
            <div className="grid gap-2">
              {choices.map((item) => (
                <button key={item.id} type="button" disabled={isBusy} onClick={() => setChoice(item.id)} className={`play-button-ghost flex h-11 items-center justify-between rounded-md px-3 text-sm font-bold disabled:opacity-50 ${choice === item.id ? "choice-option-selected" : ""}`}>
                  <span>{item.label}</span>
                  <span className="font-mono text-xs opacity-80">{item.payout}</span>
                </button>
              ))}
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="lucky-seven" title="Lucky Seven feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[480px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className={`lucky-seven-board ${isBusy ? "lucky-seven-rolling" : ""}`}>
            <Die value={dieA ?? 3} />
            <div className="lucky-seven-total">{total ?? 7}</div>
            <Die value={dieB ?? 4} />
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Pick", value: choices[roundChoice].label },
              { label: "Roll", value: settled ? `${dieA}+${dieB}` : isBusy ? "Rolling" : "-" },
              { label: "Total", value: settled ? `${total ?? "-"}` : "7" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Dice are rolling" : won ? "Seven call hit" : "Seven call missed"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `${choices[roundChoice].label}, rolled ${dieA}+${dieB}=${total}` : undefined}
            share={settled && won ? { game: "Lucky Seven", detail: `${choices[roundChoice].label}, rolled ${total}.`, txHash: game.txHash } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function Die({ value }: { value: number }) {
  return <div className="lucky-die">{value}</div>;
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
