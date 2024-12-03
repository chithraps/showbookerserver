const mongoose = require('mongoose');

const castSchema = new mongoose.Schema({
  actor_name: {
    type: String,
    required: true,
  },
  character_name: {  
    type: String,
    required: true,
  },
});

const crewSchema = new mongoose.Schema({
  crew_member: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
});

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  genre_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre',
    required: true,
  },
  release_date: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
  },
  poster: {
    type: String,
    required: true, 
  },
  trailer_url: {
    type: String,
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
  blockMovies: {
    type: Boolean,
    default: false,
  },
  cast: [castSchema],
  crew: [crewSchema],
});

// Middleware to update the `updated_at` field before saving
movieSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

const Movie = mongoose.model('Movie', movieSchema);

module.exports = Movie;
