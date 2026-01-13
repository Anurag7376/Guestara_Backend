import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },

    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },

    dateKey: { type: String, required: true }, // "YYYY-MM-DD"

    status: {
      type: String,
      enum: ["CONFIRMED", "CANCELLED"],
      default: "CONFIRMED"
    },

    customerName: { type: String, default: null },
    customerPhone: { type: String, default: null },

    addonsSelected: [
      {
        addonId: { type: mongoose.Schema.Types.ObjectId, ref: "Addon" },
        name: { type: String },
        price: { type: Number }
      }
    ]
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