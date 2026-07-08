## Why

登入紀錄、操作稽核與帳號管理目前只顯示登入帳號（username），而 username 多為信箱（如 `starlightsystem@gmail.com`）或學員 ID（自助註冊者），管理者難以一眼辨識「這是誰」。應在這些畫面顯示可讀姓名，降低稽核與帳號管理的認知負擔。

## What Changes

- `users` 表新增 `display_name` 欄位（可空）；帳號管理新增/編輯帳號時可填「顯示姓名」。
- 建立「帳號顯示名稱」解析規則：優先取 `users.display_name`；若無、且 username 為學員 ID（自助註冊者），則以 `students.name` 帶出「姓名（ID）」；再無則退回顯示 username 原值。
- 關懷長以上自助註冊時，自動把當下學員姓名寫入新帳號的 `display_name`，之後即顯示姓名。
- 下列畫面改為顯示解析後的姓名（找不到姓名時退回 username）：
  - 登入紀錄 / 操作稽核（`/admin/login-logs`）的「帳號 / 操作者」欄
  - 帳號管理列表（`/admin/users`）的帳號欄
  - 各頁頂端登入者標示
- 登入紀錄 / 操作稽核 API 回傳每筆對應的 `display_name`（伺服端解析，不在前端逐筆查表）。

## Capabilities

### New Capabilities
- `account-display-name`: 定義帳號顯示名稱的資料來源、解析優先序（display_name → 學員姓名(ID) → username），以及在登入紀錄、操作稽核、帳號管理、頁面頂端的顯示行為。

### Modified Capabilities
- `user-accounts`: 使用者帳號資料模型新增 `display_name` 欄位；superadmin/system_admin 開設與管理帳號時可設定顯示姓名。
- `leader-self-login`: 自助註冊建立帳號時，一併寫入該學員姓名為 `display_name`。

## Impact

- Schema：新增 migration `014_user_display_name.sql`（`users.display_name text`）。
- 型別：`lib/supabase/types.ts`（`AppUser`/`AuthUser` 加 `display_name`）。
- 認證：`app/api/login/route.ts`（自助註冊寫入 display_name）；`lib/auth.ts`（checkAuth 帶回 display_name 供頂端顯示）。
- API：`app/api/login-logs/route.ts`、`app/api/admin-audit/route.ts`（回傳解析後姓名）；`app/api/users`（GET 回傳 display_name、POST/PATCH 可設定）。
- 姓名解析工具：新增 `lib/auth/displayName.ts`（伺服端批次解析 username→姓名）。
- UI：`app/admin/login-logs/LoginLogsClient.tsx`、`app/admin/users/UsersClient.tsx`、各 layout 頂端登入者標示。
