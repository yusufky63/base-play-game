"use client";

import { useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import plinkoAbi from "@baseplay/shared/abis/PlinkoLiteGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const profiles = [
  { id: 0, label: "Low", max: "5x" },
  { id: 1, label: "Medium", max: "20x" },
  { id: 2, label: "High", max: "25x" }
] as const;

const slotLabelsByProfile = [
  ["5x", "1.8x", "1.2x", "0.9x", "0.7x", "0.9x", "1.2x", "1.8x", "5x"],
  ["20x", "4x", "1.23x", "0.63x", "0.23x", "0.63x", "1.23x", "4x", "20x"],
  ["25x", "5x", "1.3x", "0.5x", "0x", "0.5x", "1.3x", "5x", "25x"]
];

export function PlinkoLiteClient() {
  const [amount, setAmount] = useState("0.0005");
  const [profile, setProfile] = useState(1);
  const [roundProfile, setRoundProfile] = useState(1);
  const game = useGame("plinko-lite", "PlinkoLiteGame", plinkoAbi as Abi);
  const event = findEventArgs(game.vrfResult, "PlinkoLiteResult");
  const slot = toNumber(event?.slot);
  const multiplierBps = toNumber(event?.multiplierBps);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const slotLabels = slotLabelsByProfile[profile];

  async function play() {
    setRoundProfile(profile);
    const params = encodeAbiParameters([{ type: "uint8" }], [profile]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="plinko-lite"
      title="Plinko Lite"
      description="VRF chooses an 8-step path through the board and lands in a multiplier slot."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 border-b border-[var(--border)] pb-3 text-sm text-[var(--text-2)]">Risk profile</div>
            <div className="grid gap-2">
              {profiles.map((item) => (
                <button key={item.id} type="button" disabled={isBusy} onClick={() => setProfile(item.id)} className={`play-button-ghost flex h-11 items-center justify-between rounded-md px-3 text-sm font-bold disabled:opacity-50 ${profile === item.id ? "choice-option-selected" : ""}`}>
                  <span>{item.label}</span>
                  <span className="font-mono text-xs opacity-80">max {item.max}</span>
                </button>
              ))}
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={!game.contractAddress} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="plinko-lite" title="Plinko feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[620px] p-4 md:p-7 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-6">
          <div className="plinko-board">
            <div className="plinko-top-label">
              <span>{profiles[profile].label} risk</span>
              <strong>8 rows</strong>
            </div>
            <div className={`plinko-ball ${isBusy ? "plinko-ball-running" : settled ? "plinko-ball-settled" : ""}`} style={{ left: settled && slot !== null ? `${10 + slot * 10}%` : "50%" }} />
            {Array.from({ length: 8 }).map((_, row) => (
              <div key={row} className="plinko-row" style={{ gridTemplateColumns: `repeat(${row + 2}, minmax(0, 1fr))` }}>
                {Array.from({ length: row + 2 }).map((__, col) => <span key={col} />)}
              </div>
            ))}
            <div className="plinko-slots">
              {slotLabels.map((label, index) => (
                <span key={index} className={settled && slot === index ? "plinko-slot-active" : ""}>{label}</span>
              ))}
            </div>
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Risk", value: profiles[roundProfile].label },
              { label: "Slot", value: settled && slot !== null ? `${slot + 1}` : isBusy ? "Dropping" : "-" },
              { label: "Pays", value: settled ? `${((multiplierBps ?? 0) / 10_000).toFixed(2)}x` : profiles[profile].max }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Ball is dropping" : won ? "Slot paid" : "Center loss"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `${profiles[roundProfile].label} risk, slot ${(slot ?? 0) + 1}, ${((multiplierBps ?? 0) / 10_000).toFixed(2)}x gross` : undefined}
            share={settled && won ? { game: "Plinko Lite", detail: `Landed ${((multiplierBps ?? 0) / 10_000).toFixed(2)}x on ${profiles[roundProfile].label} risk.` } : undefined}
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
