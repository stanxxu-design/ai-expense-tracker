# AI 智慧記帳

使用 Next.js App Router、Gemini 與 MongoDB 的家庭共用記帳本。

## 開始使用

在 `.env.local` 設定 `GEMINI_API_KEY`、`MONGODB_URI` 與至少 32 bytes 的隨機 `AUTH_SECRET`，再啟動開發伺服器：

```bash
npm install
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)，以 Email 和至少 8 個字元的密碼建立帳戶。沒有邀請碼時會建立新家庭帳本；要加入既有家庭，註冊時輸入該家庭成員分享的邀請碼。登入後，家庭成員可以查看同一家庭最近 100 筆支出並新增記錄。

環境變數不可提交至版本控制。工作階段使用 HttpOnly Cookie，登入有效期限為 7 天。

`/settings` 提供必要伺服器環境變數的名稱、用途與 Vercel 設定連結。本機開發時，頁面可將輸入值安全地寫入被 Git 忽略的 `.env.local`；正式部署不會啟用此寫入 API，請在 Vercel Environment Variables 設定雲端機密。

## API

- `POST /api/auth/register`：註冊；可傳入 `inviteCode` 加入家庭。
- `POST /api/auth/login`、`POST /api/auth/logout`：登入及登出。
- `GET /api/auth/me`：取得登入者及家庭邀請碼。
- `GET /api/expenses`：取得登入者家庭最近 100 筆支出。
- `POST /api/expenses`：分析支出文字並儲存到登入者家庭；幣別使用 ISO 4217（未指定且金額以「元」表示時使用 TWD）。
