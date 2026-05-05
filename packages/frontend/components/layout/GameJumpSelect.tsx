"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, Gamepad2 } from "lucide-react";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";

export function GameJumpSelect() {
  const router = useRouter();

  return (
    <div className="relative hidden md:block">
      <Gamepad2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--accent)]" />
      <select
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) router.push(event.target.value);
        }}
        className="app-select"
        aria-label="Open game"
      >
        <option value="">Select game</option>
        {GAMES_REGISTRY.map((game) => (
          <option key={game.id} value={game.path} disabled={!game.active}>
            {game.name}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
    </div>
  );
}
