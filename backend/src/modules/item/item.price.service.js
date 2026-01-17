import mongoose from "mongoose";
import Item from "../../models/item.js";
import Category from "../../models/category.js";
import Subcategory from "../../models/subCategory.js";
import Addon from "../../models/addOn.js";
import AddonGroup from "../../models/addOnGroups.js";

import { resolvePricing } from "./pricing/pricing.engine.js";
import { isValidHHMM } from "../../utils/time.js";

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

async function validateAndSumAddons({ itemId, addonIds }) {
  if (!addonIds || addonIds.length === 0) {
    return { addons: [], addonsTotal: 0 };
  }

  const addons = await Addon.find({
    _id: { $in: addonIds },
    itemId: itemId,
    is_active: true,
  }).lean();

  if (addons.length !== addonIds.length) {
    throw {
      code: "INVALID_ADDONS",
      message:
        "One or more addons are invalid/inactive or not part of this item.",
    };
  }

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
          message: `Addon group '${g.name}' requires at least ${g.minSelect} selection(s).`,
        };
      }

      if (count > g.maxSelect) {
        throw {
          code: "ADDON_GROUP_LIMIT_EXCEEDED",
          message: `Addon group '${g.name}' allows at most ${g.maxSelect} selection(s).`,
        };
      }

      if (g.selectionType === "SINGLE" && count > 1) {
        throw {
          code: "ADDON_GROUP_SINGLE_ONLY",
          message: `Addon group '${g.name}' allows only 1 selection.`,
        };
      }
    }
  }

  const addonsTotal = addons.reduce((sum, a) => sum + (a.price || 0), 0);

  return { addons, addonsTotal };
}

async function getItemPriceDetails({ itemId, time, usage, addonIds }) {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw { code: "INVALID_ITEM_ID", message: "Invalid item id." };
  }

  if (time && !isValidHHMM(time)) {
    throw { code: "INVALID_TIME", message: "time must be in HH:mm format." };
  }

  if (usage !== undefined && usage !== null) {
    const u = Number(usage);
    if (Number.isNaN(u) || u <= 0) {
      throw {
        code: "INVALID_USAGE",
        message: "usage must be a positive number.",
      };
    }
    usage = u;
  }

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

  if (!effectiveActive) {
    throw {
      code: "ITEM_INACTIVE",
      message: "Item is inactive due to soft delete.",
    };
  }
  const effectiveTax = resolveEffectiveTax({ item, category, subcategory });

  const { basePrice, discount, appliedRule } = resolvePricing({
    item,
    usage,
    time,
  });
  const { addons, addonsTotal } = await validateAndSumAddons({
    itemId: item._id,
    addonIds,
  });
  const discountAmount = discount ? discount.amount : 0;
  let subtotal = basePrice - discountAmount + addonsTotal;
  if (subtotal < 0) subtotal = 0;
  const taxAmount = effectiveTax.applicable
    ? (subtotal * effectiveTax.percentage) / 100
    : 0;

  const grandTotal = subtotal + taxAmount;

  return {
    itemId: String(item._id),
    itemName: item.name,

    pricingType: item.pricing.type,
    appliedRule,

    basePrice,
    discount: discount
      ? {
          type: discount.type,
          value: discount.value,
          amount: discount.amount,
        }
      : null,

    addons: addons.map((a) => ({
      addonId: String(a._id),
      name: a.name,
      price: a.price,
    })),
    addonsTotal,

    subtotal,

    tax: {
      applicable: effectiveTax.applicable,
      percentage: effectiveTax.percentage,
      amount: taxAmount,
      source: effectiveTax.source,
    },

    grandTotal,
    finalPayable: grandTotal,
  };
}

export { getItemPriceDetails };
