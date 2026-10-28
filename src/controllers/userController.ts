import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { nullableText, parseBody, parseId, parsePagination, parsePublished, requiredText } from "../utils/parse";
import { sendSuccess } from "../utils/response";
import { authorSelect, userSummary } from "../utils/select";

export const createUser = async (req: Request, res: Response) => {
  const body = parseBody(req.body);
  const email = requiredText(body.email, "Email");
  requiredText(body.password, "Password");
  const password = body.password as string;
  // bcrypt hanya memproses 72 byte; tolak agar password tidak terpotong diam-diam.
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new HttpError(400, "Password maksimal 72 byte UTF-8");
  }
  const name = body.name === undefined ? undefined : nullableText(body.name, "Name");
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) throw new HttpError(409, "Email sudah terdaftar");

  const user = await prisma.user.create({
    data: { email, name, password: await bcrypt.hash(password, 10) },
    select: { ...userSummary, createdAt: true },
  });
  sendSuccess(res, 201, "User berhasil dibuat", user);
};

export const getAllUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: { ...userSummary, createdAt: true, _count: { select: { posts: true } } },
    orderBy: { id: "asc" },
  });
  sendSuccess(res, 200, "Berhasil mengambil data users", users);
};

export const getUserById = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...userSummary,
      createdAt: true,
      posts: { select: { id: true, title: true, published: true, createdAt: true } },
    },
  });
  if (!user) throw new HttpError(404, "User tidak ditemukan");
  sendSuccess(res, 200, "Berhasil mengambil data user", user);
};

export const updateUser = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const body = parseBody(req.body);
  const email = body.email === undefined ? undefined : requiredText(body.email, "Email");
  const name = body.name === undefined ? undefined : nullableText(body.name, "Name");
  if (email === undefined && name === undefined) {
    throw new HttpError(400, "Isi email dan/atau name untuk diubah");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { ...(email !== undefined && { email }), ...(name !== undefined && { name }) },
    select: { ...userSummary, updatedAt: true },
  });
  sendSuccess(res, 200, "User berhasil diupdate", user);
};

export const deleteUser = async (req: Request, res: Response) => {
  await prisma.user.delete({ where: { id: parseId(req.params.id) } });
  sendSuccess(res, 200, "User berhasil dihapus");
};

export const getUserPosts = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const { page, limit, skip } = parsePagination(req.query);
  const published = parsePublished(req.query.published);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new HttpError(404, "User tidak ditemukan");

  const where = { authorId: id, ...(published !== undefined && { published }) };
  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where, skip, take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { author: authorSelect },
    }),
    prisma.post.count({ where }),
  ], { isolationLevel: "RepeatableRead" });

  sendSuccess(res, 200, "Berhasil mengambil data posts user", posts, {
    currentPage: page, limit, totalItems: total, totalPages: Math.ceil(total / limit),
  });
};
