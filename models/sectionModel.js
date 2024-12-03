const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  seating_layout_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SeatingLayout', // Reference to the SeatingLayouts collection
    required: true,
  },
  section_name: {
    type: String,
    required: true,
  },
  row_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Row', // Reference to the Rows collection
    required: true,
  }],
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// unique index to seating_layout_id and section_name
sectionSchema.index({ seating_layout_id: 1, section_name: 1 }, { unique: true });

sectionSchema.pre('save', function (next) {
  this.updated_at = Date.now();
  next();
});

const Section = mongoose.model('Section', sectionSchema);

module.exports = Section;
