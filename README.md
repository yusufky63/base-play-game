# BasePlay

Mini onchain games on Base L2. Provably fair, instant payouts. $0.50-$3 bets.

**Tagline:** Mini games. Real stakes. On Base.

## Documentation Index

| # | Document | Contents |
|---|----------|----------|
| 01 | [Architecture](./docs/01-architecture.md) | Stack, folder structure, network config, game registry |
| 02 | [Smart Contracts](./docs/02-contracts.md) | Solidity contracts and comments |
| 03 | [Deploy Guide](./docs/03-deploy.md) | Remix deploy, VRF setup, Basescan verify |
| 04 | [Frontend](./docs/04-frontend.md) | Next.js, Wagmi, Basename, chain switch, components |
| 05 | [Backend](./docs/05-backend.md) | Node.js, event listener, Crash engine, WebSocket |
| 06 | [Database](./docs/06-database.md) | Supabase schema, migrations, RLS, Realtime |
| 07 | [UI & Design](./docs/07-ui-design.md) | Design tokens, light/dark, icons, animations |
| 08 | [Security](./docs/08-security.md) | Attack vectors, audit checklist, hardening |
| 09 | [Tests](./docs/09-tests.md) | Hardhat test suite, mock contracts, coverage |
| 10 | [Integrations](./docs/10-integrations.md) | Basename, Farcaster, Mini-app, Base Account |
| 11 | [Roadmap](./docs/11-roadmap.md) | Phase checklist, pre-deploy checklist |
| 12 | [Current Status](./docs/12-status.md) | Implemented scope, open gaps, deploy status |
| 13 | [AI Icon Prompts](./docs/13-ai-icon-prompts.md) | Brand and icon prompt references |

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

Production contract deploys are guarded. Before Base mainnet deployment, use a fresh deploy wallet, configure `VRF_SUB_ID_MAINNET`, set `VAULT_FUND_ETH_MAINNET`, and explicitly set `ALLOW_MAINNET_DEPLOY=true`.

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

Railway must define the backend-only variables before the service starts:

```bash
SUPABASE_URL=https://buubouudfeyhltsqryam.supabase.co
SUPABASE_SERVICE_KEY=<server-only service role key>
VRF_SUB_ID_MAINNET=<base mainnet vrf subscription id>
FRONTEND_URL=https://baseplay.games
```

Verify the live Supabase REST schema after migrations:

```bash
npm --workspace @baseplay/backend run supabase:verify
```

Only set `BACKEND_URL` in the Vercel frontend project after a real backend service is deployed and serving `/health`. Until then, leave it empty so the app uses Supabase and on-chain fallback data without showing a broken backend URL.
The backend Dockerfile installs production workspace dependencies again in the runtime stage, which keeps Railway's runtime module resolution reliable for Express dependencies. Rate limiting and crash round state are kept in the current backend process.

Frontend:

```bash
npm run dev:frontend
```

## Platform Summary

| Area | Choice |
|---|---|
| Chain | Base Mainnet |
| Currency | ETH only |
| Min bet | 0.000055 ETH |
| Max bet | 0.0005 ETH |
| House edge | 5% |
| Randomness | Chainlink VRF v2.5 |
| Database | Supabase PostgreSQL + Realtime |
| Backend | Node.js + Express + Socket.io |
| Contracts | Solidity 0.8.24 + Hardhat tests |

## Games

| Game | Multiplier | MVP status |
|------|------------|------------|
| Coin Flip | 2x gross, house edge in vault | Base mainnet live + tests |
| Dice | 6x gross, house edge in vault | Base mainnet live + tests |
| Crash | up to 10x | Base mainnet live + tests |
| Mines | up to 20x | Base mainnet live + tests |
| Hi-Lo | up to 8x | Base mainnet live + tests |
| Over/Under | odds based | Base mainnet live + tests |
| Limbo | target based | Base mainnet live + tests |
| Wheel | risk table | Base mainnet live + tests |
| Plinko Lite | path table | Base mainnet live + tests |
| Color Pick | 4x gross | Base mainnet live + tests |
| Treasure Chest | tier table | Base mainnet live + tests |
| Lucky Seven | 6x gross | Base mainnet live + tests |
| Roulette Lite | up to 12x | Base mainnet live + tests |
| Scratch Card | up to 30x | Base mainnet live + tests |
| Rock Paper Scissors | 2x gross | Base mainnet live + tests |
| Slots | up to 25x | Base mainnet live + tests |
