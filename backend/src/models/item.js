import mongoose from "mongoose";

const PRICING_TYPES = [
  "STATIC",
  "TIERED",
  "COMPLIMENTARY",
  "DISCOUNTED",
  "DYNAMIC_TIME",
];
const PARENT_TYPES = ["CATEGORY", "SUBCATEGORY"];

const TierSchema = new mongoose.Schema(
  {
    upto: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const DynamicWindowSchema = new mongoose.Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const AvailabilityWindowSchema = new mongoose.Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema(
  {
    parentType: { type: String, enum: PARENT_TYPES, required: true },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      default: null,
    },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    image: { type: String, default: null },

    is_active: { type: Boolean, default: true },

    tax_applicable: { type: Boolean, default: null },
    tax_percentage: { type: Number, default: null, min: 0, max: 100 },

    pricing: {
      type: {
        type: String,
        enum: PRICING_TYPES,
        required: true,
      },
      config: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
    },

    priceMeta: {
      minPrice: { type: Number, default: 0, min: 0 },
      maxPrice: { type: Number, default: 0, min: 0 },
    },

    is_bookable: { type: Boolean, default: false },
    availability: {
      timezone: { type: String, default: "Asia/Kolkata" },

      days: { type: [Number], default: [] },

      windows: { type: [AvailabilityWindowSchema], default: [] },

      slotDurationMinutes: { type: Number, default: 60, min: 15 },
    },
  },
  { timestamps: true }
);

ItemSchema.index(
  { parentType: 1, categoryId: 1, subcategoryId: 1, name: 1 },
  { unique: true }
);

ItemSchema.index({ name: "text", description: "text" });
ItemSchema.index({ "priceMeta.minPrice": 1 });
ItemSchema.index({ createdAt: -1 });
ItemSchema.pre("validate", function (next) {
  
  if (this.parentType === "CATEGORY") {
    if (!this.categoryId) {
      return next(
        new Error("categoryId is required when parentType is CATEGORY")
      );
    }
    this.subcategoryId = null;
  }

  if (this.parentType === "SUBCATEGORY") {
    if (!this.subcategoryId) {
      return next(
        new Error("subcategoryId is required when parentType is SUBCATEGORY")
      );
    }
    this.categoryId = null;
  }
  
  if (
    this.tax_applicable === true &&
    (this.tax_percentage === null || this.tax_percentage === undefined)
  ) {
    return next(
      new Error("tax_percentage is required when tax_applicable is true")
    );
  }

  if (this.tax_applicable === false) {
    this.tax_percentage = null;
  }

  next();
});

const Item = mongoose.model("Item", ItemSchema);

export default Item;
