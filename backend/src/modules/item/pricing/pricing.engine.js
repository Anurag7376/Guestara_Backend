import { isTimeInWindow } from "../../../utils/time.js";

export function resolvePricing({ item, usage, time }) {
  const { pricing } = item;

  if (!pricing || !pricing.type) {
    throw {
      code: "PRICING_NOT_CONFIGURED",
      message: "Pricing not configured for this item.",
    };
  }

  const type = pricing.type;
  const config = pricing.config || {};

  let appliedRule = { type };
  let basePrice = 0;
  let discount = null;

  if (type === "STATIC") {
    if (typeof config.price !== "number")
      throw {
        code: "INVALID_PRICING_CONFIG",
        message: "Static price missing.",
      };
    basePrice = config.price;
    appliedRule.price = basePrice;
  } else if (type === "COMPLIMENTARY") {
    basePrice = 0;
    appliedRule.price = 0;
  } else if (type === "DISCOUNTED") {
    const { basePrice: bp, discountType, discountValue } = config;
    if (typeof bp !== "number" || bp < 0)
      throw {
        code: "INVALID_PRICING_CONFIG",
        message: "basePrice invalid for discounted pricing.",
      };
    if (!["FLAT", "PERCENT"].includes(discountType))
      throw {
        code: "INVALID_PRICING_CONFIG",
        message: "discountType must be FLAT or PERCENT.",
      };
    if (typeof discountValue !== "number" || discountValue < 0)
      throw {
        code: "INVALID_PRICING_CONFIG",
        message: "discountValue invalid.",
      };
    basePrice = bp;
    let discountAmount = 0;
    if (discountType === "FLAT") discountAmount = discountValue;
    else {
      if (discountValue > 100)
        throw {
          code: "INVALID_PRICING_CONFIG",
          message: "Percentage discount cannot exceed 100.",
        };
      discountAmount = (basePrice * discountValue) / 100;
    }
    discountAmount = Math.min(discountAmount, basePrice);
    discount = {
      type: discountType,
      value: discountValue,
      amount: discountAmount,
    };
    appliedRule.basePrice = basePrice;
    appliedRule.discount = discount;
  } else if (type === "TIERED") {
    const tiers = config.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0)
      throw {
        code: "INVALID_PRICING_CONFIG",
        message: "Tiered pricing requires tiers array.",
      };
    if (typeof usage !== "number" || usage <= 0)
      throw {
        code: "USAGE_REQUIRED",
        message: "usage query param required for tiered pricing.",
      };
    const sorted = [...tiers].sort((a, b) => a.upto - b.upto);
    const selectedTier = sorted.find((t) => usage <= t.upto);
    if (!selectedTier)
      throw {
        code: "NO_TIER_MATCH",
        message: `No tier matched for usage=${usage}.`,
      };
    basePrice = selectedTier.price;
    appliedRule.selectedTier = selectedTier;
    appliedRule.usage = usage;
  } else if (type === "DYNAMIC_TIME") {
    const windows = config.windows;
    const unavailableOutside = !!config.unavailableOutside;
    if (!Array.isArray(windows) || windows.length === 0)
      throw {
        code: "INVALID_PRICING_CONFIG",
        message: "Dynamic pricing requires windows.",
      };
    if (!time)
      throw {
        code: "TIME_REQUIRED",
        message: "time query param required for dynamic time pricing.",
      };
    const matched = windows.find((w) => isTimeInWindow(time, w.start, w.end));
    if (!matched) {
      if (unavailableOutside)
        throw {
          code: "ITEM_NOT_AVAILABLE",
          message: "Item not available at this time.",
        };
      basePrice = 0;
      appliedRule.matchedWindow = null;
    } else {
      basePrice = matched.price;
      appliedRule.matchedWindow = matched;
      appliedRule.requestTime = time;
    }
  } else {
    throw {
      code: "UNKNOWN_PRICING_TYPE",
      message: `Unknown pricing type: ${type}`,
    };
  }

  if (basePrice < 0) basePrice = 0;

  return { basePrice, discount, appliedRule };
}
