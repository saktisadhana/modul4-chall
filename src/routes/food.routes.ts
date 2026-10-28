import { Router } from "express";

const router = Router();
router.get("/pizza", (_req, res) => { res.status(200).send("Mmm... Pizza... 🍕"); });
router.get("/cookie", (_req, res) => { res.status(200).send("Get some Cookie... 🍪"); });
router.get("/donut", (_req, res) => { res.status(200).send("Do Not... 🍩"); });
export default router;
