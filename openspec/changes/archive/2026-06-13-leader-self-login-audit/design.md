## Context

帳號系統：`users`（username/password_hash/role∈superadmin|admin/system/active/must_change_password），登入 `app/api/login/route.ts`（bcrypt compare → 設 cookie），`checkAuth`/`getEffectiveSystem`，superadmin 保護 `requireSuperadmin`。學員 `students.role` 有「關懷長/關懷長共同經營/體系長/體系長共同經營」；體系靠 `business_chain`（`systemOf`）。既有稽核模式：`edit_logs`（005）+ fire-and-forget 寫入 + `app/history` 表格頁。

關懷長以上 16 人全有手機（`886xxxxxxxxx`），末四碼 = 去非數字後尾 4 碼。

## Goals / Non-Goals

**Goals:**
- 關懷長以上用 ID + 手機末四碼自助首次登入 → 自動建為該體系 admin → 強制改密碼
- 僅關懷長以上可自助（白名單）；失敗訊息一致防列舉
- 登入/失敗/改密碼稽核 + superadmin 查看頁

**Non-Goals:**
- 不新增 UserRole（關懷長即 admin）；不改 users CHECK
- 不做關懷長專屬的「只看自己下線」視圖（本次給整體系 admin 權限）
- 不做暴力嘗試自動鎖定（僅記錄失敗供人工監看）

## Decisions

### D1. 自助登入在 login route 內作為「查無帳號」的後備分支
`app/api/login/route.ts` 流程：
1. 查 users（username）→ 有 → 照舊 bcrypt 比對。
2. 查無 → 自助分支：
   - 把 username 當數字 ID 查 students（id）；取 role / phone / business_chain
   - 條件：`LEADER_ROLES.includes(role)` 且 `lastFour(phone) === password`
   - 通過 → bcrypt.hash(password)、insert users（role='admin'、system=systemOf(business_chain)、must_change_password=true、active=true）→ 設 session、回 `{ ok:true, mustChangePassword:true }`
   - 不通過 → 401「帳號或密碼錯誤」
- `lastFour(phone) = phone.replace(/\D/g,'').slice(-4)`；`LEADER_ROLES` 放 `lib/constants`。
- 競態（同時兩次自助）：insert 撞 unique(username) → 視為已建立，改走既有帳號比對或回失敗；可用 upsert/ON CONFLICT 容錯。

### D2. 不改 users schema
關懷長建為 `admin` + system，完全相容現有 CHECK 與 checkAuth/getEffectiveSystem。/admin/users 既有 superadmin-only 保護自動擋住關懷長。

### D3. login_logs（新 migration 011）
```
login_logs(id uuid pk default gen_random_uuid(),
  username text, event text check in ('login_success','login_failure','password_change'),
  ip text, user_agent text, created_at timestamptz default now())
ALTER ... ENABLE RLS; POLICY service_all FOR ALL TO service_role USING(true)  -- 無 anon
CREATE INDEX idx_login_logs_created ON login_logs(created_at DESC)
```
- 不含 user id 外鍵（username 足夠且涵蓋失敗時的不存在帳號）。

### D4. 稽核寫入：fire-and-forget（createServiceClient）
比照 `lib/db/supabaseRepository.ts` 的 `.then(()=>{})` 模式，但在 server route 用 `createServiceClient()`。封裝 `logLoginEvent(event, username, request)` 共用工具（`lib/auth/audit.ts`）：從 request 取 `x-forwarded-for`(第一段)/`x-real-ip` 與 `user-agent`，insert 後不 await。
- 寫入點：login route 成功/各失敗路徑、account/password 改密碼成功。

### D5. 查看頁（superadmin only，比照 edit-logs/history）
- API `app/api/login-logs/route.ts` GET：`requireSuperadmin` → createServiceClient → `select(...).order('created_at',{ascending:false}).limit(n)`，支援 username/event 搜尋（ilike/eq）。
- 頁 `app/admin/login-logs/page.tsx`（server 驗 superadmin、must_change_password 轉址）+ `LoginLogsClient.tsx`（SWR + 表格：時間/帳號/事件/IP/UA + 搜尋）。
- 導覽：在 `/admin/users` 頁與 superadmin 看得到的導覽加「登入紀錄」連結。

## Risks / Trade-offs

- [自助憑證易猜（ID+末四碼）] → 白名單（僅關懷長以上）+ 首次強制改密碼大幅降風險；失敗計入稽核供監看。殘餘風險：他人趁關懷長尚未首登前搶建+改密碼 → 由稽核可發現、superadmin 可停用重設。可接受（16 人、內部系統）。
- [失敗訊息一致] → 帳號不存在/非關懷長/末四碼錯一律同訊息。
- [IP 取得經代理] → 取 x-forwarded-for 第一段。
- [稽核量成長] → 量小（內部）；保留 index，未來可加清理。

## Open Questions

- 自助建帳號後，學員若手機異動，預設密碼也變——但首登後已改密碼，影響僅限「尚未首登」者，可接受。
- 是否需要在登入紀錄頁加「停用帳號」捷徑？本次先只看，停用走既有 /admin/users。
