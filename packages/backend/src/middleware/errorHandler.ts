import type { NextFunction, Request, Response } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[ErrorHandler]", err);
  const statusCode = (err as unknown as { statusCode?: unknown }).statusCode;
  const status = typeof statusCode === "number" ? statusCode : 500;
  res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message });
}
