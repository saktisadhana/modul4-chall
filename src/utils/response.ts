import type { Response } from "express";

export const sendSuccess = (
  res: Response,
  status: number,
  message: string,
  data?: unknown,
  metadata?: Record<string, unknown>,
): void => {
  res.status(status).json({ status: true, message, data, metadata });
};
