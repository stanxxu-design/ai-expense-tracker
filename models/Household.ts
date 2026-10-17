import mongoose, { Schema } from "mongoose";

const householdSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    inviteCode: { type: String, required: true, unique: true, index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

const Household =
  mongoose.models.Household || mongoose.model("Household", householdSchema);

export default Household;
