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
      default :'India',
    },
    screen_ids: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Screen',
    },
    location_map: {
      type: String,
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
  
);

const Theater = mongoose.model('Theater', theaterSchema);

module.exports = Theater;
