"use client";

import { useEffect, useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import colorPickAbi from "@baseplay/shared/abis/ColorPickGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const colors = [
  { id: 0, name: "Blue", className: "color-swatch-blue" },
  { id: 1, name: "Green", className: "color-swatch-green" },
  { id: 2, name: "Gold", className: "color-swatch-gold" },
  { id: 3, name: "Rose", className: "color-swatch-rose" }
] as const;

export function ColorPickClient() {
  const [amount, setAmount] = useState("0.0005");
  const [choice, setChoice] = useState(0);
  const [roundChoice, setRoundChoice] = useState(0);
  const [cursor, setCursor] = useState(0);
  const game = useGame("color-pick", "ColorPickGame", colorPickAbi as Abi);
  const event = findEventArgs(game.vrfResult, "ColorPickResult");
  const resultColor = toNumber(event?.resultColor);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const activeColor = isBusy ? cursor : resultColor ?? choice;

  useEffect(() => {
    if (!isBusy) return;
    const interval = window.setInterval(() => setCursor((value) => (value + 1) % colors.length), 120);
    return () => window.clearInterval(interval);
  }, [isBusy]);

  async function play() {
    setRoundChoice(choice);
    const params = encodeAbiParameters([{ type: "uint8" }], [choice]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="color-pick"
      title="Color Pick"
      description="Pick one of four colors. VRF reveals the winning color after the wager is locked."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Color</span>
              <span className="font-mono text-[var(--text-1)]">4.00x gross</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {colors.map((item) => (
                <button key={item.id} type="button" disabled={isBusy} onClick={() => setChoice(item.id)} className={`color-choice ${item.className} ${choice === item.id ? "color-choice-selected" : ""}`}>
                  <span />
                  {item.name}
                </button>
              ))}
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={!game.contractAddress} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="color-pick" title="Color Pick feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[460px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className={`color-result-orb ${colors[activeColor]?.className ?? ""} ${isBusy ? "color-result-running" : ""}`}>
            <span>{colors[activeColor]?.name ?? "Color"}</span>
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Pick", value: colors[roundChoice].name },
              { label: "Result", value: settled ? colors[resultColor ?? 0].name : isBusy ? "Cycling" : "-" },
              { label: "Pays", value: "4x" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Color is cycling" : won ? "Color matched" : "Color missed"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `Picked ${colors[roundChoice].name}, result ${colors[resultColor ?? 0].name}` : undefined}
            share={settled && won ? { game: "Color Pick", detail: `Matched ${colors[resultColor ?? 0].name}.` } : undefined}
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
