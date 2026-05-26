import mongoose from "mongoose";

const ColumnSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    width: { type: String, required: true, min: 50 }, // store width as number, not string
  },
  { _id: false } // prevents nested _id for each column
);

const TablePreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tableName: { type: String, required: true, trim: true },
    columns: {
      type: [ColumnSchema],
      validate: {
        validator: (arr) => Array.isArray(arr),
        message: "Columns must be an array",
      },
      default: [],
    },
  },
  { timestamps: true }
);

// Optional: Ensure one tableName per user (avoid duplicates)
TablePreferenceSchema.index({ userId: 1, tableName: 1 }, { unique: true });

export default mongoose.model("TablePreference", TablePreferenceSchema);
