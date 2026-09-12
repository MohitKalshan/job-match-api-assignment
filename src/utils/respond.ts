import type { Response } from "express";
import type { ApiResponse } from "../types/response.js";

// The single place a success body is constructed. Deliberately an explicit call
// rather than middleware that monkey-patches `res.json` — the clever version breaks
// silently the moment someone reaches for `res.send`.
export function respond<T>(res: Response, statusCode: number, data: T[], message: string): void {
  const body: ApiResponse<T> = { statusCode, data, message };
  res.status(statusCode).json(body);
}
