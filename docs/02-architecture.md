# 02 — 路由架構與資料流

## App Router 路由

```
/                   → redirect（空白首頁）
/login              → Supabase Auth 登入頁
/students           → 主管理員視圖（全體學員管理）
/counselors         → 愛心顧問視圖（各組只看自己學員）
/history            → 匯入歷史紀錄
```

### 頁面模式（students / counselors 共用）

```
page.tsx（Server Component）
  └─ 驗證 Supabase session → 未登入 redirect /login
  └─ <SWRConfig revalidateOnFocus={false}>
       └─ XxxLayout（Client Component，主畫面邏輯）
```

---

## 資料流

### 讀取

- `useStudents` hook（SWR + anon key）：查 `students` 表，支援篩選、分頁、optimistic cell update
- `useCounselorStudents`：同上，但加 `group_leader` 過濾
- `useCounselorGroups`：從 `/api/counselor-groups` 取群組列表
- `useOrgData`：從 `/api/org` 取樹狀組織資料

### 寫入（匯入 Pipeline）

詳見 [04-import-pipeline.md](./04-import-pipeline.md)

### 匯出

`GET /api/export` → `lib/export/buildXlsx.ts` 串流輸出 xlsx

### 手動編輯

Cell 編輯觸發 `updateCell()`，SWR optimistic update，PATCH 打到對應 API route，並寫入 `edit_logs`。

---

## API Endpoints 總覽

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/import` | POST | 解析 xlsx，回傳 preview diff + stats |
| `/api/import/apply` | POST | 從 diff_snapshot 執行 upsert |
| `/api/export` | GET | 串流輸出 xlsx |
| `/api/counselor-groups` | GET | 列出所有群組 |
| `/api/counselor-groups` | POST | 建立新群組 |
| `/api/counselor-groups/[id]` | PATCH | 更新群組 |
| `/api/counselor-groups/[id]` | DELETE | 刪除群組 |
| `/api/counselor-groups/backfill` | POST | 重算所有學員 group_leader |
| `/api/org` | GET | 組織圖樹狀資料 |
| `/api/history` | GET | 匯入歷史列表 |
| `/api/history/[id]` | GET | 單一 session 詳情 |
| `/api/edit-logs` | GET | 手動編輯紀錄 |
