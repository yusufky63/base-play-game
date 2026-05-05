import { rateLimit } from "express-rate-limit";
import { Redis } from "ioredis";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env.js";

const redis = env.REDIS_URL ? new Redis(env.REDIS_URL, { lazyConnect: true }) : null;
const store = redis
  ? new RedisStore({
      sendCommand: (...args: string[]) => (redis.call as any)(...args)
    })
  : undefined;

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store,
  message: { error: "Too many requests, please wait." }
});
