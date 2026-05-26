import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';
import { CONSTANTS } from '../utils/constants.js';

const { PROJECT_REQUEST: { STATES }, ATTRIBUTE } = CONSTANTS;

const userSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  username: {
    type: String,
  },
  wWID: {
    type: String,
  },
  email: {
    type: String,
  },
}, { _id: false });

const projectRequestSchema = new mongoose.Schema({
  key: {
    type: String,
    index: true,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  createdBy: userSchema,
  categoryId: {
    type: String,
    ref: 'Category',
  },
  fulfillers: [
    userSchema,
  ],
  fulfilledAt: {
    type: Date,
  },
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  state: {
    type: String,
    enum: Object.values(STATES),
    default: STATES.REQUESTED,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  projectKey: {
    type: String,
  },
  typeData: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Type',
    },
    name: {
      type: String,
      required: true,
    },
  },
  importProjectCustomType: {
    type: String,
  },
  requestID: {
    type: String,
    unique: true,
  },
  customFields: [{
    name: {
      type: String,
    },
    type: {
      type: String,
      enum: ATTRIBUTE.TYPES,
    },
    value: {
      type: Object || String,
    },
    mode: {
      type: String,
    },
    isRequired: {
      type: Boolean,
    },
    values: {
      type: Array,
    },
  }],
  // TODO: Filter unused fields
  hasAttachments: {
    type: Boolean,
    default: false,
  },
  emailStatus: {
    type: Boolean,
    default: false,
  },
  displayId: {
    type: String,
  },
  isDeleted: {
    type: Boolean,
    index: true,
    default: false,
  },
  deleteOn: {
    type: Date,
  },
  completedAt: {
    type: Date || String,
  },
  meta: {
    type: {},
  },
  notes: {
    type: String,
  },
});

projectRequestSchema.plugin(timestamps);

export const ProjectRequest = mongoose.model('ProjectRequest', projectRequestSchema);
