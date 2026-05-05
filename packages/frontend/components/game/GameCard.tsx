import type { GameConfig } from "@baseplay/shared/types/game.types";
import { ArrowUpRight, BadgeDollarSign, Bomb, Boxes, Cherry, CircleDot, Coins, Dice5, Gem, Goal, Gauge, Orbit, Palette, Pickaxe, Radar, Scissors, ScrollText, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";

export function GameCard({ game, playCount = 0 }: { game: GameConfig; playCount?: number }) {
  return (
    <Link
      href={game.active ? game.path : "#"}
      aria-disabled={!game.active}
      className={`game-card game-card-compact group grid gap-3 p-3.5 transition-all duration-150 ${
        game.active ? "hover:-translate-y-0.5" : "cursor-not-allowed opacity-45"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`game-icon-box game-icon-${game.id}`}>
          <GameGlyph id={game.id} />
        </div>
        <span className="rounded-md border border-[var(--border-2)] bg-[var(--surface-2)] px-2 py-1 font-mono text-[11px] text-[var(--text-1)]">{game.maxMultiplier}x</span>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="display-heading truncate text-lg font-bold text-[var(--text-1)]">{game.name}</h2>
          {!game.active && <span className="rounded-md border border-[var(--border-2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-3)]">Soon</span>}
        </div>
        <p className="line-clamp-2 text-[13px] leading-5 text-[var(--text-2)]">{game.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {game.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--text-2)]">
              {tag}
            </span>
          ))}
          <span className="rounded-md border border-[var(--border-2)] bg-[var(--surface)] px-2 py-1 font-mono text-[10px] font-semibold uppercase text-[var(--text-2)] md:hidden">
            {formatCount(playCount)} played
          </span>
        </div>
      </div>

      <div className="game-card-stats">
        <Meta label="Payout" value={`${game.maxMultiplier}x`} />
        <Meta label="Edge" value="3%" />
        <Meta label="Played" value={formatCount(playCount)} />
      </div>

      <div className="flex items-center justify-end gap-3">
        {game.active && (
          <span className="play-button-ghost flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-bold">
            Play Now
            <ArrowUpRight size={15} />
          </span>
        )}
      </div>
    </Link>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function GameGlyph({ id }: { id: string }) {
  const glyphs: Record<string, LucideIcon> = {
    "coin-flip": Coins,
    dice: Dice5,
    crash: TrendingUp,
    mines: Bomb,
    hilo: Boxes,
    "over-under": Gauge,
    limbo: Goal,
    wheel: Orbit,
    "plinko-lite": Pickaxe,
    "color-pick": Palette,
    "treasure-chest": Gem,
    "lucky-seven": BadgeDollarSign,
    "roulette-lite": Radar,
    "scratch-card": ScrollText,
    "rock-paper-scissors": Scissors,
    slots: Cherry
  };
  const Icon = glyphs[id] ?? CircleDot;

  return <Icon size={34} strokeWidth={2.2} aria-hidden="true" />;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-meta">
      <div className="text-[10px] font-semibold uppercase text-[var(--text-3)]">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-[var(--text-1)]">{value}</div>
    </div>
  );
}
