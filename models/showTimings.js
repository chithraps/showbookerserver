const mongoose = require('mongoose');

const showTimingsSchema = new mongoose.Schema({
  theater_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true,
  },
  screen_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Screen',
    required: true,
  },
  movie_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true,
  },
  timings: {
    type: [String],
    required: true,
  },
  blockShow :{
    type : Boolean,
    default : false
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

// middleware fn to update update_at
showTimingsSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

const ShowTimings = mongoose.model('ShowTimings', showTimingsSchema);

module.exports = ShowTimings;
