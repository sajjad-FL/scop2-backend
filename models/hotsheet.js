import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';

const hotsheetSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    index: true,
    required: true,
  },
  fields: {
    type: Array,
    required: true,
  },
});

hotsheetSchema.plugin(timestamps);

export const Hotsheet = mongoose.model('Hotsheet', hotsheetSchema);
