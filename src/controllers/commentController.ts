import type { Request, Response } from "express";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { parseBody, parseId, requiredText } from "../utils/parse";
import { sendSuccess } from "../utils/response";
import { userSummary } from "../utils/select";

const commentRelations = {
  user: { select: userSummary },
  post: { select: { id: true, title: true } },
};

export const createComment = async (req: Request, res: Response) => {
  const body = parseBody(req.body);
  const content = requiredText(body.content, "Content");
  const userId = parseId(body.userId);
  const postId = parseId(body.postId);
  const [user, post] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.post.findUnique({ where: { id: postId }, select: { id: true } }),
  ]);
  if (!user) throw new HttpError(404, "User tidak ditemukan");
  if (!post) throw new HttpError(404, "Post tidak ditemukan");
  const comment = await prisma.comment.create({
    data: { content, userId, postId }, include: commentRelations,
  });
  sendSuccess(res, 201, "Comment berhasil dibuat", comment);
};

export const getAllComments = async (_req: Request, res: Response) => {
  const comments = await prisma.comment.findMany({
    include: commentRelations, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  sendSuccess(res, 200, "Berhasil mengambil data comments", comments);
};

export const getCommentById = async (req: Request, res: Response) => {
  const comment = await prisma.comment.findUnique({
    where: { id: parseId(req.params.id) }, include: commentRelations,
  });
  if (!comment) throw new HttpError(404, "Comment tidak ditemukan");
  sendSuccess(res, 200, "Berhasil mengambil data comment", comment);
};

export const updateComment = async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const body = parseBody(req.body);
  const comment = await prisma.comment.update({
    where: { id }, data: { content: requiredText(body.content, "Content") }, include: commentRelations,
  });
  sendSuccess(res, 200, "Comment berhasil diupdate", comment);
};

export const deleteComment = async (req: Request, res: Response) => {
  await prisma.comment.delete({ where: { id: parseId(req.params.id) } });
  sendSuccess(res, 200, "Comment berhasil dihapus");
};
