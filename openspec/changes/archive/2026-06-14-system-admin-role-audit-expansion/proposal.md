## Why

(1) 體系長需要系統管理功能（帳號管理、登入紀錄），但應**只看自己體系**。現有角色 admin（綁體系、無管理權）與 superadmin（跨體系、有管理權）都不符 → 新增中間角色 `system_admin`（綁體系 + 有管理權）。

(2) 稽核目前只記登入事件；帳號管理、資料匯出、匯入執行者皆無紀錄；且 `edit_logs.changed_by`（誰編輯學員欄位）因取錯認證來源（用 Supabase Auth，但本系統是自訂 cookie session）一直是 null。需擴充稽核並修正此 bug。

## What Changes

**system_admin 角色**
- 新增 `system_admin`：綁定單一體系、只看自己體系、但擁有帳號管理 / 登入紀錄權限。
- 體系長 / 體系長共同經營 自助登入時建為 `system_admin`；關懷長維持 `admin`（不變）。
- 帳號管理 / 登入紀錄的守門由「僅 superadmin」放寬為「可管理」（superadmin 或 system_admin）。
- system_admin 在帳號管理中**只能管理同體系帳號**、不可建立 superadmin 或他體系帳號；不可切換體系（SystemSwitcher 仍僅 superadmin）。

**稽核擴充**
- 新增 `admin_audit` 表記錄敏感操作：帳號新增 / 停用啟用 / 重設密碼、資料匯出、匯入套用（含操作者、IP、UA）。
- 修正 `edit_logs.changed_by`：改由 server session 傳入的登入者帳號填寫。
- superadmin / system_admin 可在登入紀錄頁切換來源查看 admin_audit。

## Capabilities

### New Capabilities
- `system-admin-role`: 綁體系且具管理權的中間角色，體系長自助登入建為此角色，帳號管理限同體系。
- `admin-audit`: 敏感操作稽核（帳號管理 / 匯出 / 匯入），並修正學員編輯的操作者紀錄。

### Modified Capabilities
<!-- 無既有 spec 需改 -->

## Impact

- **schema**：`012_system_admin_role.sql`（放寬 users role/system CHECK）、`013_admin_audit.sql`（admin_audit 表 + RLS）。
- **型別/常數**：`lib/supabase/types.ts`（UserRole 加 system_admin、CellEdit 加 changedBy）、`lib/constants/index.ts`（SYSTEM_ADMIN_STUDENT_ROLES）。
- **認證**：`lib/auth/middleware.ts`（requireManager）、`lib/auth.ts`（getEffectiveSystem 納 system_admin）、`app/api/login/route.ts`（體系長建 system_admin）。
- **守門/隔離**：`app/admin/users/page.tsx`、`app/admin/login-logs/page.tsx`、`app/api/users/route.ts`（+ 同體系過濾）、`app/api/users/[id]/route.ts`、`app/api/login-logs/route.ts`。
- **UI**：各 layout「帳號管理」連結改 `role !== 'admin'`；SystemSwitcher 維持 superadmin only。
- **稽核**：`lib/auth/audit.ts`（logAdminAction）、export / import-apply / users 路由寫入、`app/admin/login-logs/LoginLogsClient.tsx`（加 admin_audit 來源）。
- **edit_logs 修正**：`store/useStudentStore.ts`(+username)、三個 students hook、`lib/db/supabaseRepository.ts`、`lib/db/types.ts`、各 students/counselors/maintenance page 傳 username。
