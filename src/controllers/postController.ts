import type { Request, Response } from "express";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { nullableText, parseBody, parseId, parsePagination, parsePublished, requiredText } from "../utils/parse";
import { sendSuccess } from "../utils/response";
import { authorSelect } from "../utils/select";

const parsePostBulkItem = (item: unknown, index: number) => {
  const body = parseBody(item);
  const title = requiredText(body.title, `Title item ke-${index + 1}`);
  const authorId = parseId(body.authorId);
  const content = body.content === undefined ? undefined : nullableText(body.content, `Content item ke-${index + 1}`);
  if (body.published !== undefined && typeof body.published !== "boolean") {
    throw new HttpError(400, `Published item ke-${index + 1} harus berupa boolean`);
  }
  return {
    title,
    authorId,
    ...(content !== undefined && { content }),
    ...(body.published !== undefined && { published: body.published }),
  };
};

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

export const createPostsBulk = async (req: Request, res: Response) => {
  if (!Array.isArray(req.body)) {
    throw new HttpError(400, "Body harus berupa array post");
  }
  if (req.body.length === 0) {
    throw new HttpError(400, "Array post tidak boleh kosong");
  }

  const posts = req.body.map(parsePostBulkItem);
  const authorIds = [...new Set(posts.map((post) => post.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true },
  });
  const foundAuthorIds = new Set(authors.map((author) => author.id));
  const missingAuthorId = posts.find((post) => !foundAuthorIds.has(post.authorId));
  if (missingAuthorId) {
    throw new HttpError(404, `User dengan ID ${missingAuthorId.authorId} tidak ditemukan`);
  }

  const result = await prisma.post.createMany({ data: posts });
  sendSuccess(res, 201, "Post berhasil dibuat secara bulk", { count: result.count, posts });
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

export const getDailyPostStats = async (_req: Request, res: Response) => {
  const stats = await prisma.$queryRaw<Array<{
    day: string;
    totalPosts: number;
    totalViews: number;
  }>>`
    SELECT
      date_trunc('day', "createdAt")::date AS "day",
      COUNT(*)::int AS "totalPosts",
      COALESCE(SUM("views"), 0)::int AS "totalViews"
    FROM "Post"
    GROUP BY date_trunc('day', "createdAt")
    ORDER BY "day" ASC
  `;
  sendSuccess(res, 200, "Berhasil mengambil statistik harian posts", stats);
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
