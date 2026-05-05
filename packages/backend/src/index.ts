import cors from "cors";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { startCrashEngine } from "./services/crashEngine.js";
import { getIndexerHealth, initEventListeners } from "./services/eventListener.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: env.FRONTEND_URL, credentials: true }
});

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL }));
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

app.use(errorHandler);

server.listen(env.PORT, async () => {
  console.log(`[Server] Running on port ${env.PORT}`);
  const crashEngine = startCrashEngine(io);
  await initEventListeners({ crashEngine });
});
