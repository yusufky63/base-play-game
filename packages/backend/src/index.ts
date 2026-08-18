import cors from "cors";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { adminRateLimit, apiRateLimit, chainReadRateLimit, luckyDrawClaimRateLimit, luckyDrawRateLimit, referralRateLimit } from "./middleware/rateLimit.js";
import { getAdminOpsState } from "./services/adminOps.js";
import { getCachedContractStatus, getPendingRoundsForPlayer, toSupportedChainId } from "./services/chainReads.js";
import { startCrashEngine } from "./services/crashEngine.js";
import { getIndexerHealth, initEventListeners } from "./services/eventListener.js";
import { claimLuckyDraw, getLuckyDrawAdminState, getLuckyDrawPublicHistory, getLuckyDrawSummary, updateLuckyDrawConfig, updateLuckyDrawResultStatus, verifyAdminSignature } from "./services/luckyDraw.js";
import { claimReferral, getReferralSummary } from "./services/referrals.js";
import { generateBadgeClaimSignature } from "./services/badgeClaim.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use((req, res, next) => {
  const requestId = req.header("x-request-id") ?? randomUUID();
  res.setHeader("x-request-id", requestId);
  next();
});
app.use(express.json({ limit: "32kb" }));
app.use("/api", apiRateLimit);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

app.get("/api/indexer/health", (_req, res) => {
  res.json({ status: "ok", indexers: getIndexerHealth() });
});

app.get("/api/contracts/status", chainReadRateLimit, async (req, res, next) => {
  try {
    const chainId = toSupportedChainId(req.query.chainId);
    const force = req.query.refresh === "1" || req.query.refresh === "true";
    res.json(await getCachedContractStatus(chainId, force));
  } catch (error) {
    next(error);
  }
});

app.get("/api/player/:address/pending-rounds", chainReadRateLimit, async (req, res, next) => {
  try {
    const chainId = toSupportedChainId(req.query.chainId);
    const scanAll = req.query.scanAll === "1" || req.query.scanAll === "true";
    const rows = await getPendingRoundsForPlayer({ player: req.params.address, chainId, scanAll });
    res.json({ status: "ok", chainId, scanAll, rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/referrals/claim", referralRateLimit, async (req, res, next) => {
  try {
    res.json(await claimReferral(req.body));
  } catch (error) {
    next(error);
  }
});

app.post("/api/badges/claim-signature", async (req, res, next) => {
  try {
    const result = await generateBadgeClaimSignature(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/player/:address/referrals", referralRateLimit, async (req, res, next) => {
  try {
    res.json(await getReferralSummary(req.params.address));
  } catch (error) {
    next(error);
  }
});

app.get("/api/player/:address/lucky-draw", luckyDrawRateLimit, async (req, res, next) => {
  try {
    res.json(await getLuckyDrawSummary(req.params.address));
  } catch (error) {
    next(error);
  }
});

app.get("/api/lucky-draw/history", luckyDrawRateLimit, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const player = typeof req.query.player === "string" && req.query.player.trim() ? req.query.player : null;
    res.json(await getLuckyDrawPublicHistory({
      limit: Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 50,
      offset: Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0,
      player
    }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/player/:address/lucky-draw/claim", luckyDrawClaimRateLimit, async (req, res, next) => {
  try {
    res.json(await claimLuckyDraw(req.params.address, req.body));
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/lucky-draw", adminRateLimit, async (req, res, next) => {
  try {
    await verifyAdminSignature(readAdminQueryAuth(req.query), "admin-read");
    res.json(await getLuckyDrawAdminState());
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/ops", adminRateLimit, async (req, res, next) => {
  try {
    await verifyAdminSignature(readAdminQueryAuth(req.query), "admin-read");
    res.json(await getAdminOpsState());
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/lucky-draw/config", adminRateLimit, async (req, res, next) => {
  try {
    await verifyAdminSignature(req.body, "lucky-draw-config");
    res.json(await updateLuckyDrawConfig(req.body?.config));
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/lucky-draw/result", adminRateLimit, async (req, res, next) => {
  try {
    await verifyAdminSignature(req.body, "lucky-draw-result");
    res.json(await updateLuckyDrawResultStatus(req.body?.result));
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

function readAdminQueryAuth(query: express.Request["query"]) {
  return {
    admin: firstQueryValue(query.admin),
    message: firstQueryValue(query.message),
    signature: firstQueryValue(query.signature)
  };
}

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value : undefined;
}

server.listen(env.PORT, "0.0.0.0", async () => {
  console.log(`[Server] Running on port ${env.PORT} (0.0.0.0)`);
  try {
    const crashEngine = startCrashEngine(io);
    await initEventListeners({ crashEngine });
  } catch (initErr) {
    console.error("[Server] Event listener initialization error:", initErr);
  }
});
