"use client";

import { useEffect, useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import crashAbi from "@baseplay/shared/abis/CrashGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

export function CrashClient() {
  const [amount, setAmount] = useState("0.0005");
  const [target, setTarget] = useState(250);
  const [roundTarget, setRoundTarget] = useState(250);
  const [animatedMultiplier, setAnimatedMultiplier] = useState(1);
  const game = useGame("crash", "CrashGame", crashAbi as Abi);
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const crashResult = findEventArgs(game.vrfResult, "CrashPointGenerated");
  const crashPoint = toNumber(crashResult?.crashPoint);
  const targetMultiplier = roundTarget / 100;
  const crashMultiplier = crashPoint ? crashPoint / 100 : null;
  const visibleMultiplier = isBusy
    ? animatedMultiplier
    : settled && won
      ? targetMultiplier
      : crashMultiplier ?? target / 100;

  useEffect(() => {
    if (!isBusy) {
      setAnimatedMultiplier(1);
      return;
    }

    const interval = window.setInterval(() => {
      setAnimatedMultiplier((current) => {
        const next = current + 0.07;
        return next > target / 100 ? 1 : next;
      });
    }, 90);

    return () => window.clearInterval(interval);
  }, [isBusy, target]);

  async function play() {
    const selectedTarget = target;
    setRoundTarget(selectedTarget);
    const params = encodeAbiParameters([{ type: "uint256" }], [BigInt(selectedTarget)]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="crash"
      title="Crash"
      description="Set an auto-cashout target and ride the multiplier before the crash point."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <div className="panel p-4">
            <div className="mb-2 flex justify-between text-xs text-[var(--text-3)]">
              <span>Auto cashout</span>
              <span className="font-mono text-[var(--text-1)]">{(target / 100).toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={101}
              max={1000}
              value={target}
              disabled={isBusy}
              onChange={(event) => setTarget(Number(event.target.value))}
              className="w-full accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-55"
            />
          </div>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={!game.contractAddress} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="crash" title="Crash feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[460px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-8">
          <div
            className={`flex h-56 w-full max-w-[520px] flex-col justify-between rounded-md border border-[var(--border-2)] bg-[var(--surface-2)] p-5 ${
              isBusy ? "game-animating" : settled ? "crash-result-settled" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]">Multiplier</div>
                <div className={`display-heading mt-1 text-5xl font-bold ${settled ? (won ? "text-[var(--win)]" : "text-[var(--lose)]") : "text-[var(--text-1)]"}`}>
                  {visibleMultiplier.toFixed(2)}x
                </div>
              </div>
              <div className="rounded-md border border-[var(--border-2)] px-3 py-2 text-right">
                <div className="font-mono text-[10px] font-semibold uppercase text-[var(--text-3)]">Auto</div>
                <div className="mt-1 font-mono text-sm font-semibold text-[var(--text-1)]">{(target / 100).toFixed(2)}x</div>
              </div>
            </div>

            <svg viewBox="0 0 420 120" className="h-28 w-full text-[var(--accent)]" role="img" aria-label="Crash multiplier graph">
              <path d="M18 96H402" stroke="var(--border-2)" strokeWidth="1" strokeDasharray="5 6" />
              <path d="M18 96C96 92 132 82 178 62C218 45 250 30 292 27C334 24 365 38 402 18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" className={`crash-path ${isBusy ? "crash-path-animating" : ""}`} />
              <circle cx="402" cy="18" r="6" fill="currentColor" />
            </svg>
          </div>

          <RoundSummaryStrip
            items={[
              { label: "Target", value: `${targetMultiplier.toFixed(2)}x` },
              { label: "Crash", value: crashMultiplier ? `${crashMultiplier.toFixed(2)}x` : isBusy ? "Running" : "-" },
              { label: "State", value: settled ? (won ? "Cashed" : "Crashed") : isBusy ? "Resolving" : "Ready" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />

          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Multiplier is running" : won ? "Auto cashout hit" : "Crashed before target"}
            detail={
              isBusy
                ? "Waiting for contract settlement"
                : settled
                  ? won
                    ? `Cashed out at ${targetMultiplier.toFixed(2)}x. ${crashMultiplier ? `Crash point: ${crashMultiplier.toFixed(2)}x.` : "Crash point passed target."}`
                    : `Target ${targetMultiplier.toFixed(2)}x, crashed at ${visibleMultiplier.toFixed(2)}x.`
                  : undefined
            }
            share={settled && won ? { game: "Crash", detail: `Cashed out at ${targetMultiplier.toFixed(2)}x${crashMultiplier ? ` before ${crashMultiplier.toFixed(2)}x crash point` : ""}.` } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function findEventArgs(result: Record<string, unknown> | null, eventName: string) {
  const events = result?.events;
  if (!Array.isArray(events)) return null;
  const event = events.find((entry) => {
    return typeof entry === "object" && entry !== null && "eventName" in entry && entry.eventName === eventName;
  }) as { args?: Record<string, unknown> } | undefined;
  return event?.args ?? null;
}

function toNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return null;
}
