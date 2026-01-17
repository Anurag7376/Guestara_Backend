import express from "express";
import { rescheduleBookingController } from "../modules/booking/bookingController.js";

const router = express.Router();

router.patch("/bookings/:id/reschedule", rescheduleBookingController);

export default router;
