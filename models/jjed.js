import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';

const jJedSchema = new mongoose.Schema({
  _id: {
    type: String,
    unique: true,
  },
  commonName: {
    type: String,
    required: true,
  },
  emailAddress: {
    type: String,
  },
  supervisor: {
    type: String,
    required: true,
  },
  directReports: {
    type: Array,
    ref: 'Jjed',
  },
}, {
  strict: false,
});

jJedSchema.plugin(timestamps);

export const Jjed = mongoose.model('Jjed', jJedSchema);
