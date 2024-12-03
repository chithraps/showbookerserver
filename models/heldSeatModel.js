const mongoose = require("mongoose");

const heldSeatSchema = new mongoose.Schema({
  userId: { type: String, required: true }, 
  screenId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Screen",
    required: true,
  },
  showDate: { type: Date, required: true },
  showTime: { type: String, required: true },
  seatIds: [{ type: String, required: true }], 
  holdTime: { type: Date, default: Date.now, required: true },
});

const HeldSeat = mongoose.model("HeldSeat", heldSeatSchema);

module.exports = HeldSeat;
