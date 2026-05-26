import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';
import { CONSTANTS } from '../utils/constants.js';

const { ATTRIBUTE } = CONSTANTS;

const attributeSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
  },
  type: {
    type: String,
    enum: ATTRIBUTE.TYPES,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    validate: {
      validator: function (v) {
        return typeof v === 'string' || typeof v === 'boolean' || typeof v === 'object';
      },
      message: 'Value must be a string, boolean, or object',
    },
  },
  values: {
    type: Array,
  },
});

attributeSchema.plugin(timestamps);

export const Attribute = mongoose.model('Attribute', attributeSchema);
