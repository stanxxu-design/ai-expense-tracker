import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ApiError } from "@google/genai";
import { getAuthenticatedUser } from "@/lib/auth";
import { analyzeExpense } from "@/lib/gemini";
import { connectToDatabase } from "@/lib/mongodb";
import Expense from "@/models/Expense";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeExpenseDate(value: string) {
  const match = value
    .trim()
    .match(/^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})(?:日)?/);
  if (!match) {
    return null;
  }

  const date = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return isValidDateString(date) ? date : null;
}

function normalizeCurrency(value: string) {
  const currency = value.trim().toUpperCase();
  const aliases: Record<string, string> = {
    "NT$": "TWD",
    NTD: "TWD",
    "NEW TAIWAN DOLLAR": "TWD",
    "NEW TAIWAN DOLLARS": "TWD",
    新台幣: "TWD",
    新臺幣: "TWD",
    台幣: "TWD",
    臺幣: "TWD",
    人民幣: "CNY",
    RMB: "CNY",
    日圓: "JPY",
    日元: "JPY",
    韓元: "KRW",
    港幣: "HKD",
    美元: "USD",
  };
  const normalized = aliases[currency] ?? currency;
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "請先登入。" }, { status: 401 });
    }

    const expenses = await Expense.find({ householdId: user.householdId })
      .sort({ date: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      expenses: expenses.map((expense) => ({
        id: expense._id.toString(),
        rawText: expense.rawText,
        merchant: expense.merchant,
        amount: expense.amount,
        currency: expense.currency,
        category: expense.category,
        date: expense.date.toISOString().slice(0, 10),
        note: expense.note,
      })),
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading household expenses failed:", error);
    return NextResponse.json(
      { error: "讀取家庭記帳資料時發生錯誤，請稍後再試。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請提供有效的 JSON 內容。" }, { status: 400 });
  }

  const text = isRecord(body) && typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "請先輸入一段記帳內容。" }, { status: 400 });
  }

  if (text.length > 2000) {
    return NextResponse.json({ error: "輸入內容不可超過 2000 個字元。" }, { status: 400 });
  }

  let processingStage: "database" | "gemini" = "database";
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "請先登入後再記帳。" }, { status: 401 });
    }

    processingStage = "gemini";
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
    }).format(new Date());
    const analysis = await analyzeExpense(text, today);

    if (!analysis.isExpense) {
      return NextResponse.json(
        { error: "這段內容似乎不是一筆完整的支出，請補上店家與金額後再試一次。" },
        { status: 422 },
      );
    }

    const currency = normalizeCurrency(analysis.currency);
    const date = normalizeExpenseDate(analysis.date);
    const invalidFields: string[] = [];
    if (!Number.isFinite(analysis.amount) || analysis.amount <= 0) {
      invalidFields.push("amount");
    }
    if (!currency) {
      invalidFields.push("currency");
    }
    if (!date) {
      invalidFields.push("date");
    }
    if (invalidFields.length > 0) {
      console.warn("Gemini returned invalid expense fields:", invalidFields);
      return NextResponse.json(
        {
          error:
            "AI 分析結果中的金額、幣別或日期格式不正確，請明確輸入金額與幣別（例如 180 元）後再試一次。",
        },
        { status: 422 },
      );
    }

    processingStage = "database";
    await connectToDatabase();
    const expense = await Expense.create({
      householdId: user.householdId,
      rawText: text,
      merchant: analysis.merchant.trim().slice(0, 120) || "未提供店家",
      amount: analysis.amount,
      currency,
      category: analysis.category,
      date: new Date(`${date}T00:00:00.000Z`),
      note: analysis.note.trim().slice(0, 300) || "未提供備註",
    });

    return NextResponse.json(
      {
        expense: {
          id: expense._id.toString(),
          rawText: expense.rawText,
          merchant: expense.merchant,
          amount: expense.amount,
          currency: expense.currency,
          category: expense.category,
          date,
          note: expense.note,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("Expense analysis or persistence failed:", {
      stage: processingStage,
      error,
    });

    if (error instanceof ApiError && error.status === 401) {
      return NextResponse.json(
        {
          error:
            "Gemini API 金鑰無效或已失效。請在 Google AI Studio 建立新的 API key、更新專案 .env.local 的 GEMINI_API_KEY，並重新啟動伺服器。",
        },
        { status: 502 },
      );
    }

    if (error instanceof ApiError && error.status === 429) {
      return NextResponse.json(
        { error: "Gemini API 使用額度或請求頻率已達上限，請稍後再試。" },
        { status: 503 },
      );
    }

    if (error instanceof ApiError && error.status === 404) {
      return NextResponse.json(
        { error: "Gemini 模型目前無法使用，請確認已部署最新版程式後再試。" },
        { status: 503 },
      );
    }

    if (error instanceof ApiError && error.status >= 500) {
      return NextResponse.json(
        { error: "Gemini 服務暫時無法使用，請稍後再試。" },
        { status: 503 },
      );
    }

    if (
      error instanceof Error &&
      (error.message === "GEMINI_API_KEY is not configured." ||
        error.message === "MONGODB_URI is not configured.")
    ) {
      return NextResponse.json(
        { error: "伺服器尚未設定 Gemini 或 MongoDB 環境變數。" },
        { status: 500 },
      );
    }

    if (processingStage === "database") {
      return NextResponse.json(
        {
          error:
            "記帳資料無法連線或寫入 MongoDB。請確認 MONGODB_URI、資料庫使用者密碼與 Atlas Network Access 設定。",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "分析或儲存記帳資料時發生錯誤，請稍後再試。" },
      { status: 500 },
    );
  }
}
