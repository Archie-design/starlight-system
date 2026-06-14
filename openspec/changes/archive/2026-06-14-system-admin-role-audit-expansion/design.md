## Context

角色：users.role ∈ superadmin|admin（`010_users.sql` CHECK + users_role_system_chk：admin 須 system、superadmin 須 null）。守門 `requireSuperadmin`（`lib/auth/middleware.ts`）；`getEffectiveSystem`（`lib/auth.ts`）：admin 鎖 system、superadmin 讀 cookie。自助登入（`app/api/login/route.ts`）關懷長以上→建 admin。稽核 `login_logs` + `lib/auth/audit.ts`（fire-and-forget）。

bug：`edit_logs.changed_by` 在 `supabaseRepository.updateCell` 用 `supabase.auth.getUser()`（client anon、無 Supabase Auth）→ 永遠 null。client 無登入者身分（session 是 httpOnly）。

## Goals / Non-Goals

**Goals:** system_admin 角色（綁體系+管理權）；體系長自助建為此角色；帳號管理限同體系；稽核 admin_audit（帳號/匯出/匯入）；修 edit_logs.changed_by。

**Non-Goals:** 不動關懷長（維持 admin）；不讓 system_admin 跨體系或建 superadmin；不把每種操作各建表（統一 admin_audit）；不另開稽核頁（併入登入紀錄頁）。

## Decisions

### D1. 三角色權限矩陣
| role | 體系 | 看資料 | 帳號管理 | 切體系 |
|------|------|--------|----------|--------|
| admin | 綁定 | 自己 | ✗ | ✗ |
| system_admin | 綁定 | 自己 | ✓（限同體系）| ✗ |
| superadmin | null | 全部 | ✓（全部）| ✓ |
- 「可管理」= role ∈ {superadmin, system_admin}：新 `requireManager`。
- 「跨體系」仍只 superadmin：`getEffectiveSystem` 改為 `role !== 'superadmin' && user.system` → 回 user.system（admin + system_admin 都鎖定）。

### D2. schema（012）
放寬 CHECK：`role IN ('superadmin','admin','system_admin')`；system 約束：`(role IN ('admin','system_admin') AND system IS NOT NULL) OR (role='superadmin' AND system IS NULL)`。用 `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT`。

### D3. 自助登入分流
`lib/constants`：`SYSTEM_ADMIN_STUDENT_ROLES = ['體系長','體系長共同經營']`。login route：通過白名單後，`role = SYSTEM_ADMIN_STUDENT_ROLES.includes(student.role) ? 'system_admin' : 'admin'`。

### D4. 帳號管理同體系隔離
- `requireManager` 回 AuthUser（含 role/system）。
- `app/api/users` GET：若非 superadmin → `.eq('system', actor.system)` 過濾。
- POST：非 superadmin → 強制 `system = actor.system`、`role` 僅允許 admin/system_admin（不可建 superadmin）；嘗試他體系/ superadmin → 403。
- `app/api/users/[id]` PATCH：非 superadmin → 先查目標帳號 system，須等於 actor.system 否則 403。

### D5. admin_audit（013）+ 寫入
```
admin_audit(id uuid pk default gen_random_uuid(), actor text, action text,
  target text, detail text, ip text, user_agent text, created_at timestamptz default now())
RLS service_role only; index created_at desc
```
- `lib/auth/audit.ts` 加 `logAdminAction(action, opts:{actor,target?,detail?}, request)`。
- 寫入：users POST（user_created）、users[id] PATCH（user_disabled/user_enabled/password_reset）、export GET（data_export，detail=體系+筆數）、import/apply（import_applied，detail=applied/errors）。actor 取守門回傳 username。

### D6. edit_logs.changed_by 修正
- 各受保護 page 已傳 role 給 client；**加傳 username**（checkAuth 已回）。
- store（useStudentStore/useCounselorStore/useMaintenanceStore 視用到處）加 `username` + setter；client 掛載時 setUsername。
- `CellEdit` 加 `changedBy?: string|null`；三個 hook 的 updateCell 從 store 帶入；`supabaseRepository.updateCell` 改用 `edit.changedBy`（移除失效的 getUser()）。

### D7. 稽核查看併入登入紀錄頁
- `app/api/login-logs/route.ts` 守門改 requireManager；可加 `source=admin_audit` 參數改查 admin_audit。或新增 `app/api/admin-audit/route.ts`（requireManager）。採後者較清楚：另建唯讀 API，前端頁加來源切換 tab。
- `LoginLogsClient` 加「登入紀錄 / 操作稽核」切換，操作稽核欄位：時間/操作者/動作/對象/IP。

## Risks / Trade-offs

- [CHECK 放寬] → 純增量，既有資料不受影響。
- [system_admin 越權] → users API 三處（GET/POST/PATCH）都加同體系檢查 + 不可 superadmin；測試涵蓋。
- [changed_by 來源] → client store username 源自 server checkAuth，可信；非安全邊界（僅稽核顯示）。
- [login-logs 守門放寬] → system_admin 也能看登入紀錄；登入紀錄含他體系登入事件 → 可接受（管理者監看），或之後再依體系過濾（Open Q）。

## Open Questions

- 登入紀錄 / admin_audit 對 system_admin 是否該只顯示同體系？本次先全顯示（管理者監看用途），未來可加體系過濾。
- import/apply、export 的 actor 取得：這些 route 已 checkAuth(request)，取其 user.username。
