const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: false,
  },
  lastName: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    unique: true, 
    sparse: true,
    required: false,
  },
  googleId: {
    type: String,
    unique: true, 
    sparse: true,
    required: false,
  },
  mobileNumber: {
    type: String,
    unique: true, 
    sparse: true,
    required: false,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  blockUser: {
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
const users = mongoose.model("users", userSchema);
module.exports = users;
