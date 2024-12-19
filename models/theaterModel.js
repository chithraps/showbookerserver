const mongoose = require('mongoose');

const theaterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      default: 'India',
    },
    screen_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Screen',
    },
    location_map: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false, 
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, 
  }
);

theaterSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

const Theater = mongoose.model('Theater', theaterSchema);

module.exports = Theater;
