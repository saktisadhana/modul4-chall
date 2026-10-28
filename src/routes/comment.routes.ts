import { Router } from "express";
import { createComment, deleteComment, getAllComments, getCommentById, updateComment } from "../controllers/commentController";

const router = Router();
router.post("/", createComment);
router.get("/", getAllComments);
router.get("/:id", getCommentById);
router.patch("/:id", updateComment);
router.delete("/:id", deleteComment);
export default router;
