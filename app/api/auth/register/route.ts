import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
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
    return NextResponse.json({ error: "註冊資料格式不正確。" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const inviteCode =
    typeof body.inviteCode === "string" ? body.inviteCode.trim().toUpperCase() : "";

  if (!name || name.length > 80) {
    return NextResponse.json({ error: "姓名不可空白，且不可超過 80 個字元。" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "請輸入有效的 Email 地址。" }, { status: 400 });
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return NextResponse.json({ error: "密碼至少需 8 個字元，且不可超過 72 bytes。" }, { status: 400 });
  }

  if (inviteCode && !/^[A-F0-9]{12}$/.test(inviteCode)) {
    return NextResponse.json({ error: "邀請碼格式不正確。" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    if (await User.exists({ email })) {
      return NextResponse.json(
        { error: "這個 Email 已註冊，請改為登入。" },
        { status: 409 },
      );
    }

    const household = inviteCode
      ? await Household.findOne({ inviteCode })
      : null;

    if (inviteCode && !household) {
      return NextResponse.json({ error: "找不到此邀請碼，請確認後再試。" }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const user = new User({
      name,
      email,
      passwordHash,
    });

    if (household) {
      user.householdId = household._id;
    } else {
      const newHousehold = await Household.create({
        name: `${name} 的家庭`,
        inviteCode: randomBytes(6).toString("hex").toUpperCase(),
        createdBy: user._id,
      });
      user.householdId = newHousehold._id;
    }
    await user.save();

    const userHousehold = household ?? await Household.findById(user.householdId);
    if (!userHousehold) {
      throw new Error("User household was not found after registration.");
    }

    const token = await createSessionToken(user._id.toString());
    const response = NextResponse.json({
      user: { id: user._id.toString(), name: user.name, email: user.email },
      household: {
        name: userHousehold.name,
        inviteCode: userHousehold.inviteCode,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Account registration failed:", error);
    if (
      isRecord(error) &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { error: "此 Email 已註冊，請改為登入。" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "建立帳戶時發生錯誤，請稍後再試。" },
      { status: 500 },
    );
  }
}
