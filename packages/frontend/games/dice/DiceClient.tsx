"use client";

import { useEffect, useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import diceAbi from "@baseplay/shared/abis/DiceGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

export function DiceClient() {
  const [amount, setAmount] = useState("0.0005");
  const [guess, setGuess] = useState(3);
  const [roundGuess, setRoundGuess] = useState(3);
  const [rollingFace, setRollingFace] = useState(3);
  const game = useGame("dice", "DiceGame", diceAbi as Abi);
  const diceResult = findEventArgs(game.vrfResult, "DiceResult");
  const rolled = typeof diceResult?.rolled === "number" ? diceResult.rolled : null;
  const won = game.vrfResult?.won === true;
  const rolling = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const displayFace = rolling ? rollingFace : rolled ?? guess;

  useEffect(() => {
    if (!rolling) {
      setRollingFace(rolled ?? guess);
      return;
    }

    const interval = window.setInterval(() => {
      setRollingFace((current) => (current % 6) + 1);
    }, 120);

    return () => window.clearInterval(interval);
  }, [guess, rolled, rolling]);

  async function play() {
    const selectedGuess = guess;
    setRoundGuess(selectedGuess);
    const params = encodeAbiParameters([{ type: "uint8" }], [selectedGuess]);
    await game.placeBet(amount, params);
  }

  function chooseGuess(nextGuess: number) {
    if (rolling) return;
    if (rolled !== null) game.reset();
    setGuess(nextGuess);
  }

  return (
    <GameShell
      gameId="dice"
      title="Dice"
      description="Pick one number from 1 to 6. A correct guess pays 6x gross before house edge."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <BetPanel amount={amount} loading={game.isTxPending} disabled={!game.contractAddress} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="dice" title="Dice feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[520px] p-4 md:p-6 ${rolled !== null ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="dice-stage-layout">
          <div className="dice-hero">
            <DiceFace value={displayFace} size="large" tone={rolled === null ? "neutral" : won ? "win" : "lose"} rolling={rolling} settled={rolled !== null} />
            <div className="dice-readout">
              <span>{rolled === null ? "Selected face" : "Rolled face"}</span>
              <strong>{displayFace}</strong>
            </div>
          </div>

          <div className="dice-choice-grid">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <button
                key={item}
                type="button"
                disabled={rolling}
                onClick={() => chooseGuess(item)}
                aria-label={`Choose ${item}`}
                className={`play-button-ghost flex aspect-square items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-55 ${
                  guess === item
                    ? "choice-option-selected border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "text-[var(--text-2)] hover:border-[var(--accent)] hover:text-white"
                }`}
              >
                <DiceFace value={item} size="small" tone={guess === item ? "selected" : "neutral"} />
              </button>
            ))}
          </div>

          <RoundSummaryStrip
            items={[
              { label: "Pick", value: `${roundGuess}` },
              { label: "Roll", value: rolled === null ? (rolling ? "Rolling" : "-") : `${rolled}` },
              { label: "Pays", value: "6x" }
            ]}
            status={rolled !== null ? (won ? "win" : "loss") : rolling ? "running" : "idle"}
          />

          <ResultCallout
            variant={rolling ? "pending" : rolled !== null ? (won ? "win" : "loss") : "idle"}
            title={rolling ? "Dice is rolling on-chain" : won ? "Face matched" : "Face missed"}
            detail={rolling ? "Waiting for contract settlement" : rolled !== null ? `Picked ${roundGuess}, rolled ${rolled}` : undefined}
            share={rolled !== null && won ? { game: "Dice", detail: `Picked ${roundGuess}, rolled ${rolled}.` } : undefined}
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

type DiceTone = "neutral" | "accent" | "selected" | "win" | "lose";

function DiceFace({ value, size, tone, rolling = false, settled = false }: { value: number; size: "small" | "large"; tone: DiceTone; rolling?: boolean; settled?: boolean }) {
  const pipsByValue: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };
  const pips = pipsByValue[value] ?? [4];
  const faceSize = size === "large" ? "dice-face-large" : "dice-face-small";
  const pipSize = size === "large" ? "h-5 w-5" : "h-1.5 w-1.5";
  const toneClass =
    tone === "win"
      ? "border-[var(--win)] bg-[var(--win-light)] text-[var(--win)]"
      : tone === "lose"
        ? "border-[var(--lose)] bg-[var(--lose-light)] text-[var(--lose)]"
        : tone === "selected"
          ? "border-white/45 bg-white/10 text-white"
        : tone === "accent"
          ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
          : "border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--accent)]";

  return (
    <div className={`dice-face grid grid-cols-3 grid-rows-3 border ${faceSize} ${toneClass} ${rolling ? "dice-face-rolling" : ""} ${settled ? "dice-face-settled" : ""}`}>
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="flex items-center justify-center">
          {pips.includes(index) && <span className={`rounded-full bg-current ${pipSize}`} />}
        </span>
      ))}
    </div>
  );
}
