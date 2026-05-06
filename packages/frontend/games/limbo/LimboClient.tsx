"use client";

import { useEffect, useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import { Gauge } from "lucide-react";
import limboAbi from "@baseplay/shared/abis/LimboGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

export function LimboClient() {
  const [amount, setAmount] = useState("0.0005");
  const [target, setTarget] = useState(250);
  const [roundTarget, setRoundTarget] = useState(250);
  const [pulse, setPulse] = useState(1);
  const game = useGame("limbo", "LimboGame", limboAbi as Abi);
  const event = findEventArgs(game.vrfResult, "LimboResult");
  const roll = toNumber(event?.roll);
  const threshold = toNumber(event?.threshold);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const chance = 100 / (target / 100);

  useEffect(() => {
    if (!isBusy) {
      setPulse(1);
      return;
    }
    const interval = window.setInterval(() => setPulse((value) => (value >= target / 100 ? 1 : value + 0.17)), 70);
    return () => window.clearInterval(interval);
  }, [isBusy, target]);

  async function play() {
    setRoundTarget(target);
    const params = encodeAbiParameters([{ type: "uint256" }], [BigInt(target * 100)]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="limbo"
      title="Limbo"
      description="Choose a multiplier target. VRF rolls below the matching threshold to win."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Target multiplier</span>
              <span className="font-mono text-[var(--text-1)]">{(target / 100).toFixed(2)}x</span>
            </div>
            <input type="range" min={110} max={2000} value={target} disabled={isBusy} onChange={(event) => setTarget(Number(event.target.value))} className="w-full accent-[var(--accent)] disabled:opacity-50" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Gross payout" value={`${(target / 100).toFixed(2)}x`} />
              <Metric label="Win chance" value={`${chance.toFixed(2)}%`} />
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="limbo" title="Limbo feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[520px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="limbo-stage-layout">
          <div className={`limbo-meter ${isBusy ? "limbo-meter-running" : ""}`}>
            <Gauge size={30} />
            <span>{(isBusy ? pulse : roundTarget / 100).toFixed(2)}x</span>
            <small>{isBusy ? "Rolling threshold" : settled ? (won ? "Target cleared" : "Target missed") : "Target multiplier"}</small>
          </div>
          <div className="limbo-track">
            <div className="limbo-track-bar" style={{ width: `${Math.min(100, isBusy ? (pulse / (target / 100)) * 100 : chance)}%` }} data-state={settled ? (won ? "win" : "loss") : "idle"} />
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Target", value: `${(roundTarget / 100).toFixed(2)}x` },
              { label: "Chance", value: `${chance.toFixed(2)}%` },
              { label: "Roll", value: settled ? `${roll ?? "-"}` : isBusy ? "Rolling" : "-" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Limbo roll is running" : won ? "Target cleared" : "Target missed"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `Target ${(roundTarget / 100).toFixed(2)}x. Roll ${roll ?? "-"} / threshold ${threshold ?? "-"}.` : undefined}
            share={settled && won ? { game: "Limbo", detail: `Cleared ${(roundTarget / 100).toFixed(2)}x target.` } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="font-mono text-[10px] uppercase text-[var(--text-3)]">{label}</div>
      <div className="mt-1 font-mono font-bold text-[var(--text-1)]">{value}</div>
    </div>
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
