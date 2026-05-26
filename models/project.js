import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';
import { CONSTANTS } from '../utils/constants.js';

const { ATTRIBUTE, PROJECT, SBO_PROJECT, SMM_PROJECT, SMH_CASE_STUDY_STATUS } = CONSTANTS;

const projectSchema = new mongoose.Schema({
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
  description: {
    type: String,
  },
  lead: {
    userName: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    wWID: {
      type: String,
      required: true,
    },
  },
  leads:{
    type: Array,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  categoryId: {
    type: String,
    ref: 'Category',
  },
  typeData: {
    categoryId: {
      type: String,
      ref: 'Category',
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Type',
    },
    name: {
      type: String,
    },
  },
  importProjectCustomType: {
    type: String,
  },
  projectID: {
    type: String,
    // index: true,
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
    values: {
      type: Array,
    },
    isRequired: {
      type: Boolean,
    },
    mode: {
      type: String,
    },
  }],
  comments: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      auto: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    comment: {
      type: String,
      trim: true,
    },
    commentAt: {
      type: Date,
    },
  }],
  status: {
    type: String,
    enum: Object.values({...PROJECT.STATUS, ...SBO_PROJECT.STATUS,...SMM_PROJECT.STATUS}),
  },
  statusLastUpdatedBy: {
    type: String,
  },
  hasAttachments: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: String,
    enum: ['', 'High', 'Medium', 'Low'],
  },
  collaborators: {
    type: Array,
    default: [{
      type: 'group',
      displayName: 'scope-administrators',
      name: 'scope-administrators',
    }],
  },
  displayId: {
    type: String,
  },
  hasAttachments: {
    type: Boolean,
  },
  gitlab: {
    projectUrl: {
      type: String,
    },
    projectId: {
      type: String,
    },
    groupId: {
      type: [String],
    },
    sdsForgeImportLink: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Existing', 'New', 'None'],
    }
  },
  alfresco: {
    projectRoot: {
      type: String,
    },
    repositoryId: {
      type: String,
    },
    nodeId: {
      type: String,
    },
    groupId: {
      type: [String],
    },
  },
  isDeleted: {
    type: Boolean,
    index: true,
    default: false,
  },
  deleteOn: {
    type: Date,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  meta: {
    type: {},
  },
  requestMeta: {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectRequest',
    },
    typeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Type',
    },
    categoryId: {
      type: String,
      ref: 'Category',
    },
    displayId: {
      type: String,
    },
  },
  dtrMeta: {
    dtrId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DataTransferRequest',
    },
    typeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DTRTemplate',
    },
    categoryId: {
      type: String,
      ref: 'Category',
    },
    displayId: {
      type: String,
    },
  },
  notes: {
    type: String,
  },
  actionHours: [{
    user: {
      userName: {
        type: String,
        required: true,
      },
      displayName: {
        type: String,
        required: true,
      },
      wWID: {
        type: String,
        required: true,
      },
    },
    q1:{
      type: Number,
    },
    role:{
      type: String,
    },
  }],
  riskNotes: {
    q1:{
      type: String,
    },
    q2:{
      type: String,
    },
    q3:{
      type: String,
    },
    q4:{
      type: String,
    }
  }, //riskNotes not using need to remove test feature
  quarters: [{
    quarter: {
      type: String,
      required: true, // e.g., 'Q1_2024', 'Q2_2024'
    },
    actualFTE: {
      type: String,
    },
    notes: {
      type: String,
    }
  }],
  smhApprovalStatus: {
    type: String,
    enum: Object.values(SMH_CASE_STUDY_STATUS),
  },
  caseStudyApproversId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CaseStudyApprovers'
  },
  caseStudyApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  caseStudyApprovalRejectionReason: {
    type: String,
  },
});

projectSchema.plugin(timestamps);

export const Project = mongoose.model('Project', projectSchema);
