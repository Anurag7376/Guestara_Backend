import express from "express";
import { getItemPriceController } from "./item.controller.js";

const router = express.Router();

router.get("/:id/price", getItemPriceController);

export default router;
