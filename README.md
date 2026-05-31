# BasePlay

BasePlay is a Base mainnet gaming platform with provably fair mini games, real-stake flows, instant payout logic, contracts, backend event handling, and operational tooling.

## Snapshot

- **Category:** Base-native on-chain gaming
- **Status:** Private repository with public deployment
- **Live:** https://baseplaygame.vercel.app
- **Repository:** https://github.com/yusufky63/base-play-game
- **Portfolio:** https://codexsha.dev

## Product Scope

BasePlay is documented here as a product repository, not just a code dump. The goal of this README is to make the product purpose, runtime surface, and development path clear for future review and maintenance.

## Core Capabilities

- Game library direction: Coin Flip, Dice, Crash, Mines, Slots, Wheel, and Lucky Draw
- Vault, payout, and contract settlement architecture
- Chainlink VRF randomness and Hardhat test flow
- Backend listener and realtime Socket.io updates
- Admin-oriented product surfaces for operations

## Existing README Coverage Preserved

This refresh keeps the important project-specific areas from the previous documentation:

- Documentation Index
- Quick Start
- Platform Summary
- Games
- Lucky Draw

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Wagmi
- Viem
- Supabase
- Socket.io
- Solidity
- Chainlink VRF
- OpenZeppelin
- Hardhat
- Node.js
- Express

## Repository Map

| Path | Purpose |
| --- | --- |
| packages/frontend/ | Next.js product UI |
| packages/backend/ | Event listener, API, and realtime services |
| packages/contracts/ | Solidity contracts and Hardhat tooling |
| packages/shared/ | Shared types/utilities |
| docs/ | Project documentation |

## Local Development

| Command | Purpose |
| --- | --- |
| npm run dev:frontend | Run the frontend workspace |
| npm run dev:backend | Run backend services |
| npm run build | Build workspaces |
| npm run test --workspaces --if-present | Run available workspace tests |
| npm run compile:contracts | Compile contracts |
| npm run test:contracts | Run contract tests |
| npm run deploy:base | Deploy contracts when deployment env is explicitly configured |

## Environment Notes

Use local environment files for secrets and deployment-specific values. Do not commit real keys.

- PRIVATE_KEY
- VRF_SUB_ID_MAINNET
- VAULT_FUND_ETH_MAINNET
- LUCKY_DRAW_FUND_ETH_MAINNET
- BASESCAN_API_KEY
- NEXT_PUBLIC_DEFAULT_CHAIN
- NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

## Operational Notes

- Keep this README aligned with the live product and portfolio copy.
- Prefer small, documented changes over large undocumented rewrites.
- Mainnet deployment commands require explicit allow-list environment flags. Do not run deployment scripts with production keys unless you intend to deploy.

## Maintainer

Built by Yusuf / Codexsha.

- GitHub: https://github.com/yusufky63
- X: https://x.com/codexsha
- Telegram: https://t.me/codexsha
