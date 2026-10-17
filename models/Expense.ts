import mongoose, { Schema } from "mongoose";

const expenseCategories = [
  "Food",
  "Transport",
  "Housing",
  "Shopping",
  "Entertainment",
  "Healthcare",
  "Education",
  "Utilities",
  "Travel",
  "Other",
] as const;

const expenseSchema = new Schema(
  {
    householdId: {
      type: Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
    rawText: { type: String, required: true, maxlength: 2000 },
    merchant: { type: String, required: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, match: /^[A-Z]{3}$/ },
    category: { type: String, required: true, enum: expenseCategories },
    date: { type: Date, required: true },
    note: { type: String, required: true, maxlength: 300 },
  },
  { timestamps: true },
);

const Expense =
  mongoose.models.Expense || mongoose.model("Expense", expenseSchema);

export default Expense;
