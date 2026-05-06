"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeAbiParameters, type Abi } from "viem";
import { Bomb, Gem, Loader2, Sparkles } from "lucide-react";
import minesAbi from "@baseplay/shared/abis/MinesGame.json";
import { BetPanel } from "@/components/game/BetPanel";
import { GameShell } from "@/components/game/GameShell";
import { LiveFeed } from "@/components/game/LiveFeed";
import { ResultCallout } from "@/components/game/ResultCallout";
import { RoundSummaryStrip } from "@/components/game/RoundSummaryStrip";
import { useGame } from "@/hooks/useGame";

const GRID_SIZE = 25;

export function MinesClient() {
  const [amount, setAmount] = useState("0.0005");
  const [mineCount, setMineCount] = useState(3);
  const [roundMineCount, setRoundMineCount] = useState(3);
  const [roundSafeCount, setRoundSafeCount] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);
  const game = useGame("mines", "MinesGame", minesAbi as Abi);
  const safeCount = revealed.size;
  const settled = game.vrfState === "settled" && typeof game.vrfResult?.won === "boolean";
  const won = game.vrfResult?.won === true;
  const isBusy = game.vrfState === "pending_tx" || game.vrfState === "pending_vrf";
  const maxSafeSelections = maxFairSafeSelections(mineCount);
  const canPlay = safeCount > 0 && safeCount <= maxSafeSelections;
  const displayMineCount = isBusy || settled ? roundMineCount : mineCount;
  const displaySafeCount = isBusy || settled ? roundSafeCount : safeCount;
  const multiplier = calcMinesMultiplier(displayMineCount, Math.max(displaySafeCount, 0)).toFixed(2);
  const cells = useMemo(() => Array.from({ length: GRID_SIZE }, (_, index) => index), []);
  const minesResult = findEventArgs(game.vrfResult, "MinesResult");
  const mineMask = toNumber(minesResult?.mineMask) ?? 0;

  async function startPreview() {
    if (isBusy) return;
    game.reset();
    setRunning(true);
    setRevealed(new Set());
    for (const cell of [2, 7, 11, 13, 17, 21].slice(0, Math.min(6, maxSafeSelections))) {
      await wait(140);
      setRevealed((current) => new Set([...current, cell]));
    }
    setRunning(false);
  }

  function reveal(index: number) {
    if (running || isBusy) return;
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
        return next;
      }
      if (next.size >= maxSafeSelections) return next;
      next.add(index);
      return next;
    });
  }

  async function play() {
    if (!canPlay) return;
    setRunning(false);
    setRoundMineCount(mineCount);
    setRoundSafeCount(safeCount);
    const revealMask = maskFromCells(revealed);
    const params = encodeAbiParameters([{ type: "uint8" }, { type: "uint32" }], [mineCount, revealMask]);
    await game.placeBet(amount, params);
  }

  useEffect(() => {
    setRevealed((current) => {
      if (current.size <= maxSafeSelections) return current;
      return new Set(Array.from(current).slice(0, maxSafeSelections));
    });
  }, [maxSafeSelections]);

  return (
    <GameShell
      gameId="mines"
      title="Mines"
      description="Select safe cells on a 5x5 board. Chainlink VRF places the mines and the contract settles the payout."
      vrfState={game.vrfState}
      requestId={game.requestId}
      txHash={game.txHash}
      side={
        <div className="space-y-4">
          <section className="panel p-4">
            <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--text-2)]">Risk setup</span>
              <span className="font-mono text-[var(--text-1)]">{mineCount} mines</span>
            </div>
            <input type="range" min={1} max={10} value={mineCount} disabled={isBusy} onChange={(event) => setMineCount(Number(event.target.value))} className="mb-3 w-full accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-55" />
            <div className="mb-3 rounded-md bg-[var(--surface-2)] px-3 py-2 text-xs leading-5 text-[var(--text-2)]">
              Select 1-{maxSafeSelections} cells before playing. Higher picks are capped out by max payout rules, so they are not offered.
            </div>
            <button type="button" onClick={startPreview} disabled={running || isBusy} className="primary-action flex h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white disabled:opacity-50">
              {running ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {running ? "Revealing" : "Run animation"}
            </button>
          </section>
          <BetPanel
            amount={amount}
            loading={game.isTxPending}
            disabled={game.isPlayDisabled || running || !canPlay}
            disabledReason={game.playDisabledReason} vrfState={game.vrfState}
            actionLabel={safeCount === 0 ? "Select cells first" : "Play selected cells"}
            onAmountChange={setAmount}
            onPlay={play}
            onRefund={game.claimRefund}
          />
          <LiveFeed gameId="mines" title="Mines feed" limit={5} showAllLink />
        </div>
      }
    >
      <section className={`game-stage min-h-[560px] p-4 md:p-6 ${settled ? (won ? "result-win-effect" : "result-loss-effect") : ""}`}>
        <div className="mines-stage-layout">
          <RoundSummaryStrip
            items={[
              { label: "Safe", value: `${safeCount}` },
              { label: "Pays", value: `${multiplier}x` },
              { label: "State", value: settled ? (won ? "Win" : "Loss") : isBusy ? "Resolving" : "Ready" }
            ]}
            status={settled ? (won ? "win" : "loss") : isBusy ? "running" : "idle"}
          />

          <div className="mines-risk-preview" aria-label={`${displayMineCount} hidden mines risk setup`}>
            <div>
              <span>Risk field</span>
              <strong>{displayMineCount} hidden mines</strong>
            </div>
            <div className="mines-risk-pips" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, index) => (
                <span key={index} className={index < displayMineCount ? "mines-risk-pip-active" : ""}>
                  <Bomb size={12} />
                </span>
              ))}
            </div>
          </div>

          <div className="mines-board">
            {cells.map((index) => {
              const isRevealed = revealed.has(index);
              const isMine = settled && Boolean(mineMask & (1 << index));
              return (
                <button
                  key={index}
                  type="button"
                  disabled={isBusy}
                  onClick={() => reveal(index)}
                  aria-label={`Cell ${index + 1}`}
                  className={`mine-cell flex aspect-square items-center justify-center rounded-md border-2 disabled:cursor-not-allowed disabled:opacity-70 ${
                    isMine ? "mine-cell-mine border-[var(--lose)] bg-[var(--lose-light)] text-[var(--lose)]" : isRevealed ? "mine-cell-revealed border-[var(--win)] bg-[var(--win-light)] text-[var(--win)]" : "border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--text-3)] hover:border-[var(--accent)]"
                  } ${running ? "mine-cell-scanning" : ""}`}
                >
                  {isMine ? <Bomb size={22} /> : isRevealed ? <Gem size={24} /> : <span className="mine-cell-dot" />}
                </button>
              );
            })}
          </div>

          <ResultCallout
            variant={isBusy ? "pending" : settled ? (won ? "win" : "loss") : "idle"}
            title={isBusy ? "Mine field is resolving" : won ? "Selected cells were safe" : "A mine was hit"}
            detail={isBusy ? "Waiting for contract settlement" : settled ? `${roundSafeCount} picks, ${roundMineCount} mines` : undefined}
            share={settled && won ? { game: "Mines", detail: `${roundSafeCount} safe picks with ${roundMineCount} mines.` } : undefined}
          />
        </div>
      </section>
    </GameShell>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function maskFromCells(cells: Set<number>) {
  let mask = 0;
  for (const cell of cells) {
    mask |= 1 << cell;
  }
  return mask;
}

function calcMinesMultiplier(mineCount: number, revealedCount: number) {
  const safeCells = GRID_SIZE - mineCount;
  let multiplier = 1;

  for (let index = 0; index < revealedCount; index++) {
    multiplier *= (GRID_SIZE - index) / (safeCells - index);
  }

  return multiplier;
}

function maxFairSafeSelections(mineCount: number) {
  const safeCells = GRID_SIZE - mineCount;
  let max = 1;

  for (let revealedCount = 1; revealedCount <= safeCells; revealedCount++) {
    if (calcMinesMultiplier(mineCount, revealedCount) <= 20) {
      max = revealedCount;
    } else {
      break;
    }
  }

  return max;
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
