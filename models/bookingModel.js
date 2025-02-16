const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
    },
    theaterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theater",
      required: true,
    },
    screenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Screen",
      required: true,
    },
    showDate: {
      type: Date,
      required: true,
    },
    showTime: {
      type: String,
      required: true,
    },
    seatIds: [
      {
        seatId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Seat",
          required: true,
        },
        status: {
          type: String,
          enum: ["Booked", "Canceled"],
          default: "Booked",
        },
        isRefunded: {
          type: Boolean,
          default: false,
        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
    payment: {
      status: {
        type: String,
        enum: ["Pending", "Completed", "Failed"],
        default: "Pending",
      },
      transactionId: {
        type: String,
      },
      method: {
        type: String,
        enum: ["razorpay", "wallet"],
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
    status: {
      type: String,
      enum: ["Confirmed", "Pending", "Canceled", "Expired"],
      default: "Pending",
    },    
    holdExpiresAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
    bookingId: {
      type: String,
      unique: true,
    },
    qrCode: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", BookingSchema);
