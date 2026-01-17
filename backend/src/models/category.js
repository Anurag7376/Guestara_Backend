import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    image: { type: String, default: null },
    description: { type: String, default: null },

    tax_applicable: { type: Boolean, required: true },
    tax_percentage: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },

    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1 }, { unique: true });

CategorySchema.pre("validate", function (next) {
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

const Category = mongoose.model("Category", CategorySchema);

export default Category;
