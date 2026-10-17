import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const editableKeys = {
  GEMINI_API_KEY: 2048,
  MONGODB_URI: 8192,
  AUTH_SECRET: 1024,
} as const;

type EditableKey = keyof typeof editableKeys;

function isLocalHost(host: string | null) {
  if (!host) {
    return false;
  }

  const hostname = host.startsWith("[")
    ? host.slice(1, host.indexOf("]")).toLowerCase()
    : host.split(":")[0].toLowerCase();

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isSameLocalOrigin(request: Request) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!isLocalHost(host) || !origin) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return (
      isLocalHost(originUrl.host) &&
      originUrl.host.toLowerCase() === host?.toLowerCase()
    );
  } catch {
    return false;
  }
}

function unavailable() {
  return NextResponse.json({ error: "此設定功能僅限本機開發環境使用。" }, { status: 404 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function encodeDotEnvValue(value: string) {
  return JSON.stringify(value);
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development" || !isLocalHost(request.headers.get("host"))) {
    return unavailable();
  }

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const content = await readFile(envPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return "";
      }
      throw error;
    });

    const configured = Object.keys(editableKeys).reduce(
      (result, key) => {
        result[key as EditableKey] = new RegExp(`^${key}=`, "m").test(content);
        return result;
      },
      {} as Record<EditableKey, boolean>,
    );

    return NextResponse.json({ available: true, configured });
  } catch (error) {
    console.error("Loading local environment settings failed:", error);
    return NextResponse.json(
      { error: "無法讀取本機環境設定檔。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (
    process.env.NODE_ENV !== "development" ||
    !isSameLocalOrigin(request)
  ) {
    return unavailable();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請提供有效的 JSON 內容。" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "設定資料格式不正確。" }, { status: 400 });
  }

  const updates: Partial<Record<EditableKey, string>> = {};
  for (const key of Object.keys(editableKeys) as EditableKey[]) {
    const value = body[key];
    if (value === undefined || value === "") {
      continue;
    }
    if (
      typeof value !== "string" ||
      value.length > editableKeys[key] ||
      /[\r\n\0]/.test(value)
    ) {
      return NextResponse.json(
        { error: `${key} 格式不正確或超過長度限制。` },
        { status: 400 },
      );
    }
    updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "請至少輸入一個要新增或更新的值；留白欄位會保持不變。" },
      { status: 400 },
    );
  }

  if (
    updates.AUTH_SECRET !== undefined &&
    Buffer.byteLength(updates.AUTH_SECRET, "utf8") < 32
  ) {
    return NextResponse.json(
      { error: "AUTH_SECRET 至少需要 32 bytes。" },
      { status: 400 },
    );
  }

  if (
    updates.MONGODB_URI !== undefined &&
    !/^mongodb(?:\+srv)?:\/\/\S+$/.test(updates.MONGODB_URI)
  ) {
    return NextResponse.json(
      { error: "MONGODB_URI 必須是有效格式的 mongodb:// 或 mongodb+srv:// URI。" },
      { status: 400 },
    );
  }

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    const current = await readFile(envPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return "";
      }
      throw error;
    });
    const lines = current.split(/\r?\n/);

    for (const [key, value] of Object.entries(updates) as [EditableKey, string][]) {
      let replaced = false;
      const nextLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith(`${key}=`)) {
          if (!replaced) {
            nextLines.push(`${key}=${encodeDotEnvValue(value)}`);
            replaced = true;
          }
        } else {
          nextLines.push(line);
        }
      }

      if (!replaced) {
        nextLines.push(`${key}=${encodeDotEnvValue(value)}`);
      }
      lines.splice(0, lines.length, ...nextLines);
    }

    const updated = lines.join("\n").replace(/\n*$/, "\n");
    await writeFile(envPath, updated, { encoding: "utf8", mode: 0o600 });

    return NextResponse.json({
      success: true,
      updated: Object.keys(updates),
      restartRequired: true,
    });
  } catch (error) {
    console.error("Saving local environment settings failed:", error);
    return NextResponse.json(
      { error: "無法儲存本機環境設定檔，請確認專案目錄有寫入權限。" },
      { status: 500 },
    );
  }
}
