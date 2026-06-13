## Why

系統目前所有人共用單一固定密碼登入並看到全部學員資料。營運上需要：(1) 區分「太陽」與「星光」兩個體系，各體系管理者只看自己體系的學員；(2) 真正的帳號制度 —— 每個體系有數位管理者，並由一位系統管理者（superadmin）統一開設帳號、各人可自行改密碼。固定密碼無法滿足，需升級為多使用者帳號系統。

**體系判定依據為 `business_chain`（業務脈）欄位**，其實際值為：星光 1800、太陽 697、神兵 204、覺醒 5（共 2706）。判定規則：`business_chain === '太陽'` → 太陽體系；**其餘（星光 / 神兵 / 覺醒）一律歸為星光體系**。

注意：既有 `sheet_system` 欄位在匯入時被硬編碼為 `'星光'`（`transform.ts:124`），全表皆為星光，**並非有效的體系欄位**，本次改以 `business_chain` 為準。

## What Changes

帳號系統（取代固定密碼）：
- **BREAKING**：移除固定密碼登入（移除 `APP_PASSWORD`）。改為**帳號 + 密碼**的多使用者系統，密碼以 bcrypt 雜湊存於新 `users` 表。
- 三種身分：`superadmin`（跨體系、可開設/停用所有帳號、可切換檢視體系）、`admin`（綁定單一體系，只看自己體系資料）。每個體系可有數個 admin。
- session 改帶**使用者身分**（user id + role + system），不再是全域固定 token。
- superadmin 專屬「帳號管理」頁：新增帳號（指定 username / 初始密碼 / role / 體系）、停用/啟用、重設密碼。
- 所有登入者可「自行修改密碼」（需驗證舊密碼）。
- 登出清除全部 session cookie。

體系資料隔離（依 business_chain）：
- 體系判定依 `business_chain`：`=== '太陽'` → 太陽；其餘（星光/神兵/覺醒/null）→ 星光。
- admin 只看自己體系；superadmin 可切換看星光/太陽（或全部）。
- 受保護頁面（students/dashboard/counselors/maintenance）與 org/export API 依登入者「有效體系」篩選。
- 安全：API 以 server session 的身分/體系為準，不信任 client 傳入的 `?system=`，防越權。
- 順帶修正既有 bug：多處 `checkAuth()` 回傳物件被當布林判斷（物件恆 truthy），實際未驗證登入。

## Capabilities

### New Capabilities
- `user-accounts`: `users` 表（username / bcrypt 密碼 / role / system / active）、bcrypt 雜湊、帳號 CRUD API、superadmin 帳號管理頁、自行改密碼、種子 superadmin。
- `account-login`: 以帳號+密碼登入並驗證雜湊、session 承載 user 身分（id/role/system）、登出清除全部 cookie、`checkAuth()` 回傳使用者。
- `tenant-isolation`: 依登入者有效體系對所有學員資料讀取隔離 —— 查詢層 business_chain 篩選、superadmin 跨體系切換、API 越權防護、頁面範圍限制、體系 TAB 行為。

### Modified Capabilities
<!-- 尚無既有 openspec/specs/，全部為新建 capability，故此處留空 -->

## Impact

- **新依賴**：`bcryptjs`（純 JS 密碼雜湊，無 native binding）。
- **資料庫**：新 migration `010_users.sql`（`users` 表 + RLS：anon 不可讀、service_role 全權）；種子一個 superadmin；（可選）`idx_students_business_chain`。
- **認證**：`lib/auth.ts`（checkAuth 回傳 `{valid, user:{id,username,role,system}}`、session 驗證改查 users 表）、`lib/auth/middleware.ts`、`app/api/login/route.ts`、`app/api/logout/route.ts`、`.env.local.example`（移除 `APP_PASSWORD`，保留 `AUTH_SECRET` 作 session 簽章）。
- **新 API**：`app/api/users/`（GET 列表、POST 新增、PATCH 停用/重設密碼，僅 superadmin）、`app/api/account/password`（自行改密碼）。
- **新頁面**：`app/admin/users`（superadmin 帳號管理）、帳號設定/改密碼入口；`app/login/page.tsx` 加 username 欄。
- **頁面**：`app/students|dashboard|counselors|maintenance|history/page.tsx`（解構使用者、修 boolean bug、傳 system/role prop）。
- **Client / store**：`StudentsClient` 等、`components/StudentGrid/Toolbar.tsx`（TAB 依 role：admin 鎖定、superadmin 可切換）、三個 store。
- **查詢層**：`lib/db/types.ts`、`supabaseRepository.ts`、`mockRepository.ts`（business_chain 篩選）、`app/api/org/route.ts`、`app/api/export/route.ts`。
- **counselor_groups**：查詢層依體系隔離（不改 schema），`buildGroupAssignments` 限同體系。
