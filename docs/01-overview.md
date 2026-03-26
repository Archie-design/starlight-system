# 01 — 專案概覽與環境設定

## 系統目的

星光系統是一套學員管理平台，管理「星光」與「太陽」兩套體系的學員資料。  
功能包含：Excel 批次匯入、欄位手動編輯、愛心顧問群組指派、組織圖瀏覽、匯入歷史查詢、xlsx 匯出。

---

## Tech Stack

| 層次 | 技術 |
|------|------|
| 框架 | Next.js 16 App Router（Webpack 模式） |
| 語言 | TypeScript |
| 資料庫 | Supabase（PostgreSQL + Auth + Row Level Security） |
| 資料抓取 | SWR |
| 全域狀態 | Zustand |
| Excel 處理 | ExcelJS |

> **重要**：Next.js 16 的 Turbopack 在含中文路徑的環境下有 bug，**務必使用 Webpack（預設的 `npm run dev`）**，不可加 `--turbopack`。

---

## 常用指令

```bash
npm run dev      # 啟動開發伺服器（Webpack）
npm run build    # Production build
npm run migrate  # 從 reference/星光🌟超級表格總表-啟鴻.xlsx 初始化/補植資料（一次性，需 env vars）
```

---

## 環境設定

複製 `.env.local.example` → `.env.local`，填入三個必填變數：

| 變數 | 用途 | 使用位置 |
|------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | Client + Server Component |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 匿名 key，受 RLS 控管 | Client + Server Component |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key，繞過 RLS | API Routes 專用（server-only） |

**原則**：  
- Client-side 查詢（SWR hooks）使用 anon key + Supabase Auth session 驗證。  
- 所有 `/api/*` routes 使用 service role key，完全繞過 RLS。
