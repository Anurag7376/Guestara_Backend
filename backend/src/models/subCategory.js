import mongoose from "mongoose";

const SubcategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    name: { type: String, required: true, trim: true },
    image: { type: String, default: null },
    description: { type: String, default: null },

    tax_applicable: { type: Boolean, default: null },
    tax_percentage: { type: Number, default: null, min: 0, max: 100 },

    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SubcategorySchema.index({ categoryId: 1, name: 1 }, { unique: true });

SubcategorySchema.pre("validate", function (next) {
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

const Subcategory = mongoose.model("Subcategory", SubcategorySchema);

export default Subcategory;
