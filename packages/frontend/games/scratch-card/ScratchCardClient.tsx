"use client";

import { useEffect, useState } from "react";
import type { Abi } from "viem";
import scratchAbi from "@baseplay/shared/abis/ScratchCardGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const tiers = [
  { id: 0, label: "Blank", payout: "0x" },
  { id: 1, label: "Pair", payout: "2x" },
  { id: 2, label: "Stack", payout: "4x" },
  { id: 3, label: "Vault", payout: "10x" },
  { id: 4, label: "Jackpot", payout: "30x" }
] as const;

export function ScratchCardClient() {
  const [amount, setAmount] = useState("0.00023");
  const [cursor, setCursor] = useState(0);
  const game = useGame("scratch-card", "ScratchCardGame", scratchAbi as Abi);
  const event = findEventArgs(game.vrfResult, "ScratchCardResult");
  const tier = toNumber(event?.tier);
  const multiplierBps = toNumber(event?.multiplierBps);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const displayTier = settled ? tier ?? 0 : isBusy ? cursor : null;
  const displayPrize = displayTier === null ? null : tiers[displayTier] ?? tiers[0];

  useEffect(() => {
    if (!isBusy) return;
    const interval = window.setInterval(() => setCursor((value) => (value + 1) % tiers.length), 140);
    return () => window.clearInterval(interval);
  }, [isBusy]);

  async function play() {
    await game.placeBet(amount, "0x");
  }

  return (
    <GameShell
      gameId="scratch-card"
      title="Scratch Card"
      description="Reveal a VRF-backed prize tier. No hidden client-side result path."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Prize table</span>
              <span className="font-mono text-[var(--text-1)]">max 30x</span>
            </div>
            <div className="grid gap-2">
              {tiers.slice(1).reverse().map((item) => (
                <div key={item.id} className="scratch-prize-row">
                  <span>{item.label}</span>
                  <strong>{item.payout}</strong>
                </div>
              ))}
            </div>
          </section>
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="scratch-card" title="Scratch feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[520px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className={`scratch-ticket-stage ${isBusy ? "scratch-ticket-stage-running" : ""}`}>
            <div className={`scratch-ticket ${settled ? "scratch-ticket-revealed" : ""} ${isBusy ? "scratch-ticket-running" : ""}`}>
              <div className="scratch-ticket-top">
                <span>BasePlay scratch</span>
                <strong>{displayPrize?.label ?? "Hidden"}</strong>
              </div>
              <div className="scratch-ticket-symbols" aria-hidden="true">
                {tiers.slice(1).map((item) => (
                  <span key={item.id} className={displayPrize?.id === item.id ? "scratch-ticket-symbol-active" : ""}>
                    {item.payout}
                  </span>
                ))}
              </div>
              <div className="scratch-ticket-prize">
                <span>{isBusy ? "Revealing tier" : settled ? "Final tier" : "One VRF ticket"}</span>
                <strong>{displayPrize?.payout ?? "?"}</strong>
              </div>
            </div>
          </div>
          <RoundSummaryStrip
            items={[
              { label: "Tier", value: settled ? tiers[tier ?? 0].label : isBusy ? "Reveal" : "Hidden" },
              { label: "Prize", value: settled ? tiers[tier ?? 0].payout : isBusy ? "Scanning" : "?" },
              { label: "Pays", value: settled ? `${((multiplierBps ?? 0) / 10_000).toFixed(2)}x` : "up to 30x" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />
          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Card is revealing" : won ? "Prize revealed" : "No prize"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `${tiers[tier ?? 0].label}, ${((multiplierBps ?? 0) / 10_000).toFixed(2)}x gross` : undefined}
            share={settled && won ? { game: "Scratch Card", detail: `Revealed ${tiers[tier ?? 0].label} for ${((multiplierBps ?? 0) / 10_000).toFixed(2)}x.`, txHash: game.txHash } : undefined}
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
