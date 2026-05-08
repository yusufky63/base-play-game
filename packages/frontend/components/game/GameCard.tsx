import type { GameConfig } from "@baseplay/shared/types/game.types";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { GameIcon } from "@/components/game/GameIdentity";

const gameStyles: Record<string, { label: string; tone: string }> = {
  crash: { label: "Live cashout", tone: "hot" },
  mines: { label: "Risk path", tone: "tactical" },
  hilo: { label: "Decision streak", tone: "tactical" },
  "plinko-lite": { label: "Drop & reveal", tone: "arcade" },
  slots: { label: "Spin reveal", tone: "arcade" },
  wheel: { label: "Wheel spin", tone: "arcade" },
  "scratch-card": { label: "Prize reveal", tone: "prize" },
  "treasure-chest": { label: "Pick & reveal", tone: "prize" },
  "roulette-lite": { label: "Table pick", tone: "arcade" },
  dice: { label: "Number pick", tone: "classic" },
  "coin-flip": { label: "Fast choice", tone: "classic" },
  "over-under": { label: "Threshold pick", tone: "classic" },
  limbo: { label: "Target multiplier", tone: "classic" },
  "color-pick": { label: "Color reveal", tone: "classic" },
  "lucky-seven": { label: "Dice table", tone: "classic" },
  "rock-paper-scissors": { label: "Move pick", tone: "classic" }
};

export function GameCard({ game }: { game: GameConfig }) {
  const style = gameStyles[game.id] ?? { label: "VRF reveal", tone: "classic" };

  return (
    <Link
      href={game.active ? game.path : "#"}
      aria-disabled={!game.active}
      className={`game-card game-card-compact group grid gap-4 p-4 transition-all duration-150 ${
        game.active ? "hover:-translate-y-0.5" : "cursor-not-allowed opacity-45"
      }`}
    >
      <div className="game-card-top">
        <div className="game-card-icon-wrap">
          <GameIcon gameId={game.id} size="lg" />
        </div>
        <span className={`game-card-style game-card-style-${style.tone}`}>{style.label}</span>
      </div>

      <div className="game-card-body min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="display-heading truncate text-lg font-bold text-[var(--text-1)]">{game.name}</h2>
          {!game.active && <span className="rounded-md border border-[var(--border-2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-3)]">Soon</span>}
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[var(--text-2)]">{game.description}</p>
      </div>

      <div className="game-card-footer">
        <span>{game.maxMultiplier}x max</span>
        {game.active && (
          <span className="game-card-play-button">
            Play Now
            <ArrowUpRight size={15} />
          </span>
        )}
      </div>
    </Link>
  );
}
