import type { Request, Response } from "express";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { nullableText, parseBody, parseId, parsePagination, parsePublished, requiredText } from "../utils/parse";
import { sendSuccess } from "../utils/response";
import { authorSelect } from "../utils/select";

export const createPost = async (req: Request, res: Response) => {
  const body = parseBody(req.body);
  const title = requiredText(body.title, "Title");
  const authorId = parseId(body.authorId);
  const content = body.content === undefined ? undefined : nullableText(body.content, "Content");
  const author = await prisma.user.findUnique({ where: { id: authorId }, select: { id: true } });
  if (!author) throw new HttpError(404, "User tidak ditemukan");
  const post = await prisma.post.create({
    data: { title, content, authorId },
    include: { author: authorSelect },
  });
  sendSuccess(res, 201, "Post berhasil dibuat", post);
};

export const getAllPosts = async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const published = parsePublished(req.query.published);
  if (req.query.search !== undefined && typeof req.query.search !== "string") {
    throw new HttpError(400, "search harus berupa string");
  }
  const search = req.query.search?.trim();
  const where = {
    ...(search && { title: { contains: search, mode: "insensitive" as const } }),
    ...(published !== undefined && { published }),
  };
  const [posts, total] = await prisma.$transaction([
    prisma.post.findMany({
      where, skip, take: limit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { author: authorSelect },
    }),
    prisma.post.count({ where }),
  ], { isolationLevel: "RepeatableRead" });
  sendSuccess(res, 200, "Berhasil mengambil data posts", posts, {
    currentPage: page, limit, totalItems: total, totalPages: Math.ceil(total / limit),
  });
};

export const getPostStats = async (_req: Request, res: Response) => {
  const [overall, perAuthor] = await Promise.all([
    prisma.post.aggregate({
      _count: { id: true }, _sum: { views: true }, _avg: { views: true }, _max: { views: true },
    }),
    prisma.post.groupBy({
      by: ["authorId"], _count: { id: true }, orderBy: { _count: { id: "desc" } },
    }),
  ]);
  sendSuccess(res, 200, "Berhasil mengambil statistik posts", { overall, perAuthor });
};

export const getPostById = async (req: Request, res: Response) => {
  const post = await prisma.post.findUnique({
    where: { id: parseId(req.params.id) }, include: { author: authorSelect },
  });
  if (!post) throw new HttpError(404, "Post tidak ditemukan");
  sendSuccess(res, 200, "Berhasil mengambil data post", post);
};

export const updatePost = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const body = parseBody(req.body);
  const title = body.title === undefined ? undefined : requiredText(body.title, "Title");
  const content = body.content === undefined ? undefined : nullableText(body.content, "Content");
  if (body.published !== undefined && typeof body.published !== "boolean") {
    throw new HttpError(400, "Published harus berupa boolean");
  }
  const published = body.published as boolean | undefined;
  if (title === undefined && content === undefined && published === undefined) {
    throw new HttpError(400, "Isi title, content, dan/atau published untuk diubah");
  }
  const post = await prisma.post.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(published !== undefined && { published }),
    },
    include: { author: authorSelect },
  });
  sendSuccess(res, 200, "Post berhasil diupdate", post);
};

export const deletePost = async (req: Request, res: Response) => {
  await prisma.post.delete({ where: { id: parseId(req.params.id) } });
  sendSuccess(res, 200, "Post berhasil dihapus");
};
