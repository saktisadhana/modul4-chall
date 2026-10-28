import type { RequestHandler } from "express";

export const logger: RequestHandler = (req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    console.log(`${req.method} ${path} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
};
