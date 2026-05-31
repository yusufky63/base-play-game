# BasePlay

BasePlay is a Base-native on-chain gaming platform with a Next.js frontend, backend services, Solidity contracts, shared packages, and deployment configuration for real product environments.

The repository is organized as a workspace so the frontend, backend, smart contracts, and shared types can evolve together.

## Documentation Index

- `docs/` - product, deployment, contract, and operational notes.
- `packages/frontend` - player-facing web application.
- `packages/backend` - event listener, API, realtime, and service logic.
- `packages/contracts` - Solidity contracts, Hardhat tasks, tests, and deployment scripts.
- `packages/shared` - shared types and utilities used across packages.

## Platform Summary

| Area | Description |
| --- | --- |
| Games | Coin Flip, Dice, Crash, Mines, Slots, Wheel, and additional Base-native game surfaces. |
| Lucky Draw | Draw-oriented flow backed by contract logic and configurable funding. |
| Vault | Contract-level funds management and settlement-oriented architecture. |
| Randomness | Chainlink VRF configuration for provably fair outcomes. |
| Operations | Backend listener, realtime updates, deployment scripts, and production environment examples. |

## Quick Start

```bash
npm install
npm run build
npm run dev:frontend
```

Run backend and contract tasks in separate terminals when working on settlement or event flows.

| Command | Purpose |
| --- | --- |
| `npm run build` | Build workspace packages. |
| `npm test` | Run workspace tests. |
| `npm run dev:frontend` | Start the frontend app. |
| `npm run dev:backend` | Start backend services. |
| `npm run compile:contracts` | Compile Solidity contracts. |
| `npm run test:contracts` | Run contract tests. |
| `npm run coverage:contracts` | Generate contract coverage. |
| `npm run deploy:base` | Deploy configured contracts to Base after environment checks. |
| `npm run deploy:missing:base` | Deploy missing Base contracts only. |

| Layer | Tools |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Wagmi, Viem, WalletConnect, Framer Motion |
| Backend | Node.js, Express-style services, Socket.io, Supabase, event listeners |
| Contracts | Solidity, Hardhat, OpenZeppelin, Chainlink VRF, Base deployment scripts |
| Infra | Vercel frontend config, Render backend config, Dockerfile backend, production env examples |

## Environment

Start from `.env.example` and `production.env.example`. Treat deploy keys, VRF IDs, and funding values as environment-specific production secrets.

- `NODE_ENV`
- `PRIVATE_KEY`
- `VRF_SUB_ID_MAINNET`
- `VAULT_FUND_ETH_MAINNET`
- `LUCKY_DRAW_FUND_ETH_MAINNET`
- `VAULT_CONTRACT_NAME`
- `ETHERSCAN_API_KEY`
- `BASESCAN_API_KEY`
- `ALLOW_MAINNET_DEPLOY`
- `ALLOW_CREATE_MAINNET_VRF_SUB`
- `ALLOW_ZERO_MAINNET_VAULT`
- `NEXT_PUBLIC_DEFAULT_CHAIN`

## Status

Private product repository with public deployment. Keep contract addresses, operational secrets, and production funding values out of public documentation.
