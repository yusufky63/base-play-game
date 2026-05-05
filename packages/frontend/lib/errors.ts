export enum GameErrorCode {
  WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED",
  WRONG_NETWORK = "WRONG_NETWORK",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  TX_REJECTED = "TX_REJECTED",
  VRF_TIMEOUT = "VRF_TIMEOUT",
  ROUND_ACTIVE = "ROUND_ACTIVE",
  CONTRACT_PAUSED = "CONTRACT_PAUSED",
  RPC_ERROR = "RPC_ERROR",
  UNKNOWN = "UNKNOWN"
}

export class GameError extends Error {
  constructor(
    public code: GameErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
  }
}

export function parseContractError(error: unknown): GameError {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("User rejected") || message.includes("user rejected")) {
    return new GameError(GameErrorCode.TX_REJECTED, "Transaction rejected", error);
  }
  if (message.includes("insufficient")) {
    return new GameError(GameErrorCode.INSUFFICIENT_BALANCE, "Insufficient balance", error);
  }
  if (message.includes("ActiveRoundExists")) {
    return new GameError(GameErrorCode.ROUND_ACTIVE, "A round is already active", error);
  }
  if (message.includes("GamePaused")) {
    return new GameError(GameErrorCode.CONTRACT_PAUSED, "Game is temporarily paused", error);
  }
  if (message.includes("rate limit") || message.includes("fetch failed")) {
    return new GameError(GameErrorCode.RPC_ERROR, "Network busy, please retry", error);
  }

  return new GameError(GameErrorCode.UNKNOWN, "Unexpected error", error);
}
