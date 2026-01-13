import mongoose from "mongoose";

const AddonGroupSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },

    name: { type: String, required: true, trim: true },

    selectionType: { type: String, enum: ["SINGLE", "MULTI"], required: true },
    minSelect: { type: Number, default: 0, min: 0 },
    maxSelect: { type: Number, required: true, min: 1 },

    is_active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

AddonGroupSchema.index({ itemId: 1, is_active: 1 });

AddonGroupSchema.pre("validate", function (next) {
  if (this.minSelect > this.maxSelect) {
    return next(new Error("minSelect cannot be greater than maxSelect"));
  }
  next();
});

const AddonGroup = mongoose.model("AddonGroup", AddonGroupSchema);

export default AddonGroup;