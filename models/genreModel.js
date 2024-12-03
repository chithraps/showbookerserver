const mongoose = require('mongoose');

const genreSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: false,
  },
  blockGenre: {
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
});


genreSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

const Genre = mongoose.model('Genre', genreSchema);

module.exports = Genre;
