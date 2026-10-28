import { Router } from "express";
import { createPost, deletePost, getAllPosts, getPostById, getPostStats, updatePost } from "../controllers/postController";

const router = Router();
router.post("/", createPost);
router.get("/", getAllPosts);
router.get("/stats", getPostStats);
router.get("/:id", getPostById);
router.patch("/:id", updatePost);
router.delete("/:id", deletePost);
export default router;
