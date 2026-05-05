import type { NextFunction, Request, Response } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("[ErrorHandler]", err);
  res.status(500).json({ error: "Internal server error" });
}
