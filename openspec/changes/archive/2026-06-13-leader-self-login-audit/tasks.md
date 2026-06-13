## 1. 常數與自助登入

- [x] 1.1 `lib/constants/index.ts`：新增 `LEADER_ROLES = ['關懷長','關懷長共同經營','體系長','體系長共同經營']`
- [x] 1.2 `app/api/login/route.ts`：查無 users 帳號時走自助分支 —— 查 students(id=username)、驗 role∈LEADER_ROLES 且手機末四碼相符
- [x] 1.3 通過 → bcrypt.hash + insert users(role='admin', system=systemOf(business_chain), must_change_password=true, active=true)，設 session，回 mustChangePassword:true
- [x] 1.4 不通過一律 401「帳號或密碼錯誤」；末四碼 = `phone.replace(/\D/g,'').slice(-4)`；處理 unique 競態

## 2. 稽核資料表與寫入

- [x] 2.1 新增 `supabase/migrations/011_login_logs.sql`：login_logs 表 + RLS(service_role only) + index(created_at desc)
- [x] 2.2 新增 `lib/auth/audit.ts`：`logLoginEvent(event, username, request)` —— createServiceClient + 取 IP(x-forwarded-for/x-real-ip)/UA，fire-and-forget insert
- [x] 2.3 `app/api/login/route.ts`：成功→login_success；各失敗路徑→login_failure（username 記輸入值）
- [x] 2.4 `app/api/account/password/route.ts`：改密碼成功→password_change

## 3. 查看頁（superadmin）

- [x] 3.1 `app/api/login-logs/route.ts`：GET，requireSuperadmin，createServiceClient，order created_at desc，支援搜尋(username/event)，limit
- [x] 3.2 `app/admin/login-logs/page.tsx`：server 驗 superadmin（非則 redirect）+ must_change_password 轉址
- [x] 3.3 `app/admin/login-logs/LoginLogsClient.tsx`：SWR + 表格（時間/帳號/事件/IP/UA）+ 搜尋（比照 edit-logs/HistoryClient）

## 4. 導覽與文案

- [x] 4.1 在 superadmin 可見處（/admin/users 頁、各專區 superadmin 導覽）加「登入紀錄」連結
- [x] 4.2 `app/login/page.tsx`：加提示「關懷長首次登入：帳號=學員ID、密碼=手機末四碼」

## 5. 驗證

- [x] 5.1 `npx tsc --noEmit` + `npm run build` 通過
- [x] 5.2 套用 011_login_logs.sql
- [x] 5.3 關懷長 ID + 手機末四碼 → 自動建 admin、轉強制改密碼、改後只見其體系
- [x] 5.4 非關懷長 ID / 錯末四碼 → 失敗且不建帳號
- [x] 5.5 superadmin 登入紀錄頁見成功/失敗/改密碼事件（帳號/IP/UA/時間）
- [x] 5.6 關懷長 admin 打 /admin/users 與 /admin/login-logs → 403/redirect
- [x] 5.7 抽樣：手機 886965326188 → 末四碼 6188
