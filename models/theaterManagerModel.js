const mongoose = require('mongoose');

const theaterManagerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  theater_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater', 
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

// Middleware to update the updated_at field on save
theaterManagerSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});


const TheaterManager = mongoose.model('TheaterManager', theaterManagerSchema);

module.exports = TheaterManager;
