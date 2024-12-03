const mongoose = require('mongoose');

const rowSchema = new mongoose.Schema({
  seating_layout_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SeatingLayout', 
    required: true,
  },
  row_name: {
    type: String,
    required: true,    
  },
  seat_ids: [{ 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seat',
  }],
  space: {
    type: Number,  
    required: true,
    default: 0 
  },
  spacingPosition:{
    type:'String',
    default:'after', 
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

rowSchema.index({ row_name: 1, seating_layout_id: 1 }, { unique: true });

rowSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

const Row = mongoose.model('Row', rowSchema);

module.exports = Row;
