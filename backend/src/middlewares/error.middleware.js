export default function errorMiddleware(err, req, res, next) {
  const statusMap = {
    INVALID_ITEM_ID: 400,
    INVALID_TIME: 400,
    INVALID_USAGE: 400,
    INVALID_ADDONS: 400,
    PRICING_NOT_CONFIGURED: 400,
    INVALID_PRICING_CONFIG: 400,
    USAGE_REQUIRED: 400,
    TIME_REQUIRED: 400,
    NO_TIER_MATCH: 400,
    UNKNOWN_PRICING_TYPE: 400,
    ITEM_NOT_AVAILABLE: 409,
    ITEM_NOT_BOOKABLE: 400,
    AVAILABILITY_NOT_CONFIGURED: 400,
    INVALID_DATE: 400,
    INVALID_SLOT: 400,
    SLOT_NOT_AVAILABLE: 409,
    SLOT_ALREADY_BOOKED: 409,
    ITEM_NOT_FOUND: 404,
    CATEGORY_NOT_FOUND: 404,
    SUBCATEGORY_NOT_FOUND: 404,
    ITEM_INACTIVE: 403,
  };

  const status = statusMap[err.code] || 500;

  return res.status(status).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message: err.message || "Something went wrong",
    },
  });
}
