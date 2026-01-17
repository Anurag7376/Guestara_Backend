import {
  getAvailableSlots,
  bookSlot,
  cancelBooking,
  rescheduleBooking,
} from "./bookingService.js";

export async function getAvailableSlotsController(req, res, next) {
  try {
    const itemId = req.params.id;
    const dateKey = req.query.date;
    const data = await getAvailableSlots({ itemId, dateKey });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function bookSlotController(req, res, next) {
  try {
    const itemId = req.params.id;
    const {
      date,
      startTime,
      endTime,
      customerName,
      customerPhone,
      addonsSelected,
    } = req.body;
    const data = await bookSlot({
      itemId,
      dateKey: date,
      startTime,
      endTime,
      customerName,
      customerPhone,
      addonsSelected,
    });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function cancelBookingController(req, res, next) {
  try {
    const bookingId = req.params.id;
    const data = await cancelBooking({ bookingId });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function rescheduleBookingController(req, res, next) {
  try {
    const bookingId = req.params.id;
    const { date, startTime, endTime, addonsSelected, usage } = req.body;
    const customerId = req.user?._id || null;
    const data = await rescheduleBooking({
      bookingId,
      dateKey: date,
      startTime,
      endTime,
      addonsSelected,
      usage,
      customerId,
    });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
