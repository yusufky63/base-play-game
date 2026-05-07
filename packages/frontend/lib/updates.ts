export const SITE_UPDATES: Array<{ date: string; title: string; body: string }> = [
  {
    date: "May 7, 2026",
    title: "Vault settlement guards tightened",
    body: "GameVault settlement entrypoints now reject zero-player payout, loss, refund, and lock requests, while Slither CI keeps the intentional approved-game payout path documented without globally disabling the detector."
  },
  {
    date: "May 7, 2026",
    title: "Production dependency cleanup prepared",
    body: "Unused WebGL packages were removed after Pixel Blast was dropped, wallet connections now use the standard wagmi injected and Coinbase Wallet stack without the extra Base Account/RainbowKit/WalletConnect dependency chain, Next was moved to a PostCSS-patched release, and ENS fallback now requires an explicit server-side mainnet RPC."
  },
  {
    date: "May 7, 2026",
    title: "Pixel Blast removed from Home",
    body: "The animated Pixel Blast hero background was removed, leaving a cleaner static Home hero band."
  },
  {
    date: "May 7, 2026",
    title: "Home hero composition filled out",
    body: "The Home hero now uses a full-width top band with larger, denser Pixel Blast squares and less unused vertical space above the content."
  },
  {
    date: "May 7, 2026",
    title: "Home hero Pixel Blast tuned",
    body: "The Home hero effect now uses calmer larger squares with lower density, softer motion, and a bottom fade so the shader sits behind the hero content more cleanly."
  },
  {
    date: "May 7, 2026",
    title: "Home hero Pixel Blast simplified",
    body: "The Home hero Pixel Blast now uses larger shader squares and removes the separate static grid overlay so only the animated effect remains."
  },
  {
    date: "May 7, 2026",
    title: "Pixel background moved into Home hero",
    body: "The Pixel Blast effect now fills only the top Home hero instead of sitting behind every page in the app."
  },
  {
    date: "May 7, 2026",
    title: "Pixel background motion gate removed",
    body: "The Pixel Blast background now stays visible on desktop even when the browser reports reduced motion, matching the mobile visual layer behavior."
  },
  {
    date: "May 7, 2026",
    title: "Pixel canvas and tab styling refined",
    body: "The pixel background now has a visible page-level fallback layer, spotlight hover effects were removed, tabs and game filters now use consistent bordered groups with card shadows, quest sections are grouped inside one cleaner panel, and mobile How it works rows are more compact."
  },
  {
    date: "May 7, 2026",
    title: "Home visual effects expanded",
    body: "The ReactBits-style Pixel Blast shader now sits behind the full app shell instead of only the Home hero, and border weights were reduced across the interface including game cards and Play buttons."
  },
  {
    date: "May 7, 2026",
    title: "Home hero visual effects trial added",
    body: "The Home hero now tests a desktop-only pixel blast style background and the global stats card has a restrained blue spotlight hover matched to the BasePlay visual system."
  },
  {
    date: "May 7, 2026",
    title: "Progression balance and mobile rewards UI refined",
    body: "Quest XP rewards were reduced so wager-based round XP stays the main progression signal, while the Quests page, profile tabs, leaderboard, and dark theme card borders were tightened for mobile readability."
  },
  {
    date: "May 6, 2026",
    title: "Quest board, badges, and mobile polish expanded",
    body: "New daily and weekly quest goals plus additional badges were added, the Quests page now shows badges directly, mobile global stats and game filters are cleaner, and game help panels link to the player Q&A."
  },
  {
    date: "May 6, 2026",
    title: "Win sharing, profile tabs, and leaderboard sorting refined",
    body: "Win cards now explain verified on-chain results more clearly, profile sections moved into a cleaner tab bar with Profile and Badges tabs, and leaderboard sorting now compares XP or weekly wager volume instead of profit."
  },
  {
    date: "May 6, 2026",
    title: "Quest navigation and game layout refined",
    body: "Quests moved into the header as a dedicated page with badge progress, game pages were cleaned up, contract links are now more compact above the play area, wallet menus are simpler, and default wagers now select the middle preset."
  },
  {
    date: "May 6, 2026",
    title: "Dedicated quests page added",
    body: "Daily, weekly, and completed quests now have a dedicated page, while badges stay profile-focused as a public achievement shelf."
  },
  {
    date: "May 6, 2026",
    title: "Progression panels moved closer to play",
    body: "Quest progress now appears on Home and game pages, while profile badges are presented as a dedicated achievement shelf instead of being buried in tabs."
  },
  {
    date: "May 6, 2026",
    title: "Referral, quests, badges, and cached RPC reads prepared",
    body: "Player progression now includes referral XP, daily and weekly quests, profile badges, improved win sharing, Slither CI coverage, and backend-cached contract status reads to reduce browser RPC pressure."
  },
  {
    date: "May 6, 2026",
    title: "Lower bet limits enabled",
    body: "Base mainnet vault limits and quick bet presets were lowered to support smaller wagers around 0.000055 ETH, 0.00023 ETH, and 0.0005 ETH."
  },
  {
    date: "May 6, 2026",
    title: "GameVaultV2 activated on Base",
    body: "Base mainnet now points to the deployed GameVaultV2 suite with amount-based withdraw support, newly approved game contracts, and Chainlink VRF consumers registered for the new games."
  },
  {
    date: "May 6, 2026",
    title: "Vault withdraw controls clarified",
    body: "Admin Vault now separates amount-based available withdraw from full emergency withdraw and explains when the deployed vault contract does not support partial withdrawal yet."
  },
  {
    date: "May 6, 2026",
    title: "Explorer verification flow updated",
    body: "Contract verification now uses the Etherscan V2 API path for Base explorers and includes separate Blockscout verification commands for public source-code checks."
  },
  {
    date: "May 6, 2026",
    title: "Vault funding and safer controls prepared",
    body: "Admin Vault now includes wallet-based vault funding, player pause messages are simpler, verification scripts are ready for Basescan, and the next vault source includes a safer paused partial withdraw path."
  },
  {
    date: "May 6, 2026",
    title: "Pause and vault states surfaced",
    body: "Game pages now read game pause, vault pause, bet limits, and vault liquidity before allowing Play, while Admin explains full emergency withdraw, unavailable partial withdraw, and practical liquidity guardrails."
  },
  {
    date: "May 6, 2026",
    title: "Docs categories separated",
    body: "Docs now renders one selected category at a time instead of stacking every section on one page, and game contract links moved below How it works on game pages."
  },
  {
    date: "May 6, 2026",
    title: "Docs, profile tabs, and mobile cards refined",
    body: "Docs now reads like a structured player manual with a side navigation and separated sections, profile refunds are embedded cleanly inside the Refunds tab, and game cards keep the full desktop layout while using a tighter mobile-only treatment."
  },
  {
    date: "May 6, 2026",
    title: "Indexer polling hardened",
    body: "The backend indexer now avoids fragile RPC filter subscriptions, polls settled Base events from saved checkpoints, skips unreliable BlockPI endpoints, and keeps admin health errors short and readable."
  },
  {
    date: "May 6, 2026",
    title: "Vercel monorepo build fixed",
    body: "Production deploys now install build dependencies explicitly and compile the shared workspace before the frontend, so Tailwind and shared contract config resolve correctly on Vercel."
  },
  {
    date: "May 6, 2026",
    title: "Wallet build dependency fixed",
    body: "The frontend now includes the bs58 dependency required by the Base/Coinbase wallet connector chain, preventing production builds from failing during wallet component SSR."
  },
  {
    date: "May 6, 2026",
    title: "Admin analytics and public contract links added",
    body: "Game pages and Docs now expose explorer-ready contract addresses, while Admin adds per-game totals, paginated logs, vault liquidity USD/risk alerts, emergency withdraw controls, and Supabase fallback health."
  },
  {
    date: "May 6, 2026",
    title: "XP, refunds, and player docs clarified",
    body: "XP now follows wager size instead of win luck, pending refund tracking explains reopen/reconnect behavior, Scratch Card now presents one VRF ticket, and the Docs page includes a player-focused FAQ."
  },
  {
    date: "May 6, 2026",
    title: "Refund flow separated from VRF status",
    body: "Claim refund now clears the active game verification state and no longer shows refund transactions as if they were new Chainlink VRF rounds."
  },
  {
    date: "May 6, 2026",
    title: "Round verification and game feedback improved",
    body: "Live feed no longer exposes internal data-source labels, Mines now shows a clear risk preview for selected mine count, and round polling handles Base RPC log-range limits more safely."
  },
  {
    date: "May 6, 2026",
    title: "Pending refund tracking added",
    body: "Connected players can now see unresolved on-chain rounds in the wallet menu and profile page, including refund availability after the contract timeout window."
  },
  {
    date: "May 6, 2026",
    title: "Profile and leaderboard data fixed",
    body: "Supabase production migrations now expose profile game stats, global stats, ranked weekly leaderboard data, and backend indexer checkpoints with stricter public access controls."
  },
  {
    date: "May 6, 2026",
    title: "Production data checks added",
    body: "Backend startup now reports missing production variables clearly, and Supabase schema checks help verify profile, leaderboard, and live feed data before launch."
  },
  {
    date: "May 6, 2026",
    title: "Base mainnet contracts deployed",
    body: "BasePlay contracts are now deployed on Base mainnet with Chainlink VRF consumers configured, vault reserves enabled, production default network set to Base, and Railway backend packaging prepared."
  }
];
