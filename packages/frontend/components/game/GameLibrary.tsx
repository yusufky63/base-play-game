"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { GameConfig } from "@baseplay/shared/types/game.types";
import { GameCard } from "@/components/game/GameCard";
import { useGameStats } from "@/hooks/useGlobalStats";

const CATEGORY_FILTERS = [
  { id: "all", label: "All", tags: [] },
  { id: "quick", label: "Quick", tags: ["simple", "fast", "casual"] },
  { id: "strategy", label: "Strategy", tags: ["strategy"] },
  { id: "arcade", label: "Arcade", tags: ["arcade", "spin", "drop"] },
  { id: "jackpot", label: "Jackpot", tags: ["jackpot", "risk", "odds", "dice"] }
] as const;

export function GameLibrary({ games }: { games: GameConfig[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { gameCounts } = useGameStats();
  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const activeFilter = CATEGORY_FILTERS.find((item) => item.id === category) ?? CATEGORY_FILTERS[0];
    return games.filter((game) => {
      const matchesCategory = activeFilter.id === "all" || activeFilter.tags.some((tag) => game.tags.includes(tag));
      const matchesQuery =
        normalizedQuery.length === 0 ||
        game.name.toLowerCase().includes(normalizedQuery) ||
        game.description.toLowerCase().includes(normalizedQuery) ||
        game.tags.some((tag) => tag.includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [category, games, query]);

  return (
    <div className="space-y-3">
      <div className="game-library-toolbar">
        <label className="game-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games"
            aria-label="Search games"
          />
        </label>
        <div className="game-category-strip" aria-label="Filter games by category">
          {CATEGORY_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={category === item.id ? "game-category-active" : ""}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="game-result-count">{filteredGames.length} shown</span>
      </div>

      <div className="game-library-grid">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} playCount={gameCounts[game.id] ?? 0} />
        ))}
        {filteredGames.length === 0 && (
          <div className="panel p-6 text-sm text-[var(--text-3)]">
            No games match this search.
          </div>
        )}
      </div>
    </div>
  );
}
