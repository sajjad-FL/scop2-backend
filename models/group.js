import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  gitlabId: {
    type: String,
  },
  alfrescoId: {
    type: String,
  },
  members: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  }],
});

groupSchema.plugin(timestamps);

export const Group = mongoose.model('Group', groupSchema);
