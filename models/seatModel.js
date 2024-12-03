const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  seat_number: {
    type: String,
    required: true,
  },
  row_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Row",
    required: true,
  },
  availability: {
    type: Boolean,
    default: true,
  },
  spacing: {
    type: Number,
    default: 0, 
  },
  spacingPosition: {
    type: String, 
    enum: ["before", "after"],
    default: "after", 
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

seatSchema.index({ row_id: 1, seat_number: 1 }, { unique: true });

seatSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

const Seat = mongoose.model('Seat', seatSchema);

module.exports = Seat;
