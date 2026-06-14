## 1. Schema

- [x] 1.1 `supabase/migrations/012_system_admin_role.sql`：放寬 users role CHECK 加 system_admin；改 role/system 約束（admin|system_admin 須 system、superadmin 須 null）
- [x] 1.2 `supabase/migrations/013_admin_audit.sql`：admin_audit 表 + RLS(service_role only) + index(created_at desc)

## 2. 型別 / 常數 / 認證

- [x] 2.1 `lib/supabase/types.ts`：UserRole 加 'system_admin'；CellEdit 加 changedBy
- [x] 2.2 `lib/constants/index.ts`：SYSTEM_ADMIN_STUDENT_ROLES = ['體系長','體系長共同經營']
- [x] 2.3 `lib/auth/middleware.ts`：新增 requireManager（role ∈ superadmin|system_admin）
- [x] 2.4 `lib/auth.ts`：getEffectiveSystem → admin 與 system_admin 都鎖 user.system；僅 superadmin 讀 cookie
- [x] 2.5 `app/api/login/route.ts`：自助通過後依 student.role 分流建 system_admin 或 admin

## 3. 守門放寬 + 帳號管理體系隔離 + UI

- [x] 3.1 `app/admin/users/page.tsx`、`app/admin/login-logs/page.tsx`：守門由 superadmin 改 requireManager 等效（role 為 admin 才 redirect）
- [x] 3.2 `app/api/users/route.ts`：守門 requireManager；GET 非 superadmin 過濾同體系；POST 非 superadmin 強制同體系、禁建 superadmin/他體系
- [x] 3.3 `app/api/users/[id]/route.ts`：守門 requireManager；非 superadmin 目標帳號須同體系否則 403
- [x] 3.4 `app/api/login-logs/route.ts`：守門改 requireManager
- [x] 3.5 UI 各 layout「帳號管理」連結改 `role !== 'admin'` 顯示（students/counselors/maintenance/spirit/dashboard）；SystemSwitcher 維持 superadmin only
- [ ] 3.6 `app/admin/users/UsersClient.tsx`：role 下拉依 actor 限制（system_admin 不可選 superadmin、體系鎖定） — **已延後**：後端 API（3.2/3.3）已強制限制（system_admin 不可建 superadmin/他體系），前端下拉僅為輔助提示，本次未實作以收斂範圍

## 4. 稽核擴充

- [x] 4.1 `lib/auth/audit.ts`：新增 logAdminAction(action, {actor,target,detail}, request)
- [x] 4.2 `app/api/users/route.ts` POST → user_created；`[id]` PATCH → user_disabled/enabled/password_reset
- [x] 4.3 `app/api/export/route.ts` → data_export（detail 體系+筆數）
- [x] 4.4 `app/api/import/apply/route.ts` → import_applied（detail applied/errors）
- [x] 4.5 新增 `app/api/admin-audit/route.ts`（GET，requireManager，order created_at desc，搜尋）

## 5. edit_logs changed_by 修正

- [x] 5.1 `lib/db/types.ts`：CellEdit 加 changedBy（已在 2.1 型別檔；此處確認 repo 介面）
- [x] 5.2 `store/useStudentStore.ts`（+useCounselorStore/useMaintenanceStore）：加 username + setUsername
- [x] 5.3 各 page（students/counselors/maintenance）傳 username 給 client；client setUsername
- [x] 5.4 三個 hook updateCell：從 store 帶 changedBy
- [x] 5.5 `lib/db/supabaseRepository.ts` updateCell：用 edit.changedBy 寫 changed_by（移除 supabase.auth.getUser()）；mockRepository 同步介面

## 6. 稽核查看頁

- [x] 6.1 `app/admin/login-logs/LoginLogsClient.tsx`：加「登入紀錄 / 操作稽核」來源切換，操作稽核表格（時間/操作者/動作/對象/IP）

## 7. 驗證

- [x] 7.1 tsc + build 通過；套用 012、013 — **程式碼**：tsc/build 皆通過。**migration 012/013 需由使用者於 Supabase SQL Editor 套用**（本工具無法執行 DDL）
- [ ] 7.2 體系長自助登入 → system_admin（綁體系）、強制改密碼、只看自己體系、無切換器 — 待套用 migration 後人工驗證
- [ ] 7.3 體系長進帳號管理：只見/能管同體系；無法建 superadmin/他體系 — 待人工驗證
- [ ] 7.4 關懷長自助 → 仍 admin、無帳號管理入口 — 待人工驗證
- [ ] 7.5 superadmin 照舊（跨體系+管理+切換） — 待人工驗證
- [ ] 7.6 帳號新增/停用/重設/匯出/匯入套用 → admin_audit 各一筆（操作者正確） — 待人工驗證
- [ ] 7.7 學員編輯 → edit_logs.changed_by = 登入者帳號（非 null） — 待人工驗證
- [ ] 7.8 管理者查看頁見登入紀錄與操作稽核兩來源 — 待人工驗證
