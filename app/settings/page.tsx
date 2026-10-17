import type { Metadata } from "next";
import Link from "next/link";
import LocalEnvironmentForm from "./LocalEnvironmentForm";

export const metadata: Metadata = {
  title: "環境設定 | AI 智慧記帳",
  description: "查看部署 AI 智慧記帳所需的伺服器環境變數。",
};

const environmentVariables = [
  {
    name: "GEMINI_API_KEY",
    purpose: "供伺服器呼叫 Gemini，將自然語句分析成支出資料。",
  },
  {
    name: "MONGODB_URI",
    purpose: "Mongoose 連線至 MongoDB，儲存會員、家庭與支出資料。",
  },
  {
    name: "AUTH_SECRET",
    purpose: "簽署登入工作階段 Cookie。請使用至少 32 bytes 的隨機值。",
  },
];

export default function SettingsPage() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <Link
            href="/"
            className="mb-6 inline-flex rounded-lg text-sm font-medium text-emerald-800 transition hover:text-emerald-950"
          >
            <span aria-hidden="true" className="mr-2">
              ←
            </span>
            返回記帳本
          </Link>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
            伺服器設定
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            環境變數設定
          </h1>
          <p className="mt-3 leading-7 text-stone-600">
            本機開發時可用下方表單將設定值儲存至 .env.local；正式部署請在主機的環境變數設定中加入以下 Secret。
          </p>
        </header>

        <section
          aria-labelledby="required-variables"
          className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"
        >
          <h2 id="required-variables" className="sr-only">
            必要的環境變數
          </h2>
          <ul className="divide-y divide-stone-100">
            {environmentVariables.map((variable) => (
              <li key={variable.name} className="p-5 sm:p-6">
                <code className="rounded-lg bg-stone-100 px-2.5 py-1.5 font-mono text-sm font-semibold text-stone-900">
                  {variable.name}
                </code>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {variable.purpose}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-5">
          <LocalEnvironmentForm />
        </div>

        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <h2 className="font-semibold text-amber-950">安全提醒</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            請勿將 API 金鑰、資料庫連線 URI 或簽章密鑰輸入正式網站、提交到 Git，或傳送到聊天訊息。本機設定請只使用本機開發環境表單，正式環境請使用 Vercel Environment Variables，或本機被
            <code className="mx-1 rounded bg-amber-100 px-1 font-mono">
              .gitignore
            </code>
            忽略的
            <code className="mx-1 rounded bg-amber-100 px-1 font-mono">
              .env.local
            </code>
            中設定。
          </p>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="https://vercel.com/stan-94d0/ai-expense-tracker/settings/environment-variables"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            開啟 Vercel 環境變數設定
          </a>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-200 bg-white px-5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            返回記帳本
          </Link>
        </div>

        <p className="mt-5 text-xs leading-5 text-stone-500">
          在 Vercel 新增或更新環境變數後，需重新部署才會生效。
        </p>
      </div>
    </main>
  );
}
