import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';
import { CONSTANTS } from '../utils/constants.js';

const { ATTRIBUTE } = CONSTANTS;

const projectTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  categoryId: {
    type: String,
    required: true,
  },
  htmlFile: {
    type: Object,
  },
  isTA: {
    type: Boolean,
    default: false,
  },
  isDTR: {
    type: Boolean,
    default: false,
  },
  isRequest: {
    type: Boolean,
    default: false,
  },
  automateRequest: {
    type: Boolean,
    default: false,
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
  templateHelp: {
    type: String,
  },
  messageBoxTextContent: {
    type: String,
    required: false
  },
  messageBoxTitle: {
    type: String,
    required: false
  },
  helpLink: {
    type: String,
    required: false
  }
});

// Compound index to ensure the combination of name, categoryId, and isDeleted is unique
projectTypeSchema.index({ name: 1, categoryId: 1, isDeleted: 1 }, { unique: true });

projectTypeSchema.plugin(timestamps);

// Pre-save hook to check for the uniqueness of name and categoryId
projectTypeSchema.pre('save', async function (next) {
  const doc = this;
  try {
    const existing = await mongoose.models.Type.findOne({
      name: doc.name,
      categoryId: doc.categoryId,
      isDeleted: false,
      _id: { $ne: doc._id }  // Exclude the current document being saved
    });
    if (existing) {
      const error = new Error('Duplicate: Project type with the same name already exists with this department in the system');
      error.name = 'ValidationError';
      return next(error);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Pre-findOneAndUpdate hook to check for uniqueness on update
projectTypeSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  const docId = this.getQuery()._id;

  // Ensure `isDeleted` is explicitly checked if present in the update
  const isDeleted = update.$set && update.$set.isDeleted !== undefined ? update.$set.isDeleted : false;

  if (update.$set && update.$set.name && update.$set.categoryId) {
    try {
      const existing = await mongoose.models.Type.findOne({
        name: update.$set.name,
        categoryId: update.$set.categoryId,
        isDeleted: isDeleted,
        _id: { $ne: docId }  // Exclude the current document being updated
      });
      if (existing) {
        const error = new Error('Duplicate: Project type with the same name already exists with this department in the system');
        error.name = 'ValidationError';
        return next(error);
      }
    } catch (err) {
      return next(err);
    }
  }
  next();
});

export const Type = mongoose.model('Type', projectTypeSchema);
