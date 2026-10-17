"use client";

import { FormEvent, useEffect, useState } from "react";

type EnvironmentKey = "GEMINI_API_KEY" | "MONGODB_URI" | "AUTH_SECRET";
type ConfiguredState = Record<EnvironmentKey, boolean>;

const fields: {
  name: EnvironmentKey;
  label: string;
  description: string;
  autoComplete: string;
}[] = [
  {
    name: "GEMINI_API_KEY",
    label: "Gemini API Key",
    description: "供伺服器呼叫 Gemini，分析自然語句支出。",
    autoComplete: "new-password",
  },
  {
    name: "MONGODB_URI",
    label: "MongoDB URI",
    description: "Mongoose 的資料庫連線 URI。",
    autoComplete: "new-password",
  },
  {
    name: "AUTH_SECRET",
    label: "Auth Secret",
    description: "簽署登入 Cookie；至少 32 bytes。",
    autoComplete: "new-password",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConfiguredState(value: unknown): value is ConfiguredState {
  return (
    isRecord(value) &&
    typeof value.GEMINI_API_KEY === "boolean" &&
    typeof value.MONGODB_URI === "boolean" &&
    typeof value.AUTH_SECRET === "boolean"
  );
}

export default function LocalEnvironmentForm() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [configured, setConfigured] = useState<ConfiguredState>({
    GEMINI_API_KEY: false,
    MONGODB_URI: false,
    AUTH_SECRET: false,
  });
  const [values, setValues] = useState<Record<EnvironmentKey, string>>({
    GEMINI_API_KEY: "",
    MONGODB_URI: "",
    AUTH_SECRET: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/local-settings", {
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (
          !response.ok ||
          !isRecord(result) ||
          result.available !== true ||
          !isConfiguredState(result.configured)
        ) {
          return;
        }

        if (!cancelled) {
          setConfigured(result.configured);
          setIsAvailable(true);
        }
      } catch {
        if (!cancelled) {
          setError("無法連線到本機設定服務。");
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/local-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        setError(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "儲存設定失敗，請稍後再試。",
        );
        return;
      }

      if (
        !isRecord(result) ||
        !Array.isArray(result.updated) ||
        !result.updated.every(
          (key): key is EnvironmentKey =>
            key === "GEMINI_API_KEY" ||
            key === "MONGODB_URI" ||
            key === "AUTH_SECRET",
        )
      ) {
        setError("伺服器回傳的設定結果格式不正確。");
        return;
      }

      setConfigured((current) => {
        const next = { ...current };
        for (const key of result.updated as EnvironmentKey[]) {
          next[key] = true;
        }
        return next;
      });
      setValues({
        GEMINI_API_KEY: "",
        MONGODB_URI: "",
        AUTH_SECRET: "",
      });
      setNotice(
        "已儲存到本機 .env.local。請重新啟動 Next.js 開發伺服器後，變更才會生效。",
      );
    } catch {
      setError("目前無法連線至本機設定服務。");
    } finally {
      setIsSaving(false);
    }
  }

  if (isChecking) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-sm">
        正在檢查本機設定服務…
      </section>
    );
  }

  if (!isAvailable) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-stone-900">本機設定表單</h2>
        {error && (
          <p role="alert" className="mt-2 text-sm leading-6 text-red-700">
            {error}
          </p>
        )}
        <p className="mt-2 text-sm leading-6 text-stone-600">
          機密輸入表單只會在本機開發伺服器啟用。正式網站不會提供寫入伺服器機密的表單；請使用 Vercel
          Environment Variables。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-stone-900">本機環境變數</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        輸入新值即可新增或更新；留白表示保留目前設定。現有值不會顯示，也不會傳回瀏覽器。
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {fields.map((field) => (
          <div key={field.name}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={field.name}
                className="text-sm font-semibold text-stone-800"
              >
                {field.label}
              </label>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  configured[field.name]
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {configured[field.name] ? "已設定" : "尚未設定"}
              </span>
            </div>
            <input
              id={field.name}
              name={field.name}
              type="password"
              autoComplete={field.autoComplete}
              value={values[field.name]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
              placeholder={
                configured[field.name] ? "輸入新值以取代目前設定" : "輸入設定值"
              }
              maxLength={
                field.name === "MONGODB_URI"
                  ? 8192
                  : field.name === "AUTH_SECRET"
                    ? 1024
                    : 2048
              }
              spellCheck={false}
              className="mt-2 min-h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 font-mono text-sm text-stone-900 outline-none transition placeholder:font-sans placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
            <p className="mt-2 text-xs leading-5 text-stone-500">
              {field.description}
            </p>
          </div>
        ))}

        <button
          type="submit"
          disabled={
            isSaving || !Object.values(values).some((value) => value.length > 0)
          }
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-5 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {isSaving ? "儲存中…" : "儲存至 .env.local"}
        </button>
      </form>

      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-4 rounded-xl px-4 py-3 text-sm leading-6 ${
            error
              ? "border border-red-200 bg-red-50 text-red-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error || notice}
        </p>
      )}
    </section>
  );
}
