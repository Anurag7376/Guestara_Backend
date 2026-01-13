import mongoose from "mongoose";

const AddonSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AddonGroup",
      default: null
    },

    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },

    is_active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

AddonSchema.index({ itemId: 1, name: 1 }, { unique: true });
AddonSchema.index({ groupId: 1, is_active: 1 });

const Addon = mongoose.model("Addon", AddonSchema);

export default Addon;
