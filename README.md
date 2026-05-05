# BasePlay

Mini onchain games on Base L2. Provably fair, instant payouts. $0.50-$3 bets.

**Tagline:** Mini games. Real stakes. On Base.

## Documentation Index

| # | Document | Contents |
|---|----------|----------|
| 01 | [Architecture](./01-architecture.md) | Stack, folder structure, network config, game registry |
| 02 | [Smart Contracts](./02-contracts.md) | Solidity contracts and comments |
| 03 | [Deploy Guide](./03-deploy.md) | Remix deploy, VRF setup, Basescan verify |
| 04 | [Frontend](./04-frontend.md) | Next.js, Wagmi, Basename, chain switch, components |
| 05 | [Backend](./05-backend.md) | Node.js, event listener, Crash engine, WebSocket |
| 06 | [Database](./06-database.md) | Supabase schema, migrations, RLS, Realtime |
| 07 | [UI & Design](./07-ui-design.md) | Design tokens, light/dark, icons, animations |
| 08 | [Security](./08-security.md) | Attack vectors, audit checklist, hardening |
| 09 | [Tests](./09-tests.md) | Hardhat test suite, mock contracts, coverage |
| 10 | [Integrations](./10-integrations.md) | Basename, Farcaster, Mini-app, Base Account |
| 11 | [Roadmap](./11-roadmap.md) | Phase checklist, pre-deploy checklist |
| 12 | [Current Status](./12-status.md) | Implemented scope, open gaps, deploy status |

## Quick Start

Prerequisites: Node.js 20.9+.

```bash
npm install
npm run build
npm run test
```

Contracts:

```bash
npm run compile:contracts
npm run test:contracts
```

Backend:

```bash
copy .env.example packages\backend\.env
npm run dev:backend
```

Production backend:

```bash
docker build -f Dockerfile.backend -t baseplay-backend .
docker run --env-file production.env.example -p 4000:4000 baseplay-backend
```

Set `BACKEND_URL=https://api.baseplaygame.com` in the Vercel frontend project after the backend is deployed and serving `/health`.

Frontend:

```bash
npm run dev:frontend
```

## Platform Summary

| Area | Choice |
|---|---|
| Chain | Base Sepolia, then Base Mainnet |
| Currency | ETH only |
| Min bet | 0.0002 ETH |
| Max bet | 0.001 ETH |
| House edge | 3% |
| Randomness | Chainlink VRF v2.5 |
| Database | Supabase PostgreSQL + Realtime |
| Backend | Node.js + Express + Socket.io |
| Contracts | Solidity 0.8.24 + Hardhat tests |

## Games

| Game | Multiplier | MVP status |
|------|------------|------------|
| Coin Flip | 2x gross, house edge in vault | Base Sepolia deployed + tests |
| Dice | 6x gross, house edge in vault | Base Sepolia deployed + tests |
| Crash | up to 10x | Base Sepolia deployed + tests |
| Mines | up to 20x | Base Sepolia deployed + tests |
| Hi-Lo | up to 8x | Base Sepolia deployed + tests |
| Over/Under | odds based | Base Sepolia deployed + tests |
| Limbo | target based | Base Sepolia deployed + tests |
| Wheel | risk table | Base Sepolia deployed + tests |
| Plinko Lite | path table | Base Sepolia deployed + tests |
| Color Pick | 4x gross | Base Sepolia deployed + tests |
| Treasure Chest | tier table | Base Sepolia deployed + tests |
| Lucky Seven | 6x gross | Base Sepolia deployed + tests |
| Roulette Lite | up to 12x | Base Sepolia deployed + tests |
| Scratch Card | up to 30x | Base Sepolia deployed + tests |
| Rock Paper Scissors | 2x gross | Base Sepolia deployed + tests |
| Slots | up to 25x | Base Sepolia deployed + tests |
