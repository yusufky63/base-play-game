import Link from "next/link";
import { BadgeCheck, BookOpen, CircleDollarSign, ExternalLink, Gift, HelpCircle, Radio, RotateCcw, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY } from "@baseplay/shared/config/games.registry";
import { NETWORKS } from "@baseplay/shared/config/networks";
import { GameIdentity } from "@/components/game/GameIdentity";

const docNav = [
  { id: "essentials", label: "Essentials", title: "Player documentation", description: "Core player concepts before placing a wager." },
  { id: "rounds", label: "Round flow", title: "How a round works", description: "The wager, VRF, settlement, and display flow." },
  { id: "refunds", label: "Refunds", title: "Pending rounds and refunds", description: "What happens when a VRF round is delayed." },
  { id: "games", label: "Games", title: "Games", description: "Active games and their player-facing rules." },
  { id: "contracts", label: "Contracts", title: "Public contracts", description: "Explorer links for game and vault contracts." },
  { id: "account", label: "Account", title: "Wallet, stats, and safety", description: "Wallet identity, live data, XP, and safety notes." },
  { id: "rewards", label: "Rewards", title: "XP, quests, badges, and referrals", description: "How player progression works without affecting payouts." },
  { id: "faq", label: "Q&A", title: "Questions and answers", description: "Common player questions about results and mechanics." }
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

const playerNotes = [
  {
    icon: <ShieldCheck size={18} />,
    title: "Fair results",
    body: "Results are settled by contracts using Chainlink VRF on Base. The UI does not decide whether a player wins or loses."
  },
  {
    icon: <CircleDollarSign size={18} />,
    title: "Clear payouts",
    body: "Wagers and profile profit rows are shown in ETH with a lightweight USD reference where it helps. Quick bet buttons now use smaller amounts with a light card shadow, and the contract enforces the active minimum and maximum bet limits."
  },
  {
    icon: <Sparkles size={18} />,
    title: "XP and streaks",
    body: "Settled rounds grant XP mainly from wager size, not from winning luck. Playing on active days builds your daily streak."
  },
  {
    icon: <Radio size={18} />,
    title: "Fast activity views",
    body: "Live feed, profile tabs, leaderboard data, Home stats, and round detail timelines are indexed from Base mainnet events and cached by view importance instead of polling every few seconds. Leaderboard responses are shared for 30 minutes, Home stats use a shared 10 minute API cache with no browser-level force-cache, compact feeds for 5 minutes, round details for 30 minutes, and profile tabs only load their own data when opened. Home global stats read aggregate tables first and fall back to settled round rows if an aggregate is empty. Profile tab labels avoid stale counts until opened, and each profile panel shows loading rows while its data is fetched. Basenames are cached after first lookup, game pages expose a referral share card without adding referral API load, backend event indexing is mainnet-only, reads all deployed game events with one batched log request per poll window, and Base RPC transports keep public endpoints first with private or Alchemy URLs used only after public endpoint failure or rate-limit. Direct contract fallback reads use multicall batching where possible, and ENS fallback display names only resolve when a server-side Ethereum mainnet RPC is configured."
  },
  {
    icon: <Sparkles size={18} />,
    title: "Clean Home hero",
    body: "The Home hero uses a static full-width band without an animated Pixel Blast background, while tabs, game cards, round status panels, contract panels, buttons, filters, and mobile help sections stay compact with thinner neutral borders and consistent card shadows."
  }
];

const safetyNotes = [
  "Only confirm transactions you understand in your wallet.",
  "Current quick bet buttons are 0.000055 ETH, 0.00023 ETH, and 0.0005 ETH on supported game pages.",
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
    body: "Quests reward simple activity such as round counts, wins, trying different games, and keeping streaks. Connected players manage active quest and badge progress from the Quests page."
  },
  {
    icon: <BadgeCheck size={18} />,
    title: "Badges",
    body: "Badges are off-chain profile achievements in this version. Recent badges appear in progression panels, and the full shelf is shown on the player profile."
  },
  {
    icon: <Radio size={18} />,
    title: "Referrals",
    body: "Referral links award small capped XP to the referrer after referred players settle rounds. Referral never pays ETH and never touches the vault."
  }
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
    question: "What does win sharing include?",
    answer: "Win sharing uses a short invite-focused message with light emoji, includes the payout multiplier when payout and wager data are available, and always links friends back to BasePlay. Game pages also include a lightweight invite card outside the win state; when a wallet is connected it shares the wallet referral path without querying referral stats, otherwise it shares the canonical domain."
  },
  {
    question: "Why can live feed take a few seconds?",
    answer: "The on-chain result is final first. Feed, profile, and leaderboard views are updated by the backend indexer after it reads settled Base events. Indexing is mainnet-first by default and batches deployed game addresses into one log query per poll window, while public activity views use cache windows to avoid unnecessary Supabase and RPC load."
  },
  {
    question: "Why can Home global stats lag behind a new round?",
    answer: "Home global stats are served through a shared API cache for up to 10 minutes so every visitor can reuse the same aggregate response. Browser force-cache is disabled for this endpoint, so desktop, mobile, Farcaster, and private windows should converge on the same API value once the shared cache refreshes."
  },
  {
    question: "How is Base App support handled?",
    answer: "BasePlay uses standard wagmi and viem wallet flows with a global explicit wallet picker for normal web sessions, including injected wallets, WalletConnect, Coinbase Wallet, and Base Account. The picker renders at app-provider level, so header, mobile menu, and game-page connect actions all open the same centered modal on web with wallet-specific icons. Normal web sessions also run a silent reconnect check for previously authorized connectors, so desktop web reloads and returns can restore MetaMask, WalletConnect, Coinbase Wallet, or Base Account without opening the picker again. Farcaster and Base App or Coinbase Wallet in-app browser sessions skip the web modal and connect through their native connector, with Coinbase Wallet prioritized before Base Account in Base App-like environments. MetaMask is only shown when a real MetaMask provider is injected, generic injected wallets are hidden when no provider exists, WalletConnect is shipped as a direct frontend dependency, and mobile WalletConnect returns are resynced on focus, pageshow, and visibility changes after the player starts a connection. The canonical app URL is https://baseplay.games, Base mainnet is the only active chain, game actions open the wallet picker first on web and then request Base mainnet switching when the wallet is on an unsupported network, wallet transactions include the BasePlay Builder Code attribution suffix, RPC reads keep public Base endpoints ahead of private or Alchemy fallbacks, backend status read failures retry another RPC instead of marking every game unavailable, frontend fallback contract status reads are batched with multicall to reduce RPC load, and the listing copy uses Play. Compete. Win on Base."
  },
  {
    question: "How is Farcaster support handled?",
    answer: "BasePlay publishes Farcaster Mini App discovery metadata at /.well-known/farcaster.json, emits feed embed metadata with branded launch imagery, trims the canonical app URL before generating embed URLs, uses a 1200x630 branded social preview for Open Graph and X/Twitter cards, calls the Farcaster ready signal in Mini App clients, and prioritizes the Farcaster Mini App wallet connector only after the player starts a wallet action. Automatic reconnect and background referral signing are disabled in Mini App sessions so reopening the app does not ask for wallet authorization. Core game and Base App flows remain standard wagmi/viem flows."
  },
  {
    question: "Is Google Analytics enabled?",
    answer: "BasePlay loads Google Analytics through the official gtag script after the app becomes interactive. The production measurement ID is G-EXWSNL6326 and can be overridden with NEXT_PUBLIC_GA_MEASUREMENT_ID if the analytics property changes."
  },
  {
    question: "Why do profile tabs not show counts in the tab label?",
    answer: "Profile sections are lazy-loaded to reduce Supabase and RPC usage. Counts are shown inside the opened section after the relevant data has loaded, with loading rows displayed while the request is in progress."
  },
  {
    question: "Why does the leaderboard not update every second?",
    answer: "Leaderboard data is not used to settle games, so weekly rankings are served through a shared 30 minute cache and all-time rankings use a longer 3 hour cache from aggregate player stats. A player opening it later can reuse the same cached ranking instead of making another database query, and the weekly API falls back to the latest indexed week if the current week has no rows yet."
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
    question: "Do referral rewards pay ETH?",
    answer: "No. Referral rewards are only XP and badge progression. They do not create claimable ETH, rebates, or vault liabilities."
  },
  {
    question: "Can public clients read referral history directly?",
    answer: "No. Referral relationship and reward rows are kept behind the backend referral API, which uses service-role Supabase access and request rate limits."
  },
  {
    question: "When do quests complete?",
    answer: "Daily and weekly quests update after a settled on-chain round is indexed. They can track rounds, wins, distinct games, and streaks. Pending, failed, or refunded rounds do not count."
  },
  {
    question: "Can badges be minted?",
    answer: "Not in the first version. Badges are profile achievements now, with mint-ready metadata fields prepared for a future contract if it is added."
  },
  {
    question: "Why are XP and volume separate rankings?",
    answer: "XP rewards activity and quest progress. Volume ranks how much was wagered in the selected leaderboard scope, so active players can be compared without turning leaderboard order into a lucky profit race."
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
  },
  {
    question: "Why is the Play button disabled?",
    answer: "BasePlay only opens Play when the selected game is ready and the bankroll can safely cover the round. If it is disabled, try another game or check again later."
  }
];

export default async function DocsPage({ searchParams }: { searchParams?: Promise<{ section?: string }> }) {
  const params = await searchParams;
  const selectedSection = docNav.some((item) => item.id === params?.section) ? (params?.section as DocSectionId) : "essentials";
  const current = docNav.find((item) => item.id === selectedSection) ?? docNav[0];

  return (
    <main className="docs-page mx-auto w-full max-w-7xl px-4 py-10">
      <header className="docs-hero">
        <div className="docs-kicker">
          <BookOpen size={16} />
          BasePlay Docs
        </div>
        <h1 className="display-heading text-4xl font-bold text-[var(--text-1)]">{current.title}</h1>
        <p>{current.description}</p>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label="Docs navigation">
          <nav>
            {docNav.map((item) => (
              <Link key={item.id} href={`/docs?section=${item.id}`} className={`docs-nav-link ${item.id === selectedSection ? "docs-nav-link-active" : ""}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="docs-article">
          {selectedSection === "essentials" && (
          <section className="docs-block">
            <SectionHeading eyebrow="Overview" title="Essentials" />
            <p className="docs-lede">
              BasePlay keeps the game result on-chain and uses the connected wallet as the player identity. These are the concepts worth knowing before placing a wager.
            </p>
            <div className="docs-feature-list">
              {playerNotes.map((item) => (
                <InfoCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
            </div>
          </section>
          )}

          {selectedSection === "rounds" && (
          <section className="docs-block">
            <SectionHeading eyebrow="Round flow" title="How a round works" />
            <ol className="docs-step-list">
              {roundSteps.map((item, index) => (
                <li key={item.title}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          )}

          {selectedSection === "refunds" && (
          <section className="docs-block">
            <SectionHeading eyebrow="Fallback" title="Pending rounds and refunds" icon={<RotateCcw size={18} />} />
            <p className="docs-lede">
              Refunds are a fallback for unresolved VRF rounds. They are tracked from the contract, so they survive refreshes and closed tabs.
            </p>
            <ul className="docs-note-list">
              {refundNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          )}

          {selectedSection === "games" && (
          <section className="docs-block">
            <SectionHeading eyebrow="Library" title="Games" />
            <div className="docs-game-list">
              {GAMES_REGISTRY.map((game) => (
                <Link key={game.id} href={game.path} className="docs-game-row">
                  <div>
                    <GameIdentity gameId={game.id} label={game.name} size="sm" />
                    <p>{game.description}</p>
                  </div>
                  <Metric label="Max payout" value={`${game.maxMultiplier}x`} />
                  <Metric label="Edge" value="5%" />
                </Link>
              ))}
            </div>
          </section>
          )}

          {selectedSection === "contracts" && (
          <section className="docs-block">
            <SectionHeading eyebrow="Public records" title="Public contracts" />
            <p className="docs-lede">
              Game and vault contracts are public. Use the explorer links to inspect transactions, events, verified source code, balances, and owner-only vault actions for each deployed network. Base mainnet now uses the V2 vault source for amount-based withdraw controls, and vault settlement rejects zero-player lock, payout, loss, and refund requests.
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
                    {GAMES_REGISTRY.filter((game) => game.active && game.chains.includes("baseMainnet")).map((game) => (
                      <ContractDocRow key={`${network.chainId}-${game.id}`} label={game.name} gameId={game.id} address={CONTRACT_ADDRESSES[network.chainId]?.[game.contractName]} explorer={network.blockExplorer} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {selectedSection === "account" && (
          <section className="docs-block">
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
          )}

          {selectedSection === "rewards" && (
          <section className="docs-block">
            <SectionHeading eyebrow="Progression" title="XP, quests, badges, and referrals" icon={<Gift size={18} />} />
            <p className="docs-lede">
              Progression is separate from game odds. It gives players profile goals and shareable achievements without changing the contract result, payout, or vault accounting.
            </p>
            <div className="docs-feature-list">
              {rewardNotes.map((item) => (
                <InfoCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
            </div>
            <div className="docs-link-row mt-4">
              <DocLink href="/quests" label="Open quests" />
              <DocLink href="/profile" label="Open profile badges" />
            </div>
            <div className="docs-grid-two mt-4">
              <div>
                <h3>Current quest rewards</h3>
                <ul className="docs-note-list docs-note-list-compact">
                  <li>Daily quests currently reward 8-30 XP depending on effort.</li>
                  <li>Weekly quests currently reward 45-85 XP depending on effort.</li>
                  <li>Badge quests still unlock profile badges, but badge rewards do not affect payouts.</li>
                  <li>Quest XP is bonus progress. Round XP remains the main activity signal.</li>
                </ul>
              </div>
              <div>
                <h3>Referral rules</h3>
                <ul className="docs-note-list docs-note-list-compact">
                  <li>Referral links can use an address or a referral code.</li>
                  <li>The referred wallet signs once to link the referral.</li>
                  <li>Self-referral and changing referrer later are blocked.</li>
                  <li>Referrer XP is capped per round and per day.</li>
                  <li>Only settled indexed rounds count. Refunds and pending rounds do not.</li>
                </ul>
              </div>
            </div>
          </section>
          )}

          {selectedSection === "faq" && (
          <section className="docs-block">
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
          )}
        </article>
      </div>
    </main>
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
