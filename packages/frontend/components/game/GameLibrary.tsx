"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import type { GameConfig } from "@baseplay/shared/types/game.types";
import { GameCard } from "@/components/game/GameCard";

const CATEGORY_FILTERS = [
  { id: "all", label: "All games", tags: [] },
  { id: "instant", label: "Instant", tags: ["simple", "fast", "casual"] },
  { id: "decisions", label: "Decisions", tags: ["strategy", "risk", "odds"] },
  { id: "arcade", label: "Arcade", tags: ["arcade", "spin", "drop"] },
  { id: "big-win", label: "Big wins", tags: ["jackpot", "risk", "odds", "dice"] }
] as const;

export function GameLibrary({ games }: { games: GameConfig[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
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
  const categoryCounts = useMemo(() => {
    return Object.fromEntries(
      CATEGORY_FILTERS.map((item) => [
        item.id,
        games.filter((game) => item.id === "all" || item.tags.some((tag) => game.tags.includes(tag))).length
      ])
    );
  }, [games]);
  return (
    <div className="game-library-shell">
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
              <span>{item.label}</span>
              <small>{categoryCounts[item.id]}</small>
            </button>
          ))}
        </div>
        <span className="game-result-count">
          <SlidersHorizontal size={13} />
          {filteredGames.length} shown
        </span>
      </div>

      <div className="game-library-grid">
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
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
