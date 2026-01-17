import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    usage: {
      type: Number,
      default: null,
      min: 0,
    },

    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },

    dateKey: { type: String, required: true },

    status: {
      type: String,
      enum: ["CONFIRMED", "CANCELLED"],
      default: "CONFIRMED",
    },

    customerName: { type: String, default: null },
    customerPhone: { type: String, default: null },

    addonsSelected: [
      {
        addonId: { type: mongoose.Schema.Types.ObjectId, ref: "Addon" },
        name: { type: String },
        price: { type: Number },
      },
    ],
    invoiceSnapshot: {
      basePrice: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
      addonsTotal: { type: Number, default: 0 },
      subtotal: { type: Number, default: 0 },

      taxApplicable: { type: Boolean, default: false },
      taxPercentage: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },

      grandTotal: { type: Number, default: 0 },
      finalPayable: { type: Number, default: 0 },

      pricingType: { type: String, default: null },
      pricingRule: { type: Object, default: null },
      calculatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

BookingSchema.index({ itemId: 1, dateKey: 1, status: 1 });
BookingSchema.index({ itemId: 1, startDateTime: 1, endDateTime: 1, status: 1 });

BookingSchema.pre("validate", function (next) {
  if (this.startDateTime >= this.endDateTime) {
    return next(new Error("startDateTime must be less than endDateTime"));
  }
  next();
});

const Booking = mongoose.model("Booking", BookingSchema);

export default Booking;
