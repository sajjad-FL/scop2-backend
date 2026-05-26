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
}, { _id: false });

const CaseStudyApprovers = new mongoose.Schema({
  value: {
    type: String,
    required: true,
    unique: true,
  },
  approvers: [userSchema],
});

CaseStudyApprovers.plugin(timestamps);

export const CaseStudyApprover = mongoose.model('CaseStudyApprovers', CaseStudyApprovers);