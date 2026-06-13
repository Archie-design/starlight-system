## 1. 帳號資料層（users 表 + 雜湊）

- [x] 1.1 安裝 `bcryptjs`（+ 型別）
- [x] 1.2 新增 `supabase/migrations/010_users.sql`：`users` 表（id/username/password_hash/role/system/active/must_change_password/timestamps）+ CHECK（admin 須有 system、superadmin system 為 null）+ unique(username) + index
- [x] 1.3 同 migration 加 RLS：anon 不可讀、service_role 全權（仿 009 慣例，但 anon 無 SELECT）
- [x] 1.4 種子初始 superadmin `starlightsystem@gmail.com`（bcrypt 雜湊初始密碼、must_change_password=true）；明文初始密碼記於交付訊息/README，不入庫
- [x] 1.5 `lib/supabase/types.ts`：新增 `AppUser` 型別（role: 'superadmin'|'admin'；system: SheetSystem|null）

## 2. 認證層改造（帳號登入 + session 帶身分）

- [x] 2.1 `.env.local.example`：移除 `APP_PASSWORD`，保留 `AUTH_SECRET`（作 session 標記）
- [x] 2.2 `app/api/login/route.ts`：收 `{ username, password }`，查 users 表、`bcrypt.compare`、檢查 active；成功寫 `sl_session`(=AUTH_SECRET)、`sl_session_ts`、`sl_session_uid`(user id)、`csrf_token`；失敗回 401
- [x] 2.3 `lib/auth.ts`：`checkAuth()` 改為以 `sl_session_uid` 查 users 表，回傳 `{ valid, user: {id,username,role,system} }`，並確認 active；過期/查無/停用回 `{ valid:false }`
- [x] 2.4 `lib/auth/middleware.ts`：`requireAuth` / 新增 `requireSuperadmin` 與 `getAuthUser` 輔助
- [x] 2.5 `app/api/logout/route.ts`：清除 `sl_session`/`_ts`/`sl_session_uid`/`sl_view_system`/`csrf_token`
- [x] 2.6 `app/login/page.tsx`：表單加 username 欄（含 label/aria），送 `{username,password}`

## 3. 帳號管理（superadmin）與改密碼（所有人）

- [x] 3.1 `app/api/users/route.ts`：GET 列表、POST 新增（驗 superadmin，否則 403；username 重複回錯；密碼 bcrypt 雜湊）
- [x] 3.2 `app/api/users/[id]/route.ts`：PATCH 停用/啟用、重設密碼（驗 superadmin）
- [x] 3.3 `app/api/account/password/route.ts`：PATCH 自行改密碼（驗舊密碼 bcrypt.compare，更新雜湊，清除 must_change_password）
- [x] 3.4 `app/admin/users/page.tsx`：server 驗 superadmin 否則 redirect；client 帳號列表 + 新增/停用/重設密碼 UI（新建帳號預設 must_change_password=true）
- [x] 3.5 `app/account/change-password` 頁（強制流程，自身不擋）+ 頂部導覽「改密碼」入口
- [x] 3.6 受保護頁於 `checkAuth()` 後：若 `user.must_change_password` 則 redirect 到 `/account/change-password`

## 4. 有效體系：頁面解構身分、修 boolean bug、傳 prop

- [x] 4.1 `app/students/page.tsx`：`const { valid, user } = await checkAuth(); if (!valid) redirect('/login')`，傳 `role` 與有效體系給 `StudentsClient`
- [x] 4.2 `app/dashboard/page.tsx`：同上，取有效體系供查詢與傳 `DashboardClient`
- [x] 4.3 `app/counselors/page.tsx`：同上，傳給 `CounselorsClient`
- [x] 4.4 `app/maintenance/page.tsx`：同上，傳給 `MaintenanceClient`
- [x] 4.5 `app/history/page.tsx`：修正 boolean bug（不需體系篩選）

## 5. Client / store：依角色決定體系與 TAB

- [x] 5.1 `store/useStudentStore.ts`：承載 `role` 與有效體系（admin 鎖定、superadmin 可切換）
- [x] 5.2 `store/useCounselorStore.ts`、`store/useMaintenanceStore.ts`：承載有效體系
- [x] 5.3 `StudentsClient` / `CounselorsClient` / `MaintenanceClient`：掛載即以 prop 覆寫 store，避免閃現他體系
- [x] 5.4 `components/StudentGrid/Toolbar.tsx`：TAB 依 role —— admin 顯示體系標籤不可切換；superadmin 可在星光/太陽切換（切換更新 `sl_view_system` 或 store）

## 6. 查詢層：依 business_chain 注入體系條件

- [x] 6.1 新增 `lib/utils/system.ts`：`systemOf(business_chain)`（=== '太陽' ? 太陽 : 星光）與 `applySystemFilter(query, system)`（太陽→eq；星光→`.or('business_chain.is.null,business_chain.neq.太陽')`）
- [x] 6.2 `lib/db/types.ts`：`findBySheet`→依 business_chain（或新增 `findBySystem`）；`findByGroupLeader` / `findByMaintenanceCategory` 介面加 `system`
- [x] 6.3 `lib/db/supabaseRepository.ts`：三方法改用 `applySystemFilter`，移除對 `sheet_system` 的 `.eq`
- [x] 6.4 `lib/db/mockRepository.ts`：同步介面與過濾（用 `systemOf`）
- [x] 6.5 `hooks/useCounselorStudents.ts`、`hooks/useMaintenanceStudents.ts`：傳入有效體系
- [x] 6.6 `app/dashboard/page.tsx`：所有 `service.from('students')` 查詢套用體系條件
- [x] 6.7 （可選）migration 加索引 `idx_students_business_chain`

## 7. API 越權防護（以 server session 身分為準）

- [x] 7.1 `app/api/org/route.ts`：以 `checkAuth(request)` 取身分；admin 忽略 client `?system=` 用其體系；superadmin 可指定
- [x] 7.2 `app/api/export/route.ts`：同上
- [x] 7.3 `hooks/useOrgData.ts`：admin 不帶 `?system=`（server 以身分決定）

## 8. dashboard 課程漏斗 rpc

- [x] 8.1 探查 `get_course_funnel` rpc 定義，確認是否支援體系參數
- [x] 8.2 若不支援：改以 client 端依已篩選學員重算，或新增體系版 rpc

## 9. counselor_groups 體系隔離（查詢層）

- [x] 9.1 確認 counselors 頁 `findByGroupLeader` 已套用體系條件（任務 6）
- [x] 9.2 `lib/import/assignGroup.ts` (`buildGroupAssignments`)：歸屬追溯限定同體系，避免跨體系誤歸
- [x] 9.3 `app/api/counselor-groups/backfill/route.ts`：backfill 依體系重算
- [x] 9.4 （實作前）盤點 `business_chain` 是否有「太陽」變體拼法

## 10. 驗證

- [x] 10.1 `npx tsc --noEmit` 通過
- [x] 10.2 `npm run build` 通過
- [x] 10.3 superadmin 登入：可進 `/admin/users`、開設星光/太陽 admin、可切換體系看資料
- [x] 10.4 太陽 admin 登入：僅見 `business_chain='太陽'`（約 697 人），TAB 鎖定，無法進 `/admin/users`（403/redirect）
- [x] 10.5 星光 admin 登入：僅見非太陽（約 2009 人）
- [x] 10.6 改密碼：舊密碼錯誤被拒；正確則更新、舊密碼失效
- [x] 10.7 越權測試：太陽 admin 打 `/api/org?system=星光`、`/api/export?system=星光` 僅得太陽資料
- [x] 10.8 停用帳號後該帳號無法登入、既有 session 失效
- [x] 10.9 登出後所有 session cookie 清除，受保護頁重導向 /login
