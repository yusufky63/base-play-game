"use client";

import { useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import coinFlipAbi from "@baseplay/shared/abis/CoinFlipGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

export function CoinFlipClient() {
  const [amount, setAmount] = useState("0.0005");
  const [choice, setChoice] = useState<"Heads" | "Tails">("Heads");
  const [roundChoice, setRoundChoice] = useState<"Heads" | "Tails">("Heads");
  const game = useGame("coin-flip", "CoinFlipGame", coinFlipAbi as Abi);
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const result = settled ? (won ? roundChoice : oppositeChoice(roundChoice)) : null;
  const coinFace = result ? (result === "Heads" ? "H" : "T") : choice === "Heads" ? "H" : "T";
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";

  async function play() {
    const selectedChoice = choice;
    setRoundChoice(selectedChoice);
    const params = encodeAbiParameters([{ type: "uint8" }], [selectedChoice === "Heads" ? 0 : 1]);
    await game.placeBet(amount, params);
  }

  function chooseSide(nextChoice: "Heads" | "Tails") {
    if (isBusy) return;
    if (settled) game.reset();
    setChoice(nextChoice);
  }

  return (
    <GameShell
      gameId="coin-flip"
      title="Coin Flip"
      description="Heads or tails with instant settlement after VRF confirmation."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <BetPanel amount={amount} loading={game.isTxPending} disabled={game.isPlayDisabled} disabledReason={game.playDisabledReason} vrfState={game.vrfState} onAmountChange={setAmount} onPlay={play} onRefund={game.claimRefund} />
          <LiveFeed gameId="coin-flip" title="Coin Flip feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[460px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="flex h-full flex-col items-center justify-center gap-7">
          <div className={`coin-scene ${isBusy ? "coin-scene-running" : ""}`}>
            <div className="coin-orbit" />
            <div
              className={`coin-face ${
                isBusy ? "coin-face-spinning" : ""
              } ${
                settled
                  ? won
                    ? "coin-face-settled coin-face-win"
                    : "coin-face-settled coin-face-loss"
                  : "coin-face-idle"
              }`}
            >
              <span className="coin-rim" />
              <span className="coin-mark">{coinFace}</span>
              <span className="coin-caption">{result ?? choice}</span>
            </div>
            <div className="coin-shadow" />
          </div>

          <div className="grid w-full max-w-md grid-cols-2 gap-2">
            {(["Heads", "Tails"] as const).map((item) => (
              <button
                key={item}
                type="button"
                disabled={isBusy}
                onClick={() => chooseSide(item)}
                className={`coin-choice play-button-ghost rounded-md px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-55 ${
                  choice === item
                    ? "choice-option-selected border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "text-[var(--text-2)] hover:border-[var(--accent)] hover:text-white"
              }`}
              >
                <span>{item}</span>
              </button>
            ))}
          </div>

          <RoundSummaryStrip
            items={[
              { label: "Pick", value: roundChoice },
              { label: "Landed", value: result ?? (isBusy ? "Resolving" : "-") },
              { label: "Pays", value: "2x" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />

          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Coin is spinning on-chain" : won ? "Correct side" : "Wrong side"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `Picked ${roundChoice}, landed ${result}` : undefined}
            share={settled && won && result ? { game: "Coin Flip", detail: `Picked ${roundChoice}, landed ${result}.`, txHash: game.txHash } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function oppositeChoice(choice: "Heads" | "Tails") {
  return choice === "Heads" ? "Tails" : "Heads";
}
