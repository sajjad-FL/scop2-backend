import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';
import { CONSTANTS } from '../utils/constants.js';

const { PROJECT, SBO_PROJECT, SMM_PROJECT } = CONSTANTS;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    lowercase: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  password: {
    type: String,
    select: false,
    required: false,
  },
  isEnabled: {
    type: Boolean,
    index: true,
    default: true,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
  },
  profileImage: {
    type: String,
    required: false,
  },
  wWID: {
    type: String,
    ref: 'Jjed',
  },
  defaultPage: {
    type: Object,
  },
  defaultType: {
    type: Object,
  },
  displayPrConPage: {
    type: String,
    default: 'no',
  },
  emailNotification: {
    type: String,
    default: 'no',
  },
  defaultProjectStatus: [{
    type: String,
    enum: Object.values({...PROJECT.STATUS, ...SBO_PROJECT.STATUS, ...SMM_PROJECT.STATUS }),
  }],
  sboProjectStatus: [{
    type: String,
    enum: Object.values({...PROJECT.STATUS, ...SBO_PROJECT.STATUS, ...SMM_PROJECT.STATUS }),
  }],
  requestTabs: {
    type: Boolean,
    default: true
  },
  customDisplayValues: [{
    type: String,
  }],
  customSboDisplayValues: [{
    type: String,
  }],
  meta: {
    type: {},
  },
  gitVersionControlType: {
    type: String,
  },
  allProjects: {
    type: Boolean,
    default: true,
  }
});

userSchema.plugin(timestamps);

export const User = mongoose.model('User', userSchema);
