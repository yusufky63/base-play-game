import Link from "next/link";
import {
  BadgeDollarSign,
  Bomb,
  Boxes,
  Cherry,
  CircleDot,
  Coins,
  Dice5,
  Gem,
  Goal,
  Gauge,
  Orbit,
  Palette,
  Pickaxe,
  Radar,
  Scissors,
  ScrollText,
  Swords,
  TrendingUp,
  type LucideIcon
} from "lucide-react";
import { getGame } from "@baseplay/shared/config/games.registry";

type GameIconSize = "xs" | "sm" | "md" | "lg";

const GAME_VISUALS: Record<string, { Icon: LucideIcon; label: string }> = {
  "coin-flip": { Icon: Coins, label: "Coin Flip" },
  dice: { Icon: Dice5, label: "Dice" },
  crash: { Icon: TrendingUp, label: "Crash" },
  mines: { Icon: Bomb, label: "Mines" },
  hilo: { Icon: Boxes, label: "Hi-Lo" },
  "over-under": { Icon: Gauge, label: "Over / Under" },
  limbo: { Icon: Goal, label: "Limbo" },
  wheel: { Icon: Orbit, label: "Wheel" },
  "plinko-lite": { Icon: Pickaxe, label: "Plinko Lite" },
  "color-pick": { Icon: Palette, label: "Color Pick" },
  "treasure-chest": { Icon: Gem, label: "Treasure Chest" },
  "lucky-seven": { Icon: BadgeDollarSign, label: "Lucky Seven" },
  "roulette-lite": { Icon: Radar, label: "Roulette Lite" },
  "scratch-card": { Icon: ScrollText, label: "Scratch Card" },
  "rock-paper-scissors": { Icon: Scissors, label: "Rock Paper Scissors" },
  slots: { Icon: Cherry, label: "Slots" },
  pvp: { Icon: Swords, label: "PvP Arena" }
};

export function getGameLabel(gameId: string) {
  return getGame(gameId)?.name ?? GAME_VISUALS[gameId]?.label ?? gameId;
}

export function getGamePath(gameId: string) {
  return getGame(gameId)?.path ?? `/games/${gameId}`;
}

export function GameIcon({ gameId, size = "md", className = "" }: { gameId: string; size?: GameIconSize; className?: string }) {
  const Icon = GAME_VISUALS[gameId]?.Icon ?? CircleDot;
  return (
    <span className={`game-icon-box game-icon-${gameId} game-icon-size-${size} ${className}`} aria-hidden="true">
      <Icon strokeWidth={2.15} />
    </span>
  );
}

export function GameIdentity({
  gameId,
  label,
  detail,
  href,
  size = "sm",
  className = ""
}: {
  gameId: string;
  label?: string;
  detail?: string;
  href?: string;
  size?: GameIconSize;
  className?: string;
}) {
  const content = (
    <>
      <GameIcon gameId={gameId} size={size} />
      <span className="game-identity-copy">
        <strong>{label ?? getGameLabel(gameId)}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`game-identity ${className}`}>
        {content}
      </Link>
    );
  }

  return <span className={`game-identity ${className}`}>{content}</span>;
}
