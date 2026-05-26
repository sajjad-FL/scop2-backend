import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    index: true,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  clientId: {
    type: String,
    unique: true,
    index: true,
    required: true,
  },
  clientSecret: {
    type: String,
    unique: true,
    index: true,
    required: true,
  },
  redirectUri: {
    type: String,
    required: true,
  },
  userDetails: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    code: {
      type: String,
    },
    codeExpiry: {
      type: Date,
    },
    isCodeUsed: {
      type: Boolean,
      default: false,
    },
    authenticatedAt: {
      type: Date,
    },
  }],
});

clientSchema.plugin(timestamps);

export const Client = mongoose.model('Client', clientSchema);
