import express from "express";
import {
  getAvailableSlotsController,
  bookSlotController,
  cancelBookingController,
} from "./bookingController.js";

const router = express.Router();

router.get("/items/:id/available-slots", getAvailableSlotsController);
router.post("/items/:id/book", bookSlotController);

router.patch("/bookings/:id/cancel", cancelBookingController);

export default router;
