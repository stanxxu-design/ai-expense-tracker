import { GoogleGenAI } from "@google/genai";

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

export type ExpenseAnalysis = {
  isExpense: boolean;
  merchant: string;
  amount: number;
  currency: string;
  category: (typeof expenseCategories)[number];
  date: string;
  note: string;
};

function isExpenseAnalysis(value: unknown): value is ExpenseAnalysis {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    typeof result.isExpense === "boolean" &&
    typeof result.merchant === "string" &&
    typeof result.amount === "number" &&
    typeof result.currency === "string" &&
    expenseCategories.some((category) => category === result.category) &&
    typeof result.date === "string" &&
    typeof result.note === "string"
  );
}

export async function analyzeExpense(
  text: string,
  today: string,
): Promise<ExpenseAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.interactions.create({
    model: "gemini-3.8-flash",
    input: [
      "Extract one personal expense from the user's text. The text may be in Traditional Chinese or another language.",
      `Today's date is ${today}. If no date is mentioned, use today. Convert relative dates using today's date and output the date exactly as YYYY-MM-DD.`,
      "Do not invent an amount or merchant. If the text is not an expense or the amount is unclear, set isExpense to false. If an expense is clear but its merchant is not stated, use an empty merchant.",
      "Use an uppercase ISO 4217 currency code. For an amount stated in 元 without another currency, use TWD. Use one of the supplied categories. Write the note concisely in Traditional Chinese.",
      `User text: ${text}`,
    ].join("\n"),
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: {
        type: "object",
        properties: {
          isExpense: { type: "boolean" },
          merchant: { type: "string", description: "Merchant named in the text, or an empty string if none is stated." },
          amount: { type: "number" },
          currency: { type: "string", description: "Uppercase ISO 4217 currency code, such as TWD." },
          category: { type: "string", enum: [...expenseCategories] },
          date: { type: "string", description: "Expense date in exactly YYYY-MM-DD format." },
          note: { type: "string" },
        },
        required: [
          "isExpense",
          "merchant",
          "amount",
          "currency",
          "category",
          "date",
          "note",
        ],
      },
    },
  });

  if (!response.output_text) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed: unknown = JSON.parse(response.output_text);
  if (!isExpenseAnalysis(parsed)) {
    throw new Error("Gemini returned an invalid expense analysis.");
  }

  return parsed;
}
