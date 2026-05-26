import mongoose from 'mongoose'
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
  isPrimarySP: {
    type: Boolean,
    default: false,
  },
  isPrimarySDS: {
    type: Boolean,
    default: false,
  },
  isTypeFulfiller: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const attributeSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  value: {
    type: Object || String,
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

const attributesSchema = new mongoose.Schema({
  attributes: [attributeSchema],
  fulfillers: [userSchema],
});

const FulfillerSchema = new mongoose.Schema({
  typeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Type',
  },
  categoryId: {
    type: String,
    ref: 'Category',
  },
  fulfillers: [userSchema],
  attributeSet: [
    attributesSchema,
  ],
});

FulfillerSchema.plugin(timestamps);

export const Fulfiller = mongoose.model('Fulfillers', FulfillerSchema);
