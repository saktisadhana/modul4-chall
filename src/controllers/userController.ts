import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import {
  checkEmail, checkName, checkPassword, parseBody, parseId, parsePagination, parsePublished, throwIfInvalid,
} from "../utils/parse";
import { sendSuccess } from "../utils/response";
import { authorSelect, userSummary } from "../utils/select";

export const createUser = async (req: Request, res: Response) => {
  const body = parseBody(req.body);
  throwIfInvalid({
    email: checkEmail(body.email),
    password: checkPassword(body.password),
    name: checkName(body.name),
  });

  // Sudah lolos validasi, jadi aman dianggap string. Email disimpan lowercase.
  const email = (body.email as string).trim().toLowerCase();
  const password = body.password as string;
  const name = typeof body.name === "string" ? body.name.trim() : (body.name as null | undefined);

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
  if (body.email === undefined && body.name === undefined) {
    throw new HttpError(400, "Isi email dan/atau name untuk diubah");
  }
  throwIfInvalid({
    email: body.email === undefined ? null : checkEmail(body.email),
    name: checkName(body.name),
  });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  const name = typeof body.name === "string" ? body.name.trim() : (body.name as null | undefined);

  if (email !== undefined) {
    const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (owner && owner.id !== id) throw new HttpError(409, "Email sudah dipakai user lain");
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