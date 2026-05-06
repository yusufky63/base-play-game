import { rateLimit } from "express-rate-limit";

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please wait." }
});

export const chainReadRateLimit = rateLimit({
  windowMs: 60_000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chain read requests, please wait." }
});

export const referralRateLimit = rateLimit({
  windowMs: 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many referral requests, please wait." }
});
