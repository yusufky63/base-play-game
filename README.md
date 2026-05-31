# BasePlay

![Category](https://img.shields.io/badge/Category-On-chain%20Gaming%20%2F%20Base-1f1f1f?style=flat-square&labelColor=141414&color=2b2b2b) ![Status](https://img.shields.io/badge/Status-private-1f1f1f?style=flat-square&labelColor=141414&color=2b2b2b)

Base-native on-chain gaming platform with provably fair mini games, real-stake flows, instant payouts, and admin tooling.

## Links

- Live: https://baseplaygame.vercel.app
- Repository: https://github.com/yusufky63/base-play-game
- Portfolio: https://codexsha.dev

## Overview

BasePlay is part of the Codexsha product portfolio. The project is focused on shipping a compact, usable product surface rather than a demo-only prototype. This README is written to make the repository easier to understand, run, and evaluate.

## Key Features

- Game library including Coin Flip, Dice, Crash, Mines, Slots, and Wheel
- Vault architecture and payout flows
- Chainlink VRF randomness
- Realtime event updates via backend services
- Admin-oriented operational surfaces

## Stack

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
- WalletConnect
- Framer Motion
- Node.js
- Express

## Role / Ownership

Full-stack product builder across game UX, contracts, backend events, database flows, and deployment.

## Getting Started

```bash
npm install
npm run dev:frontend
npm run dev:backend
npm run test --workspaces --if-present
npm run build
```

## Environment

Create a local environment file from the project conventions and configure only the values needed for the flow you are running. Do not commit secrets.

Typical values used by this project include:

- Base RPC URL
- Supabase credentials
- wallet connector IDs
- backend service secrets
- contract deployment keys for local/dev only

## Project Notes

- Status: Private repository with public deployment.
- Private or sensitive implementation details are intentionally not documented in public-facing copy.
- The README should stay aligned with the live product and the Codexsha portfolio page.

## Maintainer

Built by Yusuf / Codexsha.

- GitHub: https://github.com/yusufky63
- X: https://x.com/codexsha
- Telegram: https://t.me/codexsha
