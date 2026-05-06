import Link from "next/link";
import { BookOpen, CircleDollarSign, ExternalLink, HelpCircle, Radio, RotateCcw, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { NETWORKS } from "@baseplay/shared/config/networks";
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
    body: "Settled rounds grant XP mainly from wager size, not from winning luck. Playing on active days builds your daily streak."
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

const refundNotes = [
  "Refunds are only possible when the contract still has an unresolved active round for your wallet.",
  "The claim button appears after the contract timeout block has fully passed. The UI does not show it one block early.",
  "You can close the tab. After reconnecting the same wallet, BasePlay scans active rounds and shows the refund in the wallet menu and your profile page.",
  "Claim refund is a normal wallet transaction. It returns the locked wager and releases the reserved payout from the vault.",
  "If the round settles before the timeout, there is no refund because the game already produced its on-chain result."
];

const faqs = [
  {
    question: "Does the website decide whether I win?",
    answer: "No. The UI only sends your locked choices to the contract. The contract requests Chainlink VRF and settles from the returned random word."
  },
  {
    question: "Can I change my choice after pressing Play?",
    answer: "No. The game options are encoded into the transaction before the VRF request starts. After signing, the choice is fixed on-chain."
  },
  {
    question: "Where can I verify a round?",
    answer: "Open the Chainlink VRF button on a game page. It shows the request ID, the wager transaction, and the settlement transaction when available."
  },
  {
    question: "Why can a round be pending?",
    answer: "The wager transaction can confirm before the VRF callback arrives. During that window the round is locked, and the pending/refund panel tracks it."
  },
  {
    question: "What happens if VRF takes too long?",
    answer: "After the timeout block window fully passes, the same wallet can claim a refund from the game contract. Refund does not trigger a new VRF request."
  },
  {
    question: "If I close the tab, do I lose the refund button?",
    answer: "No. The refund state lives on-chain. Reconnect the same wallet and check the wallet menu or Profile page to see unresolved rounds."
  },
  {
    question: "How is XP calculated?",
    answer: "XP is based on the settled wager amount. Wins and losses at the same bet size earn the same XP, so XP represents play volume rather than lucky outcomes."
  },
  {
    question: "Why are XP and net profit separate rankings?",
    answer: "XP rewards activity. Net profit ranks actual game performance after wins, losses, and payouts. A high-XP player is active, not necessarily profitable."
  },
  {
    question: "What does gross payout mean?",
    answer: "Game pages show the gross multiplier from the game rule. The vault applies the configured house edge before sending the final net payout."
  },
  {
    question: "Can direct contract calls cheat the games?",
    answer: "Direct calls use the same contract validation as the UI. Invalid params revert, active rounds are limited, and the vault reserves max payout before randomness is requested."
  },
  {
    question: "Can bots predict the result?",
    answer: "Bots can submit transactions like any wallet, but they cannot know the VRF result before the contract receives it. Rate limits and max bet controls reduce spam and vault risk."
  },
  {
    question: "Why is Scratch Card one ticket?",
    answer: "Scratch Card has no player-side choice. One bet creates one VRF-backed prize tier, so the UI presents it as a single reveal ticket."
  },
  {
    question: "Why can a payout still be a net loss?",
    answer: "Some games can land below 1x gross, such as low Plinko slots. That is a payout segment, but it can still be less than the wager and therefore a net loss."
  },
  {
    question: "What should I check before playing?",
    answer: "Check the connected wallet, selected Base network, bet amount, and the game options. BasePlay also checks network and wallet balance before sending the wager."
  }
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
        <div className="flex items-start gap-3">
          <div className="mt-1 text-[var(--accent)]"><RotateCcw size={20} /></div>
          <div>
            <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Pending rounds and refunds</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
              Refunds are a fallback for unresolved VRF rounds. They are tracked from the contract, so they survive refreshes and closed tabs.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {refundNotes.map((item) => (
            <div key={item} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--text-2)]">
              {item}
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

      <section className="mt-4 panel p-4">
        <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Public contracts</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          Game and vault contracts are public. Use the explorer links to inspect transactions, events, code, and balances.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {Object.values(NETWORKS).map((network) => (
            <div key={network.chainId} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <h3 className="font-bold text-[var(--text-1)]">{network.name}</h3>
                <a href={network.blockExplorer} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
                  Explorer <ExternalLink size={12} />
                </a>
              </div>
              <div className="grid gap-2">
                <ContractDocRow label="GameVault" address={CONTRACT_ADDRESSES[network.chainId]?.GameVault} explorer={network.blockExplorer} />
                {GAMES_REGISTRY.filter((game) => game.active && game.chains.includes(network.chainId === 8453 ? "baseMainnet" : "baseSepolia")).map((game) => (
                  <ContractDocRow key={`${network.chainId}-${game.id}`} label={game.name} address={CONTRACT_ADDRESSES[network.chainId]?.[game.contractName]} explorer={network.blockExplorer} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="panel p-4">
          <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Wallet and results</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoCard icon={<WalletCards size={18} />} title="Wallet connection" body="Your connected wallet is your player identity. Base-compatible wallet connectors are bundled with the app and are used for bets, results, XP, and leaderboard display." />
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
            XP rewards regular play volume and scales with wager size. Wins do not add a separate XP bonus. Leaderboard profit stays separate so you can compare actual net game performance.
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

      <section className="mt-4 panel p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-[var(--accent)]"><HelpCircle size={20} /></div>
          <div>
            <h2 className="display-heading text-xl font-bold text-[var(--text-1)]">Questions and answers</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
              Common questions about game logic, randomness, refunds, XP, payouts, and account tracking.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {faqs.map((item) => (
            <details key={item.question} className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <summary className="cursor-pointer list-none font-bold text-[var(--text-1)]">{item.question}</summary>
              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{item.answer}</p>
            </details>
          ))}
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

function ContractDocRow({ label, address, explorer }: { label: string; address?: string; explorer: string }) {
  return (
    <div className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm md:grid-cols-[130px_1fr_auto] md:items-center">
      <span className="font-bold text-[var(--text-1)]">{label}</span>
      <code className="break-all font-mono text-[11px] text-[var(--text-2)]">{address ?? "Not deployed"}</code>
      {address && (
        <a href={`${explorer}/address/${address}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-[var(--accent)]">
          View <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}
