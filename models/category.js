import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';

const categorySchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    index: true,
    required: true,
    unique: [true, 'Name must be unique'],
  },
  description: {
    type: String,
    required: true,
  },
  isTA: {
    type: Boolean,
    default: false,
  },
}, {
  strict: false,
});

categorySchema.plugin(timestamps);

export const Category = mongoose.model('Category', categorySchema);
