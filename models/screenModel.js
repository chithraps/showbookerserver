const mongoose = require('mongoose');

const screenSchema  = new mongoose.Schema(
  {
    theater_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Theater', 
      },
      screen_number: {
        type: Number,
        required: true,
      },
      capacity: {
        type: Number,
        required: true,
      },
      sound_system: { 
        type: String, 
        required: true,
      },
      seating_layout_ids: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SeatingLayout', 
      }],
      created_at: {
        type: Date,
        default: Date.now,
      },
      updated_at: {
        type: Date,
        default: Date.now,
      },
  })

  screenSchema.pre('save', function (next) {
    this.updated_at = Date.now();
    next();
  });
  
  const Screen = mongoose.model('Screen', screenSchema);
  
  module.exports = Screen; 