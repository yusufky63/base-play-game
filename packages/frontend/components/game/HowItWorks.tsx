"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleDollarSign, Dice5, RadioTower } from "lucide-react";

const GAME_STEPS: Record<string, { title: string; body: string }[]> = {
  "coin-flip": [
    { title: "Choose a side", body: "Pick heads or tails and submit a bet from your connected wallet." },
    { title: "VRF decides", body: "The contract requests Chainlink VRF, so the result cannot be known before the bet." },
    { title: "Settle on-chain", body: "A matching side pays 2x gross before the vault applies the house edge." }
  ],
  dice: [
    { title: "Pick 1-6", body: "Choose one dice face and place the wager on-chain." },
    { title: "Random roll", body: "VRF returns the random word and the contract maps it to a dice face." },
    { title: "Payout", body: "A correct guess pays 6x gross before fees; other rolls settle as a loss." }
  ],
  crash: [
    { title: "Set cashout", body: "Choose the multiplier where the game should automatically cash out." },
    { title: "Generate point", body: "VRF creates the crash point after the bet transaction is confirmed." },
    { title: "Compare", body: "If your cashout target is below the crash point, the vault pays the target multiplier." }
  ],
  mines: [
    { title: "Select risk", body: "Mines uses a 5x5 board. More mines and more safe reveals increase the multiplier." },
    { title: "VRF places mines", body: "Randomness determines mine positions so the board is verifiable after settlement." },
    { title: "Avoid mines", body: "A clean reveal path pays by multiplier; hitting a mine settles the round as a loss." }
  ],
  hilo: [
    { title: "Read the card", body: "Use the visible current card and choose whether the VRF result should be higher or lower." },
    { title: "Draw with VRF", body: "The contract derives the result card from the random word and compares it with the locked current card." },
    { title: "Settle the call", body: "A correct call pays by odds. Each wager is still a separate on-chain round, so choices cannot change after signing." }
  ],
  "over-under": [
    { title: "Set a threshold", body: "Choose over or under and lock the target number into the bet transaction." },
    { title: "Roll 1-100", body: "VRF returns a random word and the contract maps it to a number between 1 and 100." },
    { title: "Compare odds", body: "If the roll passes your threshold, the vault pays the odds-based multiplier." }
  ],
  limbo: [
    { title: "Pick a multiplier", body: "Choose the payout target before sending the wager." },
    { title: "Lock the chance", body: "The target multiplier defines the win threshold and cannot change after the transaction." },
    { title: "Settle result", body: "VRF determines whether the roll clears the threshold and the vault pays the target." }
  ],
  wheel: [
    { title: "Choose risk", body: "Low, medium, and high profiles change how many wheel segments pay." },
    { title: "Spin with VRF", body: "The random word selects one of 16 on-chain wheel segments." },
    { title: "Pay segment", body: "The selected segment's multiplier is paid before the vault applies house edge." }
  ],
  "plinko-lite": [
    { title: "Choose risk", body: "Risk profile controls the slot multipliers at the bottom of the board." },
    { title: "Drop path", body: "VRF generates the left-right path through 8 rows." },
    { title: "Land slot", body: "The final slot decides the gross multiplier and the contract settles the round." }
  ],
  "color-pick": [
    { title: "Pick a color", body: "Choose one of four colors before the bet transaction is submitted." },
    { title: "Lock the choice", body: "The contract stores your selected color before requesting VRF randomness." },
    { title: "Reveal", body: "A matching color pays 4x gross before the vault applies the house edge." }
  ],
  "treasure-chest": [
    { title: "Pick a chest", body: "Select one of nine chests and lock it into the wager." },
    { title: "Hide the prize", body: "VRF selects the prize chest after the transaction is confirmed." },
    { title: "Open result", body: "If your chest contains the prize, it pays 9x gross before vault fees." }
  ],
  "lucky-seven": [
    { title: "Choose a side", body: "Bet under seven, exactly seven, or over seven before the roll." },
    { title: "Roll two dice", body: "VRF generates two dice faces and the contract sums them on-chain." },
    { title: "Settle odds", body: "Under and over pay lower odds; exactly seven pays higher odds because it is rarer." }
  ],
  "roulette-lite": [
    { title: "Choose a bet", body: "Pick an exact number, a color, or a low/high range before submitting the wager." },
    { title: "Spin with VRF", body: "The contract maps the random word to one of 12 roulette slots." },
    { title: "Pay odds", body: "Exact numbers pay 12x gross; color and range bets pay 2x gross." }
  ],
  "scratch-card": [
    { title: "Start the reveal", body: "Scratch Card has no player-side hidden choice, so the wager only starts the reveal." },
    { title: "Draw a tier", body: "VRF maps the random word to a prize tier with a fixed payout table." },
    { title: "Settle prize", body: "Winning tiers pay from 2x to 30x gross before the vault edge is applied." }
  ],
  "rock-paper-scissors": [
    { title: "Choose a move", body: "Pick rock, paper, or scissors and lock that move into the transaction." },
    { title: "House move", body: "VRF picks the house move; ties are resolved into a non-tie path inside the contract." },
    { title: "Compare", body: "A winning move pays 2x gross. A losing move settles as a loss." }
  ],
  slots: [
    { title: "Start the spin", body: "Slots has no hidden player choice; the transaction starts a three-reel VRF spin." },
    { title: "Draw reels", body: "The contract maps the random word to three symbols after the bet is confirmed." },
    { title: "Match symbols", body: "Pairs pay 1.45x gross, triples pay 12x gross, and the top triple pays 25x gross." }
  ]
};

export function HowItWorks({ gameId }: { gameId: string }) {
  const [open, setOpen] = useState(false);
  const steps = GAME_STEPS[gameId] ?? [];

  useEffect(() => {
    setOpen(window.matchMedia("(min-width: 768px)").matches);
  }, [gameId]);

  if (steps.length === 0) return null;

  const icons = [Dice5, RadioTower, CircleDollarSign];

  return (
    <details className="how-panel panel p-0" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
        <div>
          <h2 className="display-heading text-lg font-bold text-[var(--text-1)]">How it works</h2>
          <p className="mt-1 text-xs text-[var(--text-3)]">Bet, verify, settle. No hidden result path.</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-2)]">
          <ChevronDown size={18} className="how-chevron text-[var(--text-3)]" />
        </span>
      </summary>
      <ol className="how-steps border-t border-[var(--border)]">
        {steps.map((step, index) => (
          <li key={step.title} className="how-step grid gap-3 px-4 py-4 md:grid-cols-[44px_1fr] md:items-start">
            <span className="how-step-icon">
              {index + 1}
            </span>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--text-1)]">
                {(() => {
                  const Icon = icons[index] ?? Dice5;
                  return <Icon size={15} className="text-[var(--accent)]" />;
                })()}
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="how-more">
        <span>Still have questions?</span>
        <Link href="/docs?section=faq">Open the player Q&amp;A</Link>
      </div>
    </details>
  );
}
