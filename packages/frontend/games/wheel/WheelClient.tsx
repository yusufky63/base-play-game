"use client";

import { useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import wheelAbi from "@baseplay/shared/abis/WheelGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const profiles = [
  { id: 0, label: "Low", max: "2x" },
  { id: 1, label: "Medium", max: "2.5x" },
  { id: 2, label: "High", max: "8x" }
] as const;

const wheelLabels = [
  ["0x", "1x", "1x", "1.5x", "0x", "1x", "1.5x", "2x", "0x", "1x", "1x", "1.5x", "0x", "1x", "1.5x", "2x"],
  ["0x", "0x", "1.5x", "2.5x", "0x", "0x", "1.5x", "2.5x", "0x", "0x", "1.5x", "2.5x", "0x", "0x", "1.5x", "2.5x"],
  ["0x", "0x", "0x", "2x", "0x", "0x", "0x", "4x", "0x", "0x", "0x", "2x", "0x", "0x", "4x", "8x"]
];

export function WheelClient() {
  const [amount, setAmount] = useState("0.0005");
  const [profile, setProfile] = useState(0);
  const [roundProfile, setRoundProfile] = useState(0);
  const game = useGame("wheel", "WheelGame", wheelAbi as Abi);
  const event = findEventArgs(game.vrfResult, "WheelResult");
  const segment = toNumber(event?.segment);
  const multiplierBps = toNumber(event?.multiplierBps);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const rotation = settled && segment !== null ? 360 * 5 + segment * 22.5 : isBusy ? 1080 : 0;
  const labels = wheelLabels[profile];

  async function play() {
    setRoundProfile(profile);
    const params = encodeAbiParameters([{ type: "uint8" }], [profile]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="wheel"
      title="Wheel"
      description="Choose a risk profile and spin a 16-segment multiplier wheel."
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
          <LiveFeed gameId="wheel" title="Wheel feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[500px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className="wheel-wrap" data-risk={profiles[profile].label}>
            <div className="wheel-pointer" />
            <div className={`wheel-face wheel-profile-${profile} ${isBusy ? "wheel-spinning" : ""}`} style={{ transform: `rotate(${rotation}deg)` }}>
              {labels.map((label, index) => (
                <span key={index} className={label === "0x" ? "wheel-label-empty" : "wheel-label-pay"} style={{ transform: `rotate(${index * 22.5 + 11.25}deg) translateY(-112px)` }}>{label}</span>
              ))}
              <div className="wheel-hub">
                <strong>{profiles[profile].label}</strong>
                <small>VRF spin</small>
              </div>
            </div>
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Risk", value: profiles[roundProfile].label },
              { label: "Segment", value: settled ? `${(segment ?? 0) + 1}` : isBusy ? "Spinning" : "-" },
              { label: "Pays", value: settled ? `${((multiplierBps ?? 0) / 10_000).toFixed(2)}x` : profiles[profile].max }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Wheel is spinning" : won ? "Multiplier landed" : "No payout segment"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `${profiles[roundProfile].label} risk, segment ${(segment ?? 0) + 1}, ${((multiplierBps ?? 0) / 10_000).toFixed(2)}x gross` : undefined}
            share={settled && won ? { game: "Wheel", detail: `Landed ${((multiplierBps ?? 0) / 10_000).toFixed(2)}x on ${profiles[roundProfile].label} risk.` } : undefined}
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
