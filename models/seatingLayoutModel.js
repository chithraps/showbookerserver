const mongoose = require('mongoose');

const seatingLayoutSchema = new mongoose.Schema({
  screen_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Screen',
  },
  class_name: {
    type: String,
    required: true,
  },
  row_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Row', 
  }],
  seat_capacity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
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

seatingLayoutSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

const SeatingLayout = mongoose.model('SeatingLayout', seatingLayoutSchema);

module.exports = SeatingLayout;
