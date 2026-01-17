import mongoose from "mongoose";
import Booking from "../../models/booking.js";
import Item from "../../models/item.js";
import Category from "../../models/category.js";
import Subcategory from "../../models/subCategory.js";
import Addon from "../../models/addOn.js";
import AddonGroup from "../../models/addOnGroups.js";

import { BOOKING_LIMITS } from "../../config/booking.config.js";
import { generateSlotsFromWindows } from "../../utils/slot.generator.js";
import { toDateTime, isValidDateKey } from "../../utils/dateTime.utils.js";
import { isValidHHMM } from "../../utils/time.js";

import { resolvePricing } from "../item/pricing/pricing.engine.js";

function getDayOfWeekNumber(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

async function getItemWithParents(itemId) {
  const item = await Item.findById(itemId).lean();
  if (!item) throw { code: "ITEM_NOT_FOUND", message: "Item not found." };

  let category = null;
  let subcategory = null;

  if (item.parentType === "CATEGORY") {
    category = await Category.findById(item.categoryId).lean();
    if (!category)
      throw {
        code: "CATEGORY_NOT_FOUND",
        message: "Parent category not found.",
      };
  } else {
    subcategory = await Subcategory.findById(item.subcategoryId).lean();
    if (!subcategory)
      throw {
        code: "SUBCATEGORY_NOT_FOUND",
        message: "Parent subcategory not found.",
      };

    category = await Category.findById(subcategory.categoryId).lean();
    if (!category)
      throw {
        code: "CATEGORY_NOT_FOUND",
        message: "Parent category not found.",
      };
  }

  const effectiveActive =
    item.is_active === true &&
    category.is_active === true &&
    (item.parentType === "CATEGORY" ? true : subcategory.is_active === true);

  return { item, category, subcategory, effectiveActive };
}

function validateItemBookable(item) {
  if (!item.is_bookable)
    throw { code: "ITEM_NOT_BOOKABLE", message: "This item is not bookable." };

  if (!item.availability?.days?.length) {
    throw {
      code: "AVAILABILITY_NOT_CONFIGURED",
      message: "Availability days not configured.",
    };
  }
  if (!item.availability?.windows?.length) {
    throw {
      code: "AVAILABILITY_NOT_CONFIGURED",
      message: "Availability windows not configured.",
    };
  }
  if (
    !item.availability?.slotDurationMinutes ||
    item.availability.slotDurationMinutes <= 0
  ) {
    throw {
      code: "AVAILABILITY_NOT_CONFIGURED",
      message: "slotDurationMinutes not configured.",
    };
  }
}

function validateDateKey(dateKey) {
  if (!isValidDateKey(dateKey))
    throw { code: "INVALID_DATE", message: "date must be YYYY-MM-DD." };
}
function validateSlotPayload(startTime, endTime) {
  if (!isValidHHMM(startTime) || !isValidHHMM(endTime)) {
    throw { code: "INVALID_SLOT", message: "startTime/endTime must be HH:mm." };
  }
}

function resolveEffectiveTax({ item, category, subcategory }) {
  if (item.tax_applicable !== null && item.tax_applicable !== undefined) {
    return {
      applicable: item.tax_applicable,
      percentage: item.tax_applicable ? item.tax_percentage : 0,
      source: "ITEM",
    };
  }

  if (
    subcategory &&
    subcategory.tax_applicable !== null &&
    subcategory.tax_applicable !== undefined
  ) {
    return {
      applicable: subcategory.tax_applicable,
      percentage: subcategory.tax_applicable ? subcategory.tax_percentage : 0,
      source: "SUBCATEGORY",
    };
  }

  return {
    applicable: category.tax_applicable,
    percentage: category.tax_applicable ? category.tax_percentage : 0,
    source: "CATEGORY",
  };
}

async function validateAndFetchAddons({ itemId, addonIds }) {
  if (!addonIds || addonIds.length === 0) {
    return { addons: [], addonsTotal: 0 };
  }

  const addons = await Addon.find({
    _id: { $in: addonIds },
    itemId,
    is_active: true,
  }).lean();

  if (addons.length !== addonIds.length)
    throw {
      code: "INVALID_ADDONS",
      message: "Invalid/inactive addon selected.",
    };

  const groups = await AddonGroup.find({ itemId, is_active: true }).lean();
  if (groups.length > 0) {
    const selectedByGroup = new Map();
    for (const a of addons) {
      if (a.groupId) {
        const gid = String(a.groupId);
        selectedByGroup.set(gid, (selectedByGroup.get(gid) || 0) + 1);
      }
    }

    for (const g of groups) {
      const gid = String(g._id);
      const count = selectedByGroup.get(gid) || 0;

      if (g.minSelect > 0 && count < g.minSelect) {
        throw {
          code: "ADDON_GROUP_REQUIREMENT_FAILED",
          message: `Group '${g.name}' requires ${g.minSelect}`,
        };
      }
      if (count > g.maxSelect) {
        throw {
          code: "ADDON_GROUP_LIMIT_EXCEEDED",
          message: `Group '${g.name}' max ${g.maxSelect}`,
        };
      }
      if (g.selectionType === "SINGLE" && count > 1) {
        throw {
          code: "ADDON_GROUP_SINGLE_ONLY",
          message: `Group '${g.name}' allows only 1`,
        };
      }
    }
  }

  const addonsTotal = addons.reduce((sum, a) => sum + a.price, 0);
  return { addons, addonsTotal };
}

async function enforceDailyBookingLimit({
  customerId,
  dateKey,
  session,
  excludeBookingId = null,
}) {
  if (!customerId) return;

  const query = {
    customerId,
    dateKey,
    status: "CONFIRMED",
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const count = await Booking.countDocuments(query).session(session);

  if (count >= BOOKING_LIMITS.MAX_PER_DAY_PER_CUSTOMER) {
    throw {
      code: "BOOKING_LIMIT_EXCEEDED",
      message: `Daily booking limit reached (${BOOKING_LIMITS.MAX_PER_DAY_PER_CUSTOMER}).`,
    };
  }
}

function validateSlotAgainstAvailability({
  item,
  dateKey,
  startTime,
  endTime,
}) {
  const dayNum = getDayOfWeekNumber(dateKey);
  if (!item.availability.days.includes(dayNum)) {
    throw { code: "SLOT_NOT_AVAILABLE", message: "Not available on this day." };
  }
  const validSlots = generateSlotsFromWindows(
    item.availability.windows,
    item.availability.slotDurationMinutes
  );
  const slotKey = `${startTime}-${endTime}`;
  const validKeys = new Set(validSlots.map((s) => `${s.start}-${s.end}`));

  if (!validKeys.has(slotKey)) {
    throw {
      code: "SLOT_NOT_AVAILABLE",
      message: "Invalid slot for this item.",
    };
  }
}

export async function getAvailableSlots({ itemId, dateKey }) {
  if (!mongoose.Types.ObjectId.isValid(itemId))
    throw { code: "INVALID_ITEM_ID", message: "Invalid item id." };
  if (!isValidDateKey(dateKey))
    throw { code: "INVALID_DATE", message: "date must be YYYY-MM-DD." };

  const item = await Item.findById(itemId).lean();
  if (!item) throw { code: "ITEM_NOT_FOUND", message: "Item not found." };

  if (!item.is_bookable)
    throw { code: "ITEM_NOT_BOOKABLE", message: "This item is not bookable." };

  const dayNum = getDayOfWeekNumber(dateKey);
  if (!item.availability.days.includes(dayNum)) return [];

  const slots = generateSlotsFromWindows(
    item.availability.windows,
    item.availability.slotDurationMinutes
  );

  return slots;
}

export async function bookSlot({
  itemId,
  dateKey,
  startTime,
  endTime,
  customerName,
  customerPhone,
  addonsSelected,
  usage,
}) {
  if (!mongoose.Types.ObjectId.isValid(itemId))
    throw { code: "INVALID_ITEM_ID", message: "Invalid item id." };
  validateDateKey(dateKey);
  validateSlotPayload(startTime, endTime);

  const item = await Item.findById(itemId).lean();
  if (!item) throw { code: "ITEM_NOT_FOUND", message: "Item not found." };
  validateItemBookable(item);
  validateSlotAgainstAvailability({ item, dateKey, startTime, endTime });

  const startDateTime = toDateTime(dateKey, startTime);
  const endDateTime = toDateTime(dateKey, endTime);

  const conflict = await Booking.findOne({
    itemId,
    status: "CONFIRMED",
    startDateTime: { $lt: endDateTime },
    endDateTime: { $gt: startDateTime },
  }).lean();
  if (conflict)
    throw { code: "SLOT_ALREADY_BOOKED", message: "Slot already booked." };

  const booking = new Booking({
    itemId,
    dateKey,
    startDateTime,
    endDateTime,
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    addonsSelected: [],
    usage: usage || null,
  });
  await booking.save();

  return {
    bookingId: String(booking._id),
    status: booking.status,
    date: booking.dateKey,
    startTime,
    endTime,
  };
}

export async function cancelBooking({ bookingId }) {
  if (!mongoose.Types.ObjectId.isValid(bookingId))
    throw { code: "INVALID_BOOKING_ID", message: "Invalid booking id." };
  const booking = await Booking.findById(bookingId);
  if (!booking)
    throw { code: "BOOKING_NOT_FOUND", message: "Booking not found." };
  booking.status = "CANCELLED";
  await booking.save();
  return { bookingId: String(booking._id), status: booking.status };
}

export async function rescheduleBooking({
  bookingId,
  dateKey,
  startTime,
  endTime,
  addonsSelected,
  usage,
  customerId,
}) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw { code: "INVALID_BOOKING_ID", message: "Invalid booking id." };
  }

  validateDateKey(dateKey);
  validateSlotPayload(startTime, endTime);

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking)
      throw { code: "BOOKING_NOT_FOUND", message: "Booking not found." };

    if (booking.status !== "CONFIRMED") {
      throw {
        code: "BOOKING_NOT_ACTIVE",
        message: "Only confirmed bookings can be rescheduled.",
      };
    }

    if (
      customerId &&
      booking.customerId &&
      String(booking.customerId) !== String(customerId)
    ) {
      throw {
        code: "FORBIDDEN",
        message: "You cannot reschedule this booking.",
      };
    }

    const { item, category, subcategory, effectiveActive } =
      await getItemWithParents(booking.itemId);
    if (!effectiveActive)
      throw { code: "ITEM_INACTIVE", message: "Item inactive." };

    validateItemBookable(item);

    validateSlotAgainstAvailability({ item, dateKey, startTime, endTime });

    const startDateTime = toDateTime(dateKey, startTime);
    const endDateTime = toDateTime(dateKey, endTime);

    await enforceDailyBookingLimit({
      customerId: booking.customerId || customerId,
      dateKey,
      session,
      excludeBookingId: booking._id,
    });

    const conflict = await Booking.findOne(
      {
        _id: { $ne: booking._id },
        itemId: booking.itemId,
        status: "CONFIRMED",
        startDateTime: { $lt: endDateTime },
        endDateTime: { $gt: startDateTime },
      },
      null,
      { session }
    ).lean();

    if (conflict) {
      throw {
        code: "SLOT_ALREADY_BOOKED",
        message: "Slot conflicts with another booking.",
      };
    }

    const finalUsage =
      usage !== undefined && usage !== null ? Number(usage) : booking.usage;

    const { basePrice, discount, appliedRule } = resolvePricing({
      item,
      usage: finalUsage,
      time: startTime,
    });

    const addonIds = Array.isArray(addonsSelected) ? addonsSelected : [];
    const { addons, addonsTotal } = await validateAndFetchAddons({
      itemId: item._id,
      addonIds,
    });

    const effectiveTax = resolveEffectiveTax({ item, category, subcategory });

    const discountAmount = discount ? discount.amount : 0;
    let subtotal = basePrice - discountAmount + addonsTotal;
    if (subtotal < 0) subtotal = 0;

    const taxAmount = effectiveTax.applicable
      ? (subtotal * effectiveTax.percentage) / 100
      : 0;
    const grandTotal = subtotal + taxAmount;

    booking.dateKey = dateKey;
    booking.startDateTime = startDateTime;
    booking.endDateTime = endDateTime;

    booking.usage = finalUsage || null;

    booking.addonsSelected = addons.map((a) => ({
      addonId: a._id,
      name: a.name,
      price: a.price,
    }));

    booking.invoiceSnapshot = {
      basePrice,
      discountAmount,
      addonsTotal,
      subtotal,

      taxApplicable: effectiveTax.applicable,
      taxPercentage: effectiveTax.percentage,
      taxAmount,

      grandTotal,
      finalPayable: grandTotal,

      pricingType: item.pricing.type,
      pricingRule: appliedRule,
      calculatedAt: new Date(),
    };

    await booking.save({ session });

    await session.commitTransaction();

    return {
      bookingId: String(booking._id),
      status: booking.status,
      date: booking.dateKey,
      startTime,
      endTime,
      usage: booking.usage,
      invoiceSnapshot: booking.invoiceSnapshot,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
