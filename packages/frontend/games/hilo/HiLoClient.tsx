"use client";

import { useEffect, useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import hiloAbi from "@baseplay/shared/abis/HiLoGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

export function HiLoClient() {
  const [amount, setAmount] = useState("0.0005");
  const [currentCardValue, setCurrentCardValue] = useState(7);
  const [roundCardValue, setRoundCardValue] = useState(7);
  const [roundDirection, setRoundDirection] = useState<"higher" | "lower" | null>(null);
  const [streak, setStreak] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const game = useGame("hilo", "HiLoGame", hiloAbi as Abi);
  const current = cardLabel(currentCardValue);
  const selectedCardValue = currentCardValue;
  const higherPayout = payoutMultiplier(selectedCardValue, "higher");
  const lowerPayout = payoutMultiplier(selectedCardValue, "lower");
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const hiloResult = findEventArgs(game.vrfResult, "HiLoResult");
  const onchainCurrent = toNumber(hiloResult?.currentCard);
  const onchainNext = toNumber(hiloResult?.nextCard);
  const displayCurrent = settled && onchainCurrent ? cardLabel(onchainCurrent) : current;
  const displayNext = settled && onchainNext ? cardLabel(onchainNext) : null;
  const isBusy = flipping || game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";

  async function pick(direction: "higher" | "lower") {
    if (isBusy) return;
    if (payoutMultiplier(selectedCardValue, direction) === null) return;
    setFlipping(true);
    setRoundCardValue(selectedCardValue);
    setRoundDirection(direction);
    try {
      const params = encodeAbiParameters([{ type: "uint8" }, { type: "uint8" }], [direction === "higher" ? 1 : 0, selectedCardValue]);
      await game.placeBet(amount, params);
    } finally {
      await wait(420);
      setFlipping(false);
    }
  }

  useEffect(() => {
    if (!settled) return;
    setStreak((value) => (won ? value + 1 : 0));
    if (won && onchainNext) {
      setCurrentCardValue(onchainNext);
    } else if (!won) {
      setCurrentCardValue(7);
    }
  }, [settled, won, onchainNext]);

  return (
    <GameShell
      gameId="hilo"
      title="Hi-Lo"
      description="Predict whether the next card is higher or lower. Chainlink VRF draws the cards and the contract settles the result."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Choice</span>
              <span className="font-mono text-[var(--text-1)]">Current {current}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ChoiceButton label="Higher" payout={higherPayout} icon="up" loading={isBusy} disabled={game.isPlayDisabled || higherPayout === null} onClick={() => pick("higher")} />
              <ChoiceButton label="Lower" payout={lowerPayout} icon="down" loading={isBusy} disabled={game.isPlayDisabled || lowerPayout === null} onClick={() => pick("lower")} />
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-3)]">Payout is based on the current card odds. The vault applies house edge after gross payout.</p>
          </section>
          <BetPanel
            amount={amount}
            loading={game.isTxPending}
            disabled={game.isPlayDisabled || isBusy}
            disabledReason={game.playDisabledReason} vrfState={game.vrfState}
            hideAction
            actionLabel="Choose direction"
            onAmountChange={setAmount}
            onPlay={() => void pick("higher")}
            onRefund={game.claimRefund}
          />
          <LiveFeed gameId="hilo" title="Hi-Lo feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[520px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <RoundSummaryStrip
          items={[
            { label: "Streak", value: `${streak}` },
            { label: "Card", value: current },
            { label: "State", value: settled ? (won ? "Win" : "Loss") : isBusy ? "Drawing" : "Ready" }
          ]}
          status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          className="mb-5"
        />

        <div className="flex min-h-[360px] flex-col items-center justify-center gap-6">
          <div className={`hilo-card ${flipping ? "hilo-card-flipping" : ""}`}>
            <div className="font-mono text-4xl font-bold">{displayCurrent}</div>
            <div className="hilo-card-mark">BP</div>
            <div className="self-end font-mono text-4xl font-bold">{displayNext ?? displayCurrent}</div>
          </div>

          <div className="font-mono text-sm text-[var(--text-3)]">
            {isBusy ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Processing on-chain result</span> : "Choose higher or lower"}
          </div>

          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Card draw is running" : won ? "Direction matched" : "Direction missed"}
            detail={
              isBusy
                ? "Waiting for contract settlement"
                : settled
                  ? `${roundDirection ?? "choice"} from ${cardLabel(roundCardValue)} to ${displayNext ?? "hidden"}`
                  : undefined
            }
            share={settled && won ? { game: "Hi-Lo", detail: `${roundDirection ?? "choice"} from ${cardLabel(roundCardValue)} to ${displayNext ?? "hidden"}.` } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function ChoiceButton({ label, payout, icon, loading, disabled = false, onClick }: { label: string; payout: number | null; icon: "up" | "down"; loading: boolean; disabled?: boolean; onClick: () => void }) {
  const Icon = icon === "up" ? ArrowUp : ArrowDown;
  return (
    <button type="button" disabled={loading || disabled} onClick={onClick} className="play-button-ghost flex min-h-12 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
      <span className="grid text-left leading-tight">
        <span>{label}</span>
        <span className="font-mono text-[10px] opacity-75">{payout ? `${payout.toFixed(2)}x gross` : "Unavailable"}</span>
      </span>
    </button>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function cardLabel(value: number) {
  if (value === 1) return "A";
  if (value === 11) return "J";
  if (value === 12) return "Q";
  if (value === 13) return "K";
  return String(value);
}

function payoutMultiplier(card: number, direction: "higher" | "lower") {
  const winCards = direction === "higher" ? 13 - card : card - 1;
  if (winCards <= 0) return null;
  const multiplier = 13 / winCards;
  return multiplier > 8 ? null : multiplier;
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
