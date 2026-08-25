"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { 
  BadgeCheck, 
  BookOpen, 
  CircleDollarSign, 
  ExternalLink, 
  Gift, 
  HelpCircle, 
  Radio, 
  RotateCcw, 
  Search, 
  ShieldCheck, 
  Sparkles, 
  Swords, 
  WalletCards,
  X 
} from "lucide-react";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { NETWORKS } from "@baseplay/shared/config/networks";
import { GameIdentity } from "@/components/game/GameIdentity";

const docNav = [
  { id: "essentials", label: "Essentials" },
  { id: "pvp", label: "PvP Arena" },
  { id: "rounds", label: "Round flow" },
  { id: "refunds", label: "Refunds" },
  { id: "games", label: "Games" },
  { id: "contracts", label: "Contracts" },
  { id: "account", label: "Account" },
  { id: "rewards", label: "Rewards" },
  { id: "faq", label: "Q&A" }
] as const;

type DocSectionId = (typeof docNav)[number]["id"];

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
    body: "The contract settles the round. The screen shows win or loss, and the result appears in the live feed after it is indexed. Feed rows open a round detail view with the VRF request, transaction links, and indexed event timeline. If settlement is delayed, the connected profile and wallet menu show the pending round and refund action."
  }
];

const pvpSteps = [
  {
    title: "Create or Join a Duel Room",
    body: "The host selects Heads or Tails, enters the bet amount, and opens a room on Base Mainnet. Challengers can browse open rooms in the lobby or join directly via an invite link."
  },
  {
    title: "Opposing Side Assignment",
    body: "The challenger automatically takes the opposite side (e.g. if the Host selected Heads, the Challenger fights for Tails). Both players wager identical ETH into the contract escrow."
  },
  {
    title: "Provably Fair VRF Resolution",
    body: "Once the challenger matches the room, Chainlink VRF v2.5 generates the random seed on Base Mainnet. The winner receives 98% of the pot (2% platform rake)."
  },
  {
    title: "Timeout & Cancellation Protection",
    body: "Open rooms can be cancelled by the host at any time before a challenger joins. If VRF resolution exceeds 60 blocks, either player can claim a full refund via claimTimeout()."
  }
];

const playerNotes = [
  {
    icon: <ShieldCheck size={18} />,
    title: "Fair results",
    body: "Results are settled by contracts using Chainlink VRF on Base. The UI does not decide whether a player wins or loses."
  },
  {
    icon: <CircleDollarSign size={18} />,
    title: "Clear payouts",
    body: "Wagers and profile profit rows are shown in ETH with a lightweight USD reference where it helps. Quick bet buttons start at 0.000115 ETH, and the contract enforces active minimum and maximum bet limits."
  },
  {
    icon: <Sparkles size={18} />,
    title: "XP and streaks",
    body: "Settled rounds grant XP mainly from wager size, not from winning luck. Playing on active days builds your daily streak."
  },
  {
    icon: <Radio size={18} />,
    title: "Fast activity views",
    body: "Live feed, profile tabs, leaderboard data, Home stats, and round detail timelines are indexed from Base mainnet events and cached by view importance instead of polling every few seconds."
  },
  {
    icon: <Sparkles size={18} />,
    title: "Clean Home hero",
    body: "The Home hero uses a static full-width band without an animated Pixel Blast background, while tabs, game cards, round status panels, contract panels, buttons, filters, and mobile help sections stay compact."
  }
];

const safetyNotes = [
  "Only confirm transactions you understand in your wallet.",
  "Current quick bet buttons are 0.000115 ETH, 0.00023 ETH, and 0.0005 ETH on supported game pages.",
  "Small games can still lose real ETH. Play with amounts you are comfortable risking.",
  "A pending round may take time while the transaction and randomness settle.",
  "The Chainlink VRF button shows the request ID and the Basescan transaction link used to verify the round.",
  "If Play is disabled, the game is temporarily closed or the bankroll is being topped up.",
  "If a round is delayed beyond the contract window, the refund action appears in the connected wallet menu and your profile page.",
  "Claiming a refund only returns the locked bet. It does not create a new random result."
];

const rewardNotes = [
  {
    icon: <Sparkles size={18} />,
    title: "XP",
    body: "Settled rounds grant XP from wager size. Quest rewards are intentionally smaller than the main round activity curve, and referral XP stays capped and cosmetic."
  },
  {
    icon: <Gift size={18} />,
    title: "Daily and weekly quests",
    body: "Quests reward player activity such as round counts, wins, game variety, and daily streaks. The Quests page features a sleek card layout with distinct glowing green completed states."
  },
  {
    icon: <BadgeCheck size={18} />,
    title: "Badges and on-chain NFT claim",
    body: "Badges represent major progression milestones across game tiers, win streaks, and quests. Earned badges can be claimed as on-chain ERC-1155 NFTs directly on Base via the BasePlayBadges contract (0x1Ca9E82eBA7967295C3D77404af639B592C268eD)."
  },
  {
    icon: <Radio size={18} />,
    title: "Referrals",
    body: "Referral links award small capped XP to the referrer after referred players settle rounds. Referral never pays ETH and never touches the vault."
  },
  {
    icon: <RotateCcw size={18} />,
    title: "Lucky Draw",
    body: "Players qualify for Lucky Draw spins through gameplay activity and streaks. Rewards are promotional prizes provided by the platform treasury."
  }
];

const faqs = [
  {
    question: "How do I know the game is fair?",
    answer: "Every single-player and PvP round requests a random seed from Chainlink VRF v2.5 directly on Base Mainnet. The contract cannot alter the outcome after your transaction is confirmed."
  },
  {
    question: "How does PvP Arena work?",
    answer: "PvP Arena is 100% peer-to-peer. Host and challenger lock identical ETH bets in the contract escrow. Chainlink VRF determines the winner, who receives 98% of the pot (2% platform rake). The house has zero bankroll risk."
  },
  {
    question: "What happens if a PvP duel is not matched or VRF is delayed?",
    answer: "You can cancel your open room at any time before a challenger joins for a 100% refund. If VRF callback takes longer than 60 blocks, either player can call claimTimeout() to receive a full refund."
  },
  {
    question: "Can I share my win on Twitter / X?",
    answer: "Yes! Every victory enables the 'Share Win Card' modal, which generates a high-resolution 1200x630 card with your personal referral QR code, instant image copy for Twitter (Ctrl+V), and download support."
  },
  {
    question: "What happens if a round is delayed?",
    answer: "If Chainlink VRF is delayed beyond the contract window, a refund button appears in your profile and wallet menu to recover your locked wager."
  }
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSectionId>("essentials");
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();

    const matchedGames = GAMES_REGISTRY.filter((g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
    const matchedFaqs = faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
    const matchedNotes = [...playerNotes, ...rewardNotes].filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));

    return {
      games: matchedGames,
      faqs: matchedFaqs,
      notes: matchedNotes
    };
  }, [searchQuery]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="docs-hero">
        <div className="docs-kicker">
          <BookOpen size={14} /> Documentation
        </div>
        <h1 className="display-heading text-3xl font-extrabold text-[var(--text-1)]">Player documentation</h1>
        <p>
          Everything you need to know about fair play, Chainlink VRF settlement, PvP Arena, refunds, games, contracts, and progression on Base.
        </p>

        {/* Real-time Search Bar */}
        <div className="relative w-full max-w-md mt-5">
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-[var(--text-3)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics, rules, PvP, VRF, FAQs..."
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-[var(--text-3)] hover:text-[var(--text-1)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <nav>
            {docNav.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => {
                  setActiveSection(item.id);
                  setSearchQuery("");
                }}
                className={`docs-nav-link ${activeSection === item.id && !searchQuery ? "docs-nav-link-active" : ""}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="docs-article">
          {/* Search Results Display */}
          {searchResults ? (
            <section className="docs-block">
              <SectionHeading eyebrow="Search Results" title={`Matches for "${searchQuery}"`} />

              {searchResults.games.length === 0 && searchResults.faqs.length === 0 && searchResults.notes.length === 0 ? (
                <p className="text-xs text-[var(--text-3)]">No matching documentation topics found. Try another search term.</p>
              ) : (
                <div className="space-y-6">
                  {searchResults.games.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-1)] mb-3">Games</h3>
                      <div className="docs-game-list">
                        {searchResults.games.map((game) => (
                          <Link key={game.id} href={game.path} className="docs-game-row">
                            <div>
                              <GameIdentity gameId={game.id} label={game.name} size="sm" />
                              <p>{game.description}</p>
                            </div>
                            <Metric label="Max payout" value={`${game.maxMultiplier}x`} />
                            <Metric label="Edge" value={game.id === "pvp" ? "2% Rake" : "5%"} />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.notes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-1)] mb-3">Topics & Concepts</h3>
                      <div className="docs-feature-list">
                        {searchResults.notes.map((item) => (
                          <InfoCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.faqs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-1)] mb-3">Questions & Answers</h3>
                      <div className="docs-faq-list">
                        {searchResults.faqs.map((item) => (
                          <details key={item.question} className="docs-faq-item" open>
                            <summary>{item.question}</summary>
                            <p>{item.answer}</p>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Section 1: Essentials */}
              <section id="essentials" className="docs-block">
                <SectionHeading eyebrow="Core concepts" title="Essentials" icon={<BookOpen size={18} />} />
                <p className="docs-lede">
                  BasePlay is a provably fair gaming protocol on Base. Wagers, game logic, and payouts are settled by smart contracts using Chainlink VRF.
                </p>
                <div className="docs-feature-list">
                  {playerNotes.map((item) => (
                    <InfoCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
                  ))}
                </div>
              </section>

              {/* Section 2: PvP Arena */}
              <section id="pvp" className="docs-block">
                <SectionHeading eyebrow="Peer to Peer" title="PvP 1v1 Arena" icon={<Swords size={18} />} />
                <p className="docs-lede">
                  PvP Arena lets two players duel 1v1 on Base Mainnet. Both players deposit matching ETH into the PvPArena smart contract escrow, and Chainlink VRF v2.5 delivers the provably fair random seed.
                </p>

                <ol className="docs-step-list">
                  {pvpSteps.map((step) => (
                    <li key={step.title}>
                      <span />
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="docs-grid-two mt-6">
                  <div>
                    <h3>Economic Model & 2% Rake</h3>
                    <p>
                      PvP Arena is -EV neutral to the platform bankroll. The winner receives <strong>98% of the total pot</strong> (1.96x payout), with a 2% platform rake sent to the protocol treasury to maintain VRF gas subscriptions.
                    </p>
                  </div>
                  <div>
                    <h3>Timeout & Refund Protection</h3>
                    <p>
                      If an open room is not challenged, the host can cancel anytime. If VRF resolution is delayed past 60 blocks, either player can call <code className="text-[var(--text-1)] font-mono">claimTimeout(roomId)</code> for a 100% full refund.
                    </p>
                  </div>
                </div>

                <div className="docs-link-row mt-4">
                  <DocLink href="/games/pvp" label="Enter PvP Arena" />
                  <DocLink href="https://basescan.org/address/0x0965A9ACc1f300E60179057D7eEA20967731b8F5" label="View PvPArena on Basescan" />
                </div>
              </section>

              {/* Section 3: Round flow */}
              <section id="rounds" className="docs-block">
                <SectionHeading eyebrow="Flow" title="How a round works" />
                <ol className="docs-step-list">
                  {roundSteps.map((step) => (
                    <li key={step.title}>
                      <span />
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Section 4: Refunds */}
              <section id="refunds" className="docs-block">
                <SectionHeading eyebrow="Safety" title="Pending rounds and refunds" icon={<RotateCcw size={18} />} />
                <p className="docs-lede">
                  If Chainlink VRF randomness is delayed past the contract window, the refund action becomes active in your profile and connected wallet menu. Claiming a refund returns your original locked bet without house edge deductions.
                </p>
              </section>

              {/* Section 5: Games */}
              <section id="games" className="docs-block">
                <SectionHeading eyebrow="Library" title="Games" />
                <div className="docs-game-list">
                  {GAMES_REGISTRY.map((game) => (
                    <Link key={game.id} href={game.path} className="docs-game-row">
                      <div>
                        <GameIdentity gameId={game.id} label={game.name} size="sm" />
                        <p>{game.description}</p>
                      </div>
                      <Metric label="Max payout" value={`${game.maxMultiplier}x`} />
                      <Metric label="Edge" value={game.id === "pvp" ? "2% Rake" : "5%"} />
                    </Link>
                  ))}
                </div>
              </section>

              {/* Section 6: Contracts */}
              <section id="contracts" className="docs-block">
                <SectionHeading eyebrow="Public records" title="Public contracts" />
                <p className="docs-lede">
                  All game, vault, and PvP contracts are verified on Base Mainnet. Use the explorer links below to view live contract transactions, balances, and verified code.
                </p>
                <div className="docs-network-list">
                  {Object.values(NETWORKS).map((network) => (
                    <div key={network.chainId} className="docs-network">
                      <div className="docs-network-head">
                        <h3>{network.name}</h3>
                        <a href={network.blockExplorer} target="_blank" rel="noopener noreferrer">
                          Explorer <ExternalLink size={12} />
                        </a>
                      </div>
                      <div className="docs-contract-list">
                        <ContractDocRow label="GameVault" address={CONTRACT_ADDRESSES[network.chainId]?.GameVault} explorer={network.blockExplorer} />
                        <ContractDocRow label="PvPArena" address={CONTRACT_ADDRESSES[network.chainId]?.PvPArena} explorer={network.blockExplorer} gameId="pvp" />
                        {GAMES_REGISTRY.filter((game) => game.active && game.chains.includes("baseMainnet") && game.id !== "pvp").map((game) => (
                          <ContractDocRow key={`${network.chainId}-${game.id}`} label={game.name} gameId={game.id} address={CONTRACT_ADDRESSES[network.chainId]?.[game.contractName]} explorer={network.blockExplorer} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 7: Account */}
              <section id="account" className="docs-block">
                <SectionHeading eyebrow="Account" title="Wallet, stats, and safety" icon={<WalletCards size={18} />} />
                <div className="docs-grid-two">
                  <div>
                    <h3>Wallet and results</h3>
                    <p>
                      Your connected browser wallet or Coinbase Wallet session is your player identity through wagmi. Game pages show the latest results for that game, while the full live feed shows recent activity across games.
                    </p>
                    <div className="docs-link-row">
                      <DocLink href="/leaderboard" label="Open leaderboard" />
                      <DocLink href="/live-feed" label="Open live feed" />
                    </div>
                  </div>
                  <div>
                    <h3>Before playing</h3>
                    <ul className="docs-note-list docs-note-list-compact">
                      {safetyNotes.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {/* Section 8: Rewards */}
              <section id="rewards" className="docs-block">
                <SectionHeading eyebrow="Progression" title="XP, quests, badges, referrals, and Lucky Draw" icon={<Gift size={18} />} />
                <p className="docs-lede">
                  Progression is separate from game odds. It gives players profile goals and shareable achievements without changing the contract result or vault accounting.
                </p>
                <div className="docs-feature-list">
                  {rewardNotes.map((item) => (
                    <InfoCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
                  ))}
                </div>
              </section>

              {/* Section 9: FAQ */}
              <section id="faq" className="docs-block">
                <SectionHeading eyebrow="Questions" title="Questions and answers" icon={<HelpCircle size={18} />} />
                <div className="docs-faq-list">
                  {faqs.map((item) => (
                    <details key={item.question} className="docs-faq-item">
                      <summary>{item.question}</summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            </>
          )}
        </article>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, icon }: { eyebrow: string; title: string; icon?: React.ReactNode }) {
  return (
    <div className="docs-section-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {icon && <div className="docs-heading-icon">{icon}</div>}
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="docs-feature">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="docs-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="docs-inline-link">
      {label}
    </Link>
  );
}

function ContractDocRow({ label, address, explorer, gameId }: { label: string; address?: string; explorer: string; gameId?: string }) {
  return (
    <div className="docs-contract-row">
      {gameId ? <GameIdentity gameId={gameId} label={label} size="xs" /> : <span>{label}</span>}
      <code>{address ?? "Not deployed"}</code>
      {address && (
        <a href={`${explorer}/address/${address}`} target="_blank" rel="noopener noreferrer">
          View <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}
