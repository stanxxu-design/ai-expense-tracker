import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import Household from "@/models/Household";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "請先登入。" }, { status: 401 });
    }

    const household = await Household.findById(user.householdId);
    if (!household) {
      return NextResponse.json(
        { error: "找不到帳戶所屬的家庭帳本。" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      user: { id: user._id.toString(), name: user.name, email: user.email },
      household: {
        name: household.name,
        inviteCode: household.inviteCode,
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("Loading current account failed:", error);
    return NextResponse.json(
      { error: "讀取帳戶資訊時發生錯誤，請稍後再試。" },
      { status: 500 },
    );
  }
}
