"use client";

import { useEffect, useMemo, useState } from "react";
import type { Abi } from "viem";
import { BadgeDollarSign, Coins, Diamond, Gem, Hexagon, Rows3 } from "lucide-react";
import slotsAbi from "@baseplay/shared/abis/SlotsGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const symbols = [
  { label: "Base", tone: "slot-symbol-base", Icon: Hexagon, mark: "B" },
  { label: "Seven", tone: "slot-symbol-seven", Icon: BadgeDollarSign, mark: "7" },
  { label: "Gem", tone: "slot-symbol-gem", Icon: Gem, mark: "" },
  { label: "Coins", tone: "slot-symbol-coins", Icon: Coins, mark: "" },
  { label: "Bars", tone: "slot-symbol-bars", Icon: Rows3, mark: "" },
  { label: "Ether", tone: "slot-symbol-ether", Icon: Diamond, mark: "" }
] as const;

export function SlotsClient() {
  const [amount, setAmount] = useState("0.0005");
  const [tick, setTick] = useState(0);
  const game = useGame("slots", "SlotsGame", slotsAbi as Abi);
  const event = findEventArgs(game.vrfResult, "SlotsResult");
  const reels = useMemo(() => [toNumber(event?.reelA), toNumber(event?.reelB), toNumber(event?.reelC)], [event?.reelA, event?.reelB, event?.reelC]);
  const multiplierBps = toNumber(event?.multiplierBps) ?? 0;
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const visibleReels = useMemo(() => {
    if (settled && reels.every((value) => value !== null)) return reels as number[];
    if (!isBusy) return [0, 1, 4];
    return [tick % symbols.length, (tick + 2) % symbols.length, (tick + 4) % symbols.length];
  }, [isBusy, reels, settled, tick]);

  useEffect(() => {
    if (!isBusy) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 110);
    return () => window.clearInterval(interval);
  }, [isBusy]);

  async function play() {
    await game.placeBet(amount, "0x");
  }

  const resultLabel = multiplierBps >= 250_000
    ? "Jackpot triple"
    : multiplierBps >= 120_000
      ? "Triple match"
      : multiplierBps > 0
        ? "Pair match"
        : "No match";

  return (
    <GameShell
      gameId="slots"
      title="Slots"
      description="Spin three on-chain reels. Chainlink VRF draws every symbol after the bet is confirmed."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Payout table</span>
              <span className="font-mono text-[var(--text-1)]">max 25x</span>
            </div>
            <div className="grid gap-2">
              <PayoutRow label="Base triple" value="25x" />
              <PayoutRow label="Any triple" value="12x" />
              <PayoutRow label="Any pair" value="1.45x" />
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="slots" title="Slots feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[430px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-5">
          <div className="slot-stage-wrap">
            <div className={`slot-machine ${isBusy ? "slot-machine-running" : ""}`}>
              <div className="slot-machine-top">
                <span>VRF REELS</span>
                <strong>{settled ? resultLabel : isBusy ? "SPINNING" : "READY"}</strong>
              </div>
              <div className="slot-reels" aria-label="Slot reels">
                {visibleReels.map((symbolIndex, index) => {
                const symbol = symbols[symbolIndex] ?? symbols[0];
                const Icon = symbol.Icon;
                return (
                  <div key={`${index}-${symbol.label}`} className={`slot-reel ${symbol.tone} ${isBusy ? "slot-reel-spinning" : ""}`}>
                    <div className="slot-reel-content">
                      <span className="slot-symbol-badge">
                        <Icon className="slot-symbol-icon" size={42} strokeWidth={2.35} />
                      </span>
                      {symbol.mark && <span className="slot-symbol-mark">{symbol.mark}</span>}
                      <small className="slot-symbol-label">{symbol.label}</small>
                    </div>
                  </div>
                );
              })}
              </div>
              <div className="slot-machine-bottom">
                <span>PAIR 1.45x</span>
                <span>TRIPLE 12x</span>
                <span>BASE 25x</span>
              </div>
            </div>
            <div className={`slot-lever ${isBusy ? "slot-lever-running" : ""}`} aria-hidden="true">
              <span />
              <strong>VRF</strong>
            </div>
          </div>

          <RoundSummaryStrip
            items={[
              { label: "State", value: isBusy ? "Spinning" : settled ? (won ? "Won" : "Lost") : "Ready" },
              { label: "Line", value: settled ? visibleReels.map((value) => symbols[value]?.label ?? "BASE").join(" / ") : "Hidden" },
              { label: "Pays", value: settled ? `${(multiplierBps / 10_000).toFixed(2)}x` : "up to 25x" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />

          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Reels are spinning" : won ? resultLabel : "No matching line"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `${visibleReels.map((value) => symbols[value]?.label ?? "BASE").join(" / ")} - ${(multiplierBps / 10_000).toFixed(2)}x gross` : undefined}
            share={settled && won ? { game: "Slots", detail: `${resultLabel} for ${(multiplierBps / 10_000).toFixed(2)}x.` } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function PayoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="scratch-prize-row">
      <span>{label}</span>
      <strong>{value}</strong>
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
