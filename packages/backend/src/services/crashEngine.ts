import { Redis } from "ioredis";
import type { Server } from "socket.io";
import { env } from "../config/env.js";

export interface CrashRound {
  roundId: string;
  startTime: number;
  crashPoint: number;
}

export interface CrashEngine {
  startRound: (roundId: string, crashPoint: number) => void;
}

export function startCrashEngine(io: Server): CrashEngine {
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true });
  let current: CrashRound | null = null;
  let interval: NodeJS.Timeout | null = null;

  function startRound(roundId: string, crashPoint: number) {
    current = { roundId, startTime: Date.now(), crashPoint };
    void redis.set(`crash:round:${roundId}`, JSON.stringify(current), "EX", 300);

    io.emit("crash:round_start", { roundId, startTime: current.startTime });

    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      if (!current) return;
      const elapsed = (Date.now() - current.startTime) / 1000;
      const multiplier = Number(Math.exp(0.15 * elapsed).toFixed(2));

      io.emit("crash:multiplier", { multiplier, elapsed });

      if (multiplier >= current.crashPoint) {
        if (interval) clearInterval(interval);
        io.emit("crash:crashed", { crashPoint: current.crashPoint, roundId });
        current = null;
      }
    }, 100);
  }

  return { startRound };
}
