import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimit } from "./middleware/rateLimit.js";
import { startCrashEngine } from "./services/crashEngine.js";
import { initEventListeners } from "./services/eventListener.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: env.FRONTEND_URL, credentials: true }
});

app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());
app.use("/api", apiRateLimit);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

app.use(errorHandler);

server.listen(env.PORT, async () => {
  console.log(`[Server] Running on port ${env.PORT}`);
  const crashEngine = startCrashEngine(io);
  await initEventListeners({ crashEngine });
});
