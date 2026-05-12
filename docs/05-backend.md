# 05 — Backend

> Express: [expressjs.com](https://expressjs.com)
> Socket.io: [socket.io/docs/v4](https://socket.io/docs/v4/)
> ioredis: [github.com/redis/ioredis](https://github.com/redis/ioredis)

---

## Dependencies

```bash
npm install express socket.io ioredis zod cors
npm install express-rate-limit rate-limit-redis
npm install viem @supabase/supabase-js
npm install --save-dev typescript @types/express @types/node ts-node
```

---

## Environment Validation

```ts
// src/config/env.ts
import { z } from "zod";

const schema = z.object({
  NODE_ENV:             z.enum(["development", "production", "test"]),
  PORT:                 z.coerce.number().default(4000),
  SUPABASE_URL:         z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  ALCHEMY_BASE_MAINNET: z.string().url(),
  ALCHEMY_BASE_MAINNET: z.string().url(),
  VRF_SUB_ID_mainnet:   z.string().min(1),
  VRF_SUB_ID_MAINNET:   z.string().min(1),
  REDIS_URL:            z.string().url(),
  FRONTEND_URL:         z.string().url(),
});

export const env = schema.parse(process.env);
// Fails immediately if any variable is missing or wrong type
```

---

## Entry Point

```ts
// src/index.ts
import express  from "express";
import cors     from "cors";
import { createServer } from "http";
import { Server }       from "socket.io";
import { env }          from "./config/env";
import { initEventListeners } from "./services/eventListener";
import { startCrashEngine }   from "./services/crashEngine";
import { apiRateLimit }       from "./middleware/rateLimit";
import { errorHandler }       from "./middleware/errorHandler";

const app    = express();
const server = createServer(app);
const io     = new Server(server, {
  cors: { origin: env.FRONTEND_URL, credentials: true },
});

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());
app.use("/api", apiRateLimit);

app.get("/health", (_, res) => res.json({ status: "ok", ts: Date.now() }));

app.use(errorHandler);

server.listen(env.PORT, async () => {
  console.log(`[Server] Running on port ${env.PORT}`);
  await initEventListeners();
  startCrashEngine(io);
});
```

---

## Event Listener

Listens to all game contracts on both chains and writes results to Supabase.

```ts
// src/services/eventListener.ts
import { createPublicClient, fallback, http, parseAbi } from "viem";
import { base, baseMainnet }  from "viem/chains";
import { supabaseAdmin }      from "../supabase/client";
import { NETWORKS }           from "@baseplay/shared/config/networks";
import { CONTRACT_ADDRESSES } from "@baseplay/shared/config/addresses";
import { GAMES_REGISTRY }     from "@baseplay/shared/config/games.registry";

const SETTLE_ABI = parseAbi([
  "event RoundSettled(address indexed player, uint256 indexed requestId, uint256 payout, bool won)",
]);

async function listenChain(chainId: number) {
  const isMainnet  = chainId === 8453;
  const networkKey = isMainnet ? "baseMainnet" : "baseMainnet";
  const net        = NETWORKS[networkKey];
  const viemChain  = isMainnet ? base : baseMainnet;

  const client = createPublicClient({
    chain:     viemChain,
    transport: fallback(
      net.rpcUrls.filter(Boolean).map(url => http(url, { timeout: 10_000 }))
    ),
  });

  for (const game of GAMES_REGISTRY) {
    const addr = CONTRACT_ADDRESSES[chainId]?.[game.contractName];
    if (!addr) continue;

    client.watchContractEvent({
      address:   addr,
      abi:       SETTLE_ABI,
      eventName: "RoundSettled",
      onLogs: async (logs) => {
        for (const log of logs) {
          const { player, requestId, payout, won } = log.args;
          await supabaseAdmin.from("game_rounds").upsert({
            vrf_request_id: requestId?.toString(),
            player:         player?.toLowerCase(),
            game_id:        game.id,
            chain_id:       chainId,
            payout:         payout ? Number(payout) / 1e18 : 0,
            won:            won ?? false,
            settled_at:     new Date().toISOString(),
          }, { onConflict: "vrf_request_id" });
        }
      },
      onError: (err) => {
        console.error(`[Listener][${game.id}][${chainId}]`, err.message);
        setTimeout(() => listenChain(chainId), 5_000); // reconnect after 5s
      },
    });

    console.log(`[Listener] Watching ${game.id} on chainId ${chainId}`);
  }
}

export async function initEventListeners() {
  await listenChain(8453); // Base mainnet
  await listenChain(8453);  // Base Mainnet
}
```

---

## Crash Engine

Broadcasts the rising multiplier to all connected clients via WebSocket.
The crash point is determined by the contract (VRF) — the backend only broadcasts.

```ts
// src/services/crashEngine.ts
import Redis  from "ioredis";
import { Server } from "socket.io";
import { env }    from "../config/env";

const redis = new Redis(env.REDIS_URL);

interface CrashRound {
  roundId:    string;
  startTime:  number;
  crashPoint: number; // e.g. 2.50 — received from contract CrashPointGenerated event
}

export function startCrashEngine(io: Server) {
  let current: CrashRound | null = null;
  let interval: NodeJS.Timeout   | null = null;

  // Called when backend hears CrashPointGenerated event from contract
  function startRound(roundId: string, crashPoint: number) {
    current = { roundId, startTime: Date.now(), crashPoint };
    redis.set(`crash:round:${roundId}`, JSON.stringify(current), "EX", 300);

    io.emit("crash:round_start", { roundId, startTime: current.startTime });

    interval = setInterval(() => {
      if (!current) return;
      const elapsed    = (Date.now() - current.startTime) / 1000;
      const multiplier = parseFloat(Math.pow(Math.E, 0.15 * elapsed).toFixed(2));

      io.emit("crash:multiplier", { multiplier, elapsed });

      if (multiplier >= current.crashPoint) {
        if (interval) clearInterval(interval);
        io.emit("crash:crashed", { crashPoint: current.crashPoint, roundId });
        current = null;
      }
    }, 100); // broadcast every 100ms
  }

  // Expose startRound so the event listener can call it
  return { startRound };
}
```

---

## Rate Limiter

```ts
// src/middleware/rateLimit.ts
import { rateLimit }  from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis          from "ioredis";
import { env }        from "../config/env";

const redis = new Redis(env.REDIS_URL);

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max:      120,
  standardHeaders: true,
  legacyHeaders:   false,
  store: new RedisStore({ sendCommand: (...args: string[]) => redis.call(...args) as any }),
  message: { error: "Too many requests, please wait." },
});
```

---

## Error Handler

```ts
// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[ErrorHandler]", err.message);
  res.status(500).json({ error: "Internal server error" });
}
```

---

## Supabase Admin Client

```ts
// src/supabase/client.ts
import { createClient } from "@supabase/supabase-js";
import { env }          from "../config/env";

// Service role — full DB access, never expose to frontend
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);
```

---

## Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]
```


