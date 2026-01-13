import mongoose from "mongoose";

const PRICING_TYPES = ["STATIC", "TIERED", "COMPLIMENTARY", "DISCOUNTED", "DYNAMIC_TIME"];
const PARENT_TYPES = ["CATEGORY", "SUBCATEGORY"];

const TierSchema = new mongoose.Schema(
  {
    upto: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const DynamicWindowSchema = new mongoose.Schema(
  {
    start: { type: String, required: true }, // "HH:mm"
    end: { type: String, required: true },   // "HH:mm"
    price: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const AvailabilitySlotSchema = new mongoose.Schema(
  {
    start: { type: String, required: true }, // "HH:mm"
    end: { type: String, required: true }    // "HH:mm"
  },
  { _id: false }
);

const ItemSchema = new mongoose.Schema(
  {
    parentType: { type: String, enum: PARENT_TYPES, required: true },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      default: null
    },

    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    image: { type: String, default: null },

    is_active: { type: Boolean, default: true },

    // Optional tax override (null => inherit)
    tax_applicable: { type: Boolean, default: null },
    tax_percentage: { type: Number, default: null, min: 0, max: 100 },

    pricing: {
      type: {
        type: String,
        enum: PRICING_TYPES,
        required: true
      },
      config: {
        type: mongoose.Schema.Types.Mixed,
        required: true
      }
    },

    // used for sorting/filtering
    priceMeta: {
      minPrice: { type: Number, default: 0, min: 0 },
      maxPrice: { type: Number, default: 0, min: 0 }
    },

    // Booking
    is_bookable: { type: Boolean, default: false },
    availability: {
      timezone: { type: String, default: "Asia/Kolkata" },
      days: { type: [Number], default: [] }, // 1..7
      slots: { type: [AvailabilitySlotSchema], default: [] }
    }
  },
  { timestamps: true }
);

// Unique item name under same parent
ItemSchema.index(
  { parentType: 1, categoryId: 1, subcategoryId: 1, name: 1 },
  { unique: true }
);

// Search
ItemSchema.index({ name: "text", description: "text" });

// Filter/sort helper
ItemSchema.index({ "priceMeta.minPrice": 1 });
ItemSchema.index({ createdAt: -1 });

ItemSchema.pre("validate", function (next) {
  // Parent constraint
  if (this.parentType === "CATEGORY") {
    if (!this.categoryId) {
      return next(new Error("categoryId is required when parentType is CATEGORY"));
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

  // Tax override validation
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