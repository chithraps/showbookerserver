const mongoose = require('mongoose');

// Define the admin schema
const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to update the updatedAt field on save
adminSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});


const Admin = mongoose.model('admin', adminSchema);

module.exports = Admin;