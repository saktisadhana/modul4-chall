import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { HttpError } from "../utils/http-error";

const fail = (res: Response, status: number, message: string): void => {
  res.status(status).json({ status: false, message });
};

export const notFound: RequestHandler = (req, res) => {
  fail(res, 404, `Endpoint ${req.method} ${req.path} tidak ditemukan`);
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    fail(res, err.status, err.message);
    return;
  }
  if (typeof err === "object" && err !== null) {
    if ("code" in err) {
      if (err.code === "P2002") return fail(res, 409, "Data sudah ada (nilai unik bentrok)");
      if (err.code === "P2025") return fail(res, 404, "Data tidak ditemukan");
      if (err.code === "P2003") return fail(res, 400, "Relasi data tidak valid");
    }
    if ("status" in err && typeof err.status === "number" && err.status >= 400 && err.status < 500) {
      return fail(res, err.status, "Request tidak valid (cek format dan ukuran body)");
    }
  }
  // Jangan mencetak body, connection string, atau pesan driver yang bisa memuat rahasia.
  console.error("Request gagal karena error internal", err instanceof Error ? err.name : "UnknownError");
  fail(res, 500, "Terjadi kesalahan pada server");
};
