import mongoose from 'mongoose';
import timestamps from 'mongoose-timestamp';

const columnSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  order: {
    type: Number,
  }
}, { _id: false });

const preferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    unique: true,
  },
 
  projectTable: [{
    categoryId: {
        type: String,
        ref: 'Category',
      },
      templateName: {
        type: String,
      },
      columns: [columnSchema]

  }],
});

preferenceSchema.plugin(timestamps);

export const Preference = mongoose.model('Preferences', preferenceSchema);
