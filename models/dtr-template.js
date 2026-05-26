import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';
import { CONSTANTS } from '../utils/constants.js';

const { ATTRIBUTE } = CONSTANTS;

const dtrTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    index: true,
    required: true,
  },
  categoryId: {
    type: String,
    required: true,
    ref: 'Category',
  },
  previousTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Type',
  },
  attributes: [{
    name: {
      type: String,
    },
    type: {
      type: String,
      enum: ATTRIBUTE.TYPES,
    },
    values: {
      type: Array,
    },
    isRequired: {
      type: Boolean,
    },
    mode: {
      type: String,
      default: 'type',
    },
  }],
  isEnabled: {
    type: Boolean,
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  htmlFile: {
    type: Object,
  },
  templateHelp: {
    type: String,
  },
  helpLink: {
    type: String,
    required: false
  },
  messageBoxTextContent: {
    type: String,
    required: false
  },
  messageBoxTitle: {
    type: String,
    required: false
  }
});

dtrTemplateSchema.plugin(timestamps);

export const DTRTemplate = mongoose.model('DTRTemplate', dtrTemplateSchema);
