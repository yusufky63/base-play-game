"use client";

import { useEffect, useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import rouletteAbi from "@baseplay/shared/abis/RouletteLiteGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const betTypes = [
  { id: 0, label: "Exact", payout: "12x" },
  { id: 1, label: "Color", payout: "2x" },
  { id: 2, label: "Range", payout: "2x" }
] as const;

const colors = [
  { id: 0, label: "Blue", detail: "Odd table color" },
  { id: 1, label: "Black", detail: "Even table color" }
] as const;

const ranges = [
  { id: 0, label: "1-6", detail: "Lower half" },
  { id: 1, label: "7-12", detail: "Upper half" }
] as const;

export function RouletteLiteClient() {
  const [amount, setAmount] = useState("0.00023");
  const [betType, setBetType] = useState(0);
  const [choice, setChoice] = useState(7);
  const [round, setRound] = useState({ betType: 0, choice: 7 });
  const [cursor, setCursor] = useState(0);
  const game = useGame("roulette-lite", "RouletteLiteGame", rouletteAbi as Abi);
  const event = findEventArgs(game.vrfResult, "RouletteLiteResult");
  const result = toNumber(event?.result);
  const multiplierBps = toNumber(event?.multiplierBps);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const activeSlot = isBusy ? cursor : settled && result !== null ? result : betType === 0 ? choice : 0;

  useEffect(() => {
    if (!isBusy) return;
    const interval = window.setInterval(() => setCursor((value) => (value + 1) % 12), 90);
    return () => window.clearInterval(interval);
  }, [isBusy]);

  function changeBetType(nextType: number) {
    setBetType(nextType);
    setChoice(nextType === 0 ? 7 : 0);
  }

  async function play() {
    setRound({ betType, choice });
    const params = encodeAbiParameters([{ type: "uint8" }, { type: "uint8" }], [betType, choice]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="roulette-lite"
      title="Roulette Lite"
      description="Pick a number, color, or range on a 12-slot VRF roulette wheel."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 border-b border-[var(--border)] pb-3 text-sm text-[var(--text-2)]">Bet type</div>
            <div className="grid grid-cols-3 gap-2">
              {betTypes.map((item) => (
                <button key={item.id} type="button" disabled={isBusy} onClick={() => changeBetType(item.id)} className={`roulette-tab ${betType === item.id ? "roulette-tab-active" : ""}`}>
                  <span>{item.label}</span>
                  <small>{item.payout}</small>
                </button>
              ))}
            </div>
            <div className="mt-3 roulette-bet-grid">
              {betType === 0 && Array.from({ length: 12 }).map((_, index) => (
                <button key={index} type="button" disabled={isBusy} onClick={() => setChoice(index)} className={`roulette-chip ${choice === index ? "roulette-chip-active" : ""}`}>
                  {index + 1}
                </button>
              ))}
              {betType === 1 && colors.map((item) => (
                <button key={item.id} type="button" disabled={isBusy} onClick={() => setChoice(item.id)} className={`roulette-option ${choice === item.id ? "roulette-chip-active" : ""}`}>
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </button>
              ))}
              {betType === 2 && ranges.map((item) => (
                <button key={item.id} type="button" disabled={isBusy} onClick={() => setChoice(item.id)} className={`roulette-option ${choice === item.id ? "roulette-chip-active" : ""}`}>
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="roulette-lite" title="Roulette feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[520px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className={`roulette-wheel-wrap ${isBusy ? "roulette-running" : ""}`}>
            <div className="roulette-pointer" />
            <div className="roulette-wheel-lite">
              {Array.from({ length: 12 }).map((_, index) => (
                <span key={index} className={`roulette-slot ${activeSlot === index ? "roulette-slot-active" : ""} ${index % 2 === 0 ? "roulette-slot-blue" : "roulette-slot-black"}`} style={{ transform: `rotate(${index * 30}deg) translateY(-128px)` }}>
                  {index + 1}
                </span>
              ))}
              <div className="roulette-hub">
                <strong>{settled && result !== null ? result + 1 : "12"}</strong>
                <small>{isBusy ? "spinning" : "slots"}</small>
              </div>
            </div>
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Bet", value: betTypes[round.betType].label },
              { label: "Result", value: settled ? `${(result ?? 0) + 1}` : isBusy ? "Spinning" : "-" },
              { label: "Pays", value: settled ? `${((multiplierBps ?? 0) / 10_000).toFixed(2)}x` : betTypes[betType].payout }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            payout={game.vrfResult?.payout}
            betAmount={game.vrfResult?.betAmount ?? game.vrfResult?.bet_amount}
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Wheel is spinning" : won ? "Roulette hit" : "Roulette missed"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `${betTypes[round.betType].label}, result ${(result ?? 0) + 1}, ${((multiplierBps ?? 0) / 10_000).toFixed(2)}x gross` : undefined}
            share={settled && won ? { game: "Roulette Lite", detail: `Hit ${(result ?? 0) + 1} for ${((multiplierBps ?? 0) / 10_000).toFixed(2)}x.`, txHash: game.txHash } : undefined}
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
