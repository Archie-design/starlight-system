## Why

目前帳號全由 superadmin 開設。但「關懷長以上」（students.role ∈ 關懷長 / 關懷長共同經營 / 體系長 / 體系長共同經營，共 16 人，全部有手機）應能自行登入使用系統，毋須逐一請 superadmin 開帳號。同時，開放自助登入後需要稽核機制，讓 superadmin 隨時掌握登入狀況（成功、失敗、改密碼）。

## What Changes

**關懷長自助登入**
- 登入頁支援「ID 當帳號、手機末四碼當預設密碼」自助首次登入。
- 自助條件（白名單）：該 ID 學員的 `role` 必須為關懷長以上，且手機末四碼相符；通過才自動建立帳號。
- 自動建立的帳號為 `role='admin'`、綁定該學員體系（依 `business_chain`）、`must_change_password=true` → 首次登入強制改密碼。
- 權限：關懷長登入後可看整個自己體系（等同 admin），但**不能**進入帳號管理（/admin/users 仍僅 superadmin）。

**登入稽核**
- 新增 `login_logs` 表記錄事件：成功登入、失敗登入、改密碼（含帳號、IP、user-agent、時間）。
- 登入 / 改密碼 API 以 fire-and-forget 寫入稽核。
- superadmin 專屬「登入紀錄」頁與 API 可查看、搜尋。

## Capabilities

### New Capabilities
- `leader-self-login`: 關懷長以上以 ID + 手機末四碼自助首次登入，自動建為該體系 admin、強制改密碼，非關懷長無法自助。
- `login-audit`: 登入/失敗/改密碼稽核紀錄，superadmin 專屬查看。

### Modified Capabilities
<!-- 無既有 spec 需改 -->

## Impact

- **認證**：`app/api/login/route.ts`（自助登入分支 + 稽核寫入）、`app/api/account/password/route.ts`（稽核寫入）。
- **常數**：`lib/constants/index.ts` 新增 `LEADER_ROLES`。
- **資料庫**：新 migration `011_login_logs.sql`（login_logs 表 + RLS service_role only + index）。無 users 表 schema 變更（關懷長建為現有 admin role）。
- **稽核查看**：新 `app/api/login-logs/route.ts`（GET，superadmin）、`app/admin/login-logs/page.tsx` + `LoginLogsClient.tsx`。
- **導覽**：superadmin 區（/admin/users 與各專區）加「登入紀錄」入口。
- **登入頁**：`app/login/page.tsx` 加自助登入提示文案。
- **重用**：`lib/utils/system.ts`（systemOf）、`lib/supabase/server.ts`（createServiceClient）、`lib/auth/middleware.ts`（requireSuperadmin）、edit_logs / HistoryClient 的表格與 fire-and-forget 模式、bcryptjs。
