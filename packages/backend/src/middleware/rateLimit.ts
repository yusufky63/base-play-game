import { rateLimit } from "express-rate-limit";
import { Redis } from "ioredis";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env.js";

const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) => (redis.call as any)(...args)
  }),
  message: { error: "Too many requests, please wait." }
});
