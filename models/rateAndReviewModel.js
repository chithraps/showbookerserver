const mongoose = require("mongoose");

const rateAndReviewSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    movie_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie", 
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1, 
      max: 5, 
    },
    review: {
      type: String,
      maxlength: 1000, 
      trim: true, 
    },    
    createdAt: {
      type: Date,
      default: Date.now, 
    },
    updatedAt: {
      type: Date,
      default: Date.now, 
    },
  },
  { timestamps: true } 
);

const RateAndReview = mongoose.model("RateAndReview", rateAndReviewSchema);

module.exports = RateAndReview;
