"use client";

import { FormEvent, useEffect, useState } from "react";

type AccountSession = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  household: {
    name: string;
    inviteCode: string;
  };
};

type SavedExpense = {
  id: string;
  rawText: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  note: string;
};

type AuthMode = "login" | "register";

const categoryNames: Record<string, string> = {
  Food: "餐飲",
  Transport: "交通",
  Housing: "居住",
  Shopping: "購物",
  Entertainment: "娛樂",
  Healthcare: "醫療",
  Education: "教育",
  Utilities: "水電",
  Travel: "旅遊",
  Other: "其他",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSession(value: unknown): value is AccountSession {
  if (!isRecord(value) || !isRecord(value.user) || !isRecord(value.household)) {
    return false;
  }

  return (
    typeof value.user.id === "string" &&
    typeof value.user.name === "string" &&
    typeof value.user.email === "string" &&
    typeof value.household.name === "string" &&
    typeof value.household.inviteCode === "string"
  );
}

function isSavedExpense(value: unknown): value is SavedExpense {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.rawText === "string" &&
    typeof value.merchant === "string" &&
    typeof value.amount === "number" &&
    typeof value.currency === "string" &&
    typeof value.category === "string" &&
    typeof value.date === "string" &&
    typeof value.note === "string"
  );
}

async function responseError(response: Response) {
  const result: unknown = await response.json();
  return isRecord(result) && typeof result.error === "string"
    ? result.error
    : "請求失敗，請稍後再試。";
}

export default function Home() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [expenses, setExpenses] = useState<SavedExpense[]>([]);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isCopyingInviteCode, setIsCopyingInviteCode] = useState(false);

  async function loadExpenses() {
    const response = await fetch("/api/expenses");
    if (!response.ok) {
      throw new Error(await responseError(response));
    }

    const result: unknown = await response.json();
    if (
      !isRecord(result) ||
      !Array.isArray(result.expenses) ||
      !result.expenses.every(isSavedExpense)
    ) {
      throw new Error("伺服器回傳的記帳資料格式不正確。");
    }

    setExpenses(result.expenses);
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/me");
        if (response.status === 401) {
          return;
        }
        if (!response.ok) {
          throw new Error(await responseError(response));
        }

        const result: unknown = await response.json();
        if (!isSession(result)) {
          throw new Error("伺服器回傳的帳戶資料格式不正確。");
        }

        if (!cancelled) {
          setSession(result);
          await loadExpenses();
        }
      } catch (restoreError) {
        if (!cancelled) {
          setError(
            restoreError instanceof Error
              ? restoreError.message
              : "無法讀取帳戶資訊。",
          );
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmittingAuth(true);

    try {
      const response = await fetch(
        authMode === "register" ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(authMode === "register" ? { name, inviteCode } : {}),
            email,
            password,
          }),
        },
      );

      if (!response.ok) {
        setError(await responseError(response));
        return;
      }

      const result: unknown = await response.json();
      if (!isSession(result)) {
        setError("伺服器回傳的帳戶資料格式不正確。");
        return;
      }

      setSession(result);
      setPassword("");
      setError("");
      setNotice(
        authMode === "register" && !inviteCode.trim()
          ? "家庭帳本已建立，分享邀請碼即可邀請家人加入。"
          : "",
      );
      await loadExpenses();
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "目前無法連線至伺服器，請稍後再試。",
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function handleLogout() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error(await responseError(response));
      }

      setSession(null);
      setExpenses([]);
      setText("");
      setPassword("");
      setNotice("");
      setAuthMode("login");
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : "登出失敗，請再試一次。",
      );
    }
  }

  async function handleCopyInviteCode() {
    if (!session) {
      return;
    }

    setError("");
    setNotice("");
    setIsCopyingInviteCode(true);
    try {
      await navigator.clipboard.writeText(session.household.inviteCode);
      setNotice("家庭邀請碼已複製，可以分享給家人。");
    } catch {
      setError("無法使用剪貼簿，請手動複製畫面上的邀請碼。");
    } finally {
      setIsCopyingInviteCode(false);
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmittingExpense(true);

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        setError(await responseError(response));
        return;
      }

      const result: unknown = await response.json();
      if (!isRecord(result) || !isSavedExpense(result.expense)) {
        setError("伺服器回傳的記帳資料格式不正確。");
        return;
      }

      const savedExpense = result.expense;
      setExpenses((current) => [
        savedExpense,
        ...current.filter((expense) => expense.id !== savedExpense.id),
      ]);
      setText("");
      setNotice("已分析並儲存到家庭共用帳本。");
    } catch (expenseError) {
      setError(
        expenseError instanceof Error
          ? expenseError.message
          : "目前無法連線至伺服器，請稍後再試。",
      );
    } finally {
      setIsSubmittingExpense(false);
    }
  }

  const statusMessage = error || notice;

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-emerald-500"
              />
              家庭共用記帳
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
              每筆花費，一句話記下
            </h1>
            <p className="mt-3 max-w-xl leading-7 text-stone-600">
              用日常語句記帳，和家人一起查看每筆支出。
            </p>
          </div>
          {session && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              登出
            </button>
          )}
        </header>

        {isCheckingSession ? (
          <section className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-600 shadow-sm">
            正在載入家庭帳本…
          </section>
        ) : !session ? (
          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex gap-2 rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                }}
                aria-pressed={authMode === "register"}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  authMode === "register"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                建立帳戶
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                }}
                aria-pressed={authMode === "login"}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  authMode === "login"
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                登入
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "register" && (
                <>
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-sm font-semibold text-stone-800"
                    >
                      你的稱呼
                    </label>
                    <input
                      id="name"
                      autoComplete="name"
                      maxLength={80}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      className="min-h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-stone-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </>
              )}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-stone-800"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="min-h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-stone-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-stone-800"
                >
                  密碼
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete={
                    authMode === "register" ? "new-password" : "current-password"
                  }
                  minLength={8}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="min-h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-stone-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
                {authMode === "register" && (
                  <p className="mt-2 text-xs text-stone-500">
                    至少 8 個字元，最多 72 bytes。
                  </p>
                )}
              </div>
              {authMode === "register" && (
                <div>
                  <label
                    htmlFor="invite-code"
                    className="mb-2 block text-sm font-semibold text-stone-800"
                  >
                    家庭邀請碼
                    <span className="ml-2 font-normal text-stone-500">
                      沒有邀請碼？建立自己的家庭帳本
                    </span>
                  </label>
                  <input
                    id="invite-code"
                    autoComplete="off"
                    maxLength={12}
                    value={inviteCode}
                    onChange={(event) =>
                      setInviteCode(event.target.value.toUpperCase())
                    }
                    placeholder="輸入家人分享的 12 位邀請碼"
                    className="min-h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 font-mono uppercase tracking-widest text-stone-900 outline-none transition placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {isSubmittingAuth
                  ? "請稍候…"
                  : authMode === "register"
                    ? "建立帳戶並加入帳本"
                    : "登入家庭帳本"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-800">目前家庭</p>
                  <h2 className="mt-1 text-xl font-semibold text-stone-900">
                    {session.household.name}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    你好，{session.user.name}。此帳本由家庭成員共同使用。
                  </p>
                </div>
                <div className="min-w-52">
                  <label
                    htmlFor="display-invite-code"
                    className="mb-1.5 block text-xs font-medium text-stone-600"
                  >
                    分享邀請碼，邀請家人加入
                  </label>
                  <div className="flex items-center gap-2">
                    <output
                      id="display-invite-code"
                      className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 font-mono text-lg font-semibold tracking-widest text-emerald-900"
                    >
                      {session.household.inviteCode}
                    </output>
                    <button
                      type="button"
                      onClick={handleCopyInviteCode}
                      disabled={isCopyingInviteCode}
                      className="min-h-11 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:bg-stone-400"
                    >
                      {isCopyingInviteCode ? "複製中" : "複製"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
              <form onSubmit={handleExpenseSubmit}>
                <label
                  htmlFor="expense-text"
                  className="mb-3 block text-sm font-semibold text-stone-800"
                >
                  今天花了什麼？
                </label>
                <textarea
                  id="expense-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={2000}
                  placeholder="例如：中午在公司附近吃牛肉麵，花了 180 元"
                  rows={4}
                  required
                  className="w-full resize-y rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 leading-7 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="text-xs leading-5 text-stone-500">
                    描述越清楚，AI 分析越準確。
                  </p>
                  <span className="shrink-0 text-xs tabular-nums text-stone-400">
                    {text.length}/2000
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingExpense || !text.trim()}
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-medium text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto sm:min-w-40"
                >
                  {isSubmittingExpense ? "AI 分析中…" : "分析並記帳"}
                </button>
              </form>
            </section>

            <section className="mt-8" aria-live="polite">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-stone-900">
                    家庭共用帳本
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    最近的共同支出記錄
                  </p>
                </div>
                <span className="text-sm tabular-nums text-stone-500">
                  {expenses.length} 筆
                </span>
              </div>
              {expenses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-10 text-center text-sm text-stone-500">
                  還沒有記帳紀錄，輸入第一筆支出開始使用吧。
                </div>
              ) : (
                <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  {expenses.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-900">
                          {expense.merchant}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                          {new Date(
                            `${expense.date}T00:00:00`,
                          ).toLocaleDateString("zh-TW")}
                          {" · "}
                          {categoryNames[expense.category] ?? expense.category}
                          {expense.note ? ` · ${expense.note}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold tabular-nums text-stone-900">
                        {new Intl.NumberFormat("zh-TW", {
                          style: "currency",
                          currency: expense.currency,
                          maximumFractionDigits: 2,
                        }).format(expense.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {statusMessage && (
          <div
            role={error ? "alert" : "status"}
            className={`mt-5 rounded-2xl border px-5 py-4 text-sm leading-6 ${
              error
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {statusMessage}
          </div>
        )}
      </div>
    </main>
  );
}
