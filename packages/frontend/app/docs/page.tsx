import Link from "next/link";
import { BookOpen, CircleDollarSign, Radio, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { SITE_UPDATES } from "@/lib/updates";

const roundSteps = [
  {
    title: "Choose a game",
    body: "Pick any active game from the library. Each game shows recent activity and the core options needed before you play."
  },
  {
    title: "Place a bet",
    body: "Connect your wallet, choose the game options, and confirm the wager transaction. The bet is submitted on-chain."
  },
  {
    title: "Wait for verification",
    body: "After the transaction confirms, the game waits for verifiable randomness. The round status card shows the transaction, request ID, and final settlement link when it is available."
  },
  {
    title: "See the result",
    body: "The contract settles the round. The screen shows win or loss, and the result appears in the live feed after it is indexed. If settlement is delayed, the connected profile and wallet menu show the pending round and refund action. Refunds are separate transactions and do not run a new VRF result."
  }
];

const playerNotes = [
  {
    icon: <ShieldCheck size={20} />,
    title: "Fair results",
    body: "Results are settled by contracts using Chainlink VRF on Base. The UI does not decide whether a player wins or loses."
  },
  {
    icon: <CircleDollarSign size={20} />,
    title: "Clear payouts",
    body: "Wagers are shown in ETH with a lightweight USD reference where it helps. Bet presets are quick buttons, while the contract enforces the minimum and maximum bet."
  },
  {
    icon: <Sparkles size={20} />,
    title: "XP and streaks",
    body: "Settled rounds grant XP. Playing on active days builds your daily streak and helps your leaderboard position."
  },
  {
    icon: <Radio size={20} />,
    title: "Fast activity views",
    body: "Live feed, profile stats, and leaderboard data are indexed from settled rounds, cached briefly, and refreshed in the background."
  }
];

const safetyNotes = [
  "Only confirm transactions you understand in your wallet.",
  "Small games can still lose real ETH. Play with amounts you are comfortable risking.",
  "A pending round may take time while the transaction and randomness settle.",
  "The Chainlink VRF button shows the request ID and the Basescan transaction link used to verify the round.",
  "If a round is delayed beyond the contract window, the refund action appears in the connected wallet menu and your profile page.",
  "Claiming a refund only returns the locked bet. It does not create a new random result."
];

export default function DocsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-7 border-b border-[var(--border)] pb-6">
        <div>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--border-2)] bg-[var(--accent-light)] text-[var(--accent)]">
            <BookOpen size={22} />
          </div>
          <h1 className="display-heading text-4xl font-bold text-[var(--text-1)]">Docs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-2)]">
            A player guide for BasePlay: how rounds work, how payouts are shown, how XP is earned, and what to check before playing.
          </p>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        {playerNotes.map((item) => (
          <InfoCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
        ))}
      </section>

      <section className="mt-4 panel p-4">
        <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">How a round works</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {roundSteps.map((item, index) => (
            <div key={item.title} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <div className="font-mono text-[11px] font-bold uppercase text-[var(--accent)]">Step {index + 1}</div>
              <h3 className="mt-2 font-bold text-[var(--text-1)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 panel p-4">
        <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Games</h2>
        <div className="mt-4 grid gap-2">
          {GAMES_REGISTRY.map((game) => (
            <Link key={game.id} href={game.path} className="grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 hover:border-[var(--accent)] md:grid-cols-[1fr_120px_120px] md:items-center">
              <div>
                <div className="font-bold text-[var(--text-1)]">{game.name}</div>
                <p className="mt-1 text-sm leading-5 text-[var(--text-2)]">{game.description}</p>
              </div>
              <Metric label="Max payout" value={`${game.maxMultiplier}x`} />
              <Metric label="Edge" value="3%" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="panel p-4">
          <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Wallet and results</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoCard icon={<WalletCards size={18} />} title="Wallet connection" body="Your connected wallet is your player identity. It is used for bets, results, XP, and leaderboard display." />
            <InfoCard icon={<Radio size={18} />} title="Live feed" body="Game pages show the latest results for that game. The full live feed page shows recent activity across games." />
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Before playing</h2>
          <div className="mt-4 grid gap-2">
            {safetyNotes.map((item) => (
              <div key={item} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--text-2)]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="panel p-4">
          <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">XP and leaderboard</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
            XP rewards regular play, while leaderboard profit shows net game performance. You can compare players by XP or net profit depending on what you care about.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <DocLink href="/leaderboard" label="Open leaderboard" />
            <DocLink href="/live-feed" label="Open live feed" />
          </div>
        </div>

        <div className="panel p-4">
          <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Latest updates</h2>
          {SITE_UPDATES.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {SITE_UPDATES.slice(0, 3).map((update) => (
                <Link key={update.title} href="/updates" className="footer-update">
                  <span className="font-mono text-[10px] text-[var(--text-3)]">{update.date}</span>
                  <span className="mt-1 block font-bold text-[var(--text-1)]">{update.title}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
              Public release notes will appear after production launch.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="doc-summary">
      <div className="text-[var(--accent)]">{icon}</div>
      <h2 className="mt-3 display-heading text-lg font-bold text-[var(--text-1)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-bold uppercase text-[var(--text-3)]">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold text-[var(--text-1)]">{value}</div>
    </div>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-sm font-semibold text-[var(--text-1)] hover:border-[var(--accent)]">
      {label}
    </Link>
  );
}
