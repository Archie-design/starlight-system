## 1. Schema

- [x] 1.1 `supabase/migrations/014_user_display_name.sql`：`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text`

## 2. 型別

- [x] 2.1 `lib/supabase/types.ts`：`AppUser` 加 `display_name: string | null`；`AuthUser` 加 `display_name`

## 3. 姓名解析工具

- [x] 3.1 新增 `lib/auth/displayName.ts`：`resolveDisplayNames(rows)` 批次解析（display_name → 學員姓名(ID) → username），僅對數字 username 做一次 `students.in(id)` 查詢
- [x] 3.2 單值輔助（如需要）：`resolveOne(username, display_name)` 供頂端/單筆使用

## 4. 認證與自助註冊

- [x] 4.1 `lib/auth.ts`：`checkAuth` 讀取並回傳 `display_name`
- [x] 4.2 `app/api/login/route.ts`：自助分支 `.select` 補 `name`；`insert users` 帶 `display_name: student.name`

## 5. API 回傳姓名

- [x] 5.1 `app/api/login-logs/route.ts`：對回傳紀錄用 `resolveByUsernames` 附上 `display_name`
- [x] 5.2 `app/api/admin-audit/route.ts`：對 actor 用 `resolveByUsernames` 附上 `display_name`
- [x] 5.3 `app/api/users/route.ts`：GET 回傳含 `display_name` + `display_name_resolved`（無者對學員 ID 型補姓名）；POST 接受並儲存 `display_name`

## 6. UI 顯示

- [x] 6.1 `app/admin/login-logs/LoginLogsClient.tsx`：登入紀錄與操作稽核的「帳號 / 操作者」欄改顯示解析後姓名（退回 username）
- [x] 6.2 `app/admin/users/UsersClient.tsx`：列表帳號欄顯示解析後姓名（並列原 username）；新增表單加「顯示姓名（選填）」輸入並送出
- [x] 6.2b `app/api/users/[id]/route.ts` + `UsersClient`：既有帳號「改姓名」PATCH（稽核 display_name_updated），供信箱型帳號補姓名
- [x] 6.3 各 layout 頂端登入者標示（students/counselors/maintenance）顯示 `display_name || username`；page 傳入 display_name、client 於掛載 setDisplayName

## 7. 驗證

- [x] 7.1 tsc + build 通過；**migration 014 需由使用者套用**（本工具無法執行 DDL）
- [ ] 7.2 有 display_name 的帳號 → 登入紀錄/帳號管理顯示姓名 — 待套用 migration 後人工驗證
- [ ] 7.3 自助註冊者（新建）→ 顯示「姓名（ID）」 — 待人工驗證
- [ ] 7.4 信箱型無 display_name 帳號 → 退回顯示信箱（不空白、不報錯） — 待人工驗證
- [ ] 7.5 頁面頂端顯示登入者姓名（有 display_name 時） — 待人工驗證
- [ ] 7.6 原 username 仍可用於登入紀錄搜尋 — 待人工驗證
