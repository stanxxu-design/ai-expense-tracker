import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Household from "@/models/Household";
import User from "@/models/User";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請提供有效的 JSON 內容。" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "登入資料格式不正確。" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (
    !email ||
    !password ||
    email.length > 254 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return NextResponse.json({ error: "請輸入 Email 與密碼。" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Email 或密碼錯誤。" },
        { status: 401 },
      );
    }

    const household = await Household.findById(user.householdId);
    if (!household) {
      throw new Error("User household was not found.");
    }

    const token = await createSessionToken(user._id.toString());
    const response = NextResponse.json({
      user: { id: user._id.toString(), name: user.name, email: user.email },
      household: {
        name: household.name,
        inviteCode: household.inviteCode,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Account login failed:", error);
    return NextResponse.json(
      { error: "登入時發生錯誤，請稍後再試。" },
      { status: 500 },
    );
  }
}
