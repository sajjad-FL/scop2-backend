import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';

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
  groupId: {
    type: String,
    ref: 'Group',
  },
  type: {
    type: String,
  },
}, { _id: false });

const attributeSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  value: {
    type: Object || String,
    default: '',
  },
  mode: {
    type: String,
  },
  type: {
    type: String,
  },
  values: {
    type: Array,
  },
  default: {
    type: Boolean,
  },
}, { _id: false });

const ApproverSchema = new mongoose.Schema({
  typeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Type',
  },
  defaultApprovers: [userSchema],
  attributeSet: [attributeSchema],
  approvers: [userSchema],
  lead: [userSchema],
  collaborators: [userSchema],
  previousApproverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Approver',
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

ApproverSchema.plugin(timestamps);

export const Approver = mongoose.model('Approvers', ApproverSchema);