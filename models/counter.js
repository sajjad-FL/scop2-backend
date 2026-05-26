import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';

const counterSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true,
  },
  count: {
    type: Number,
    required: true,
    unique: true,
  },
  dtrCount: {
    type: Number,
  },
});

counterSchema.plugin(timestamps);

export const Counter = mongoose.model('Counter', counterSchema);
