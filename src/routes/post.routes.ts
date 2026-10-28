import { Router } from "express";
import {
  createPost,
  createPostsBulk,
  deletePost,
  getAllPosts,
  getDailyPostStats,
  getPostById,
  getPostStats,
  updatePost,
} from "../controllers/postController";

const router = Router();
router.post("/bulk", createPostsBulk);
router.post("/", createPost);
router.get("/", getAllPosts);
router.get("/stats", getPostStats);
router.get("/stats/daily", getDailyPostStats);
router.get("/:id", getPostById);
router.patch("/:id", updatePost);
router.delete("/:id", deletePost);
export default router;
