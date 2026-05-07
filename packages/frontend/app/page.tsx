import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { GameLibrary } from "@/components/game/GameLibrary";
import { NetworkStatusPanel } from "@/components/home/NetworkStatusPanel";

const activeCount = GAMES_REGISTRY.filter((game) => game.active).length;

export default function HomePage() {
  return (
    <main className="w-full">
      <section className="home-hero-section relative overflow-hidden border-b border-[var(--border)] px-4 py-7 md:py-9">
        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1fr_390px] lg:items-center">
          <div className="space-y-5">
            <h1 className="hero-title-3d display-heading max-w-3xl text-5xl font-bold leading-[0.95] text-[var(--text-1)] md:text-7xl">
              <span className="base-blue">Base</span>Play
            </h1>
            <p className="display-heading text-xl font-bold uppercase text-[var(--text-1)] md:text-2xl">
              On-chain. Fair. Verifiable.
            </p>
            <p className="max-w-2xl text-base leading-7 text-[var(--text-2)]">
              Mini games. Real stakes. On Base.
            </p>
          </div>

          <div>
            <NetworkStatusPanel activeCount={activeCount} />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 w-full max-w-7xl px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display-heading text-2xl font-bold text-[var(--text-1)]">Games</h2>
          <span className="font-mono text-xs text-[var(--text-3)]">{activeCount} / {GAMES_REGISTRY.length} active</span>
        </div>
        <GameLibrary games={GAMES_REGISTRY} />
      </section>
    </main>
  );
}
