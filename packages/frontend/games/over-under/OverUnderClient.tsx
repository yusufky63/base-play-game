"use client";

import { useEffect, useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import { ArrowDown, ArrowUp } from "lucide-react";
import overUnderAbi from "@baseplay/shared/abis/OverUnderGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

export function OverUnderClient() {
  const [amount, setAmount] = useState("0.00023");
  const [choice, setChoice] = useState<"over" | "under">("over");
  const [target, setTarget] = useState(60);
  const [roundChoice, setRoundChoice] = useState<"over" | "under">("over");
  const [roundTarget, setRoundTarget] = useState(60);
  const [ticker, setTicker] = useState(50);
  const game = useGame("over-under", "OverUnderGame", overUnderAbi as Abi);
  const event = findEventArgs(game.vrfResult, "OverUnderResult");
  const rolled = toNumber(event?.rolled);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const displayRoll = isBusy ? ticker : rolled ?? target;
  const payout = overUnderPayout(choice, target);

  useEffect(() => {
    if (!isBusy) return;
    const interval = window.setInterval(() => {
      setTicker((value) => (value * 37 + 23) % 100 || 100);
    }, 80);
    return () => window.clearInterval(interval);
  }, [isBusy]);

  async function play() {
    setRoundChoice(choice);
    setRoundTarget(target);
    const params = encodeAbiParameters([{ type: "uint8" }, { type: "uint8" }], [choice === "under" ? 0 : 1, target]);
    await game.placeBet(amount, params);
  }

  return (
    <GameShell
      gameId="over-under"
      title="Over / Under"
      description="Pick a threshold from 1-100. VRF rolls the number after your bet is locked on-chain."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Target</span>
              <span className="font-mono text-[var(--text-1)]">{choice} {target}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={isBusy} onClick={() => setChoice("under")} className={`play-button-ghost flex h-11 items-center justify-center gap-2 rounded-md text-sm font-bold disabled:opacity-50 ${choice === "under" ? "choice-option-selected" : ""}`}>
                <ArrowDown size={15} />
                Under
              </button>
              <button type="button" disabled={isBusy} onClick={() => setChoice("over")} className={`play-button-ghost flex h-11 items-center justify-center gap-2 rounded-md text-sm font-bold disabled:opacity-50 ${choice === "over" ? "choice-option-selected" : ""}`}>
                <ArrowUp size={15} />
                Over
              </button>
            </div>
            <input type="range" min={6} max={95} value={target} disabled={isBusy} onChange={(event) => setTarget(Number(event.target.value))} className="mt-4 w-full accent-[var(--accent)] disabled:opacity-50" />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Gross payout" value={`${payout.toFixed(2)}x`} />
              <Metric label="Win numbers" value={String(choice === "under" ? target - 1 : 100 - target)} />
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="over-under" title="Over / Under feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[460px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className={`number-orb ${isBusy ? "number-orb-running" : ""} ${settled ? (won ? "number-orb-win" : "number-orb-loss") : ""}`}>
            {displayRoll}
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Pick", value: `${roundChoice} ${roundTarget}` },
              { label: "Roll", value: settled ? `${rolled ?? "-"}` : isBusy ? "Rolling" : "-" },
              { label: "Pays", value: `${payout.toFixed(2)}x` }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            payout={game.vrfResult?.payout}
            betAmount={game.vrfResult?.betAmount ?? game.vrfResult?.bet_amount}
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Number is rolling" : won ? "Threshold hit" : "Threshold missed"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `Rolled ${rolled}, needed ${roundChoice} ${roundTarget}` : undefined}
            share={settled && won ? { game: "Over / Under", detail: `Rolled ${rolled}, needed ${roundChoice} ${roundTarget}.`, txHash: game.txHash } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function overUnderPayout(choice: "over" | "under", target: number) {
  const winNumbers = choice === "under" ? target - 1 : 100 - target;
  return Math.min(100 / winNumbers, 20);
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
