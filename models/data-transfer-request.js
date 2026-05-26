import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';
import { CONSTANTS } from '../utils/constants.js';

const { DATA_TRANSFER_REQUEST: { STATES }, ATTRIBUTE } = CONSTANTS;

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

const dataTransferRequestSchema = new mongoose.Schema({
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
  approversData: {
    approvers: [userSchema],
    lead: [userSchema],
    collaborators: [userSchema],
  },
  approvedAt: {
    type: Date,
  },
  approvedBy: {
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
      ref: 'DTRTemplate',
    },
    name: {
      type: String,
      required: true,
    },
  },
  importProjectCustomType: {
    type: String,
  },
  dtrID: {
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
  hasAttachments: {
    type: Boolean,
    default: false,
  },
  emailStatus: {
    type: Boolean
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
  reason: {
    type: String,
  },
  notes: {
    type: String,
  },
});

dataTransferRequestSchema.plugin(timestamps);

export const DataTransferRequest = mongoose.model('DataTransferRequest', dataTransferRequestSchema);
