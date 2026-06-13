## Context

系統現以單一固定密碼登入、顯示全部學員。認證為自訂的固定密碼 + httpOnly cookie 機制（刻意不使用 Supabase Auth / OAuth，見 CLAUDE.md），`sl_session` cookie 存的是固定 `AUTH_SECRET`，**全域共用、無使用者身分**，`checkAuth()` 目前回傳 `{ valid, email }`（email 為裝飾性、未驗證）。本次升級為**多使用者帳號系統**：每體系數位 admin，一位 superadmin 統一開帳號。無既有雜湊套件，需新增 `bcryptjs`。`createServiceClient()`（service role、bypass RLS）可直接做 users 表 CRUD。

**體系判定欄位釐清**：原以為 `sheet_system` 是體系欄位，實際上它在匯入時被硬編碼為 `'星光'`（`transform.ts:124`），全表 2706 筆皆為星光，**無效**。真正承載體系的是 `business_chain`（業務脈），實際值分佈：星光 1800、太陽 697、神兵 204、覺醒 5。

**體系定義（使用者決定）**：太陽獨立為一個體系（`business_chain === '太陽'`，697 人）；其餘（星光 + 神兵 + 覺醒 = 2009 人）一律歸為星光體系。因此體系是「太陽 vs 非太陽」的二分。

待補：登入無法辨識體系、session 未承載體系、TAB 為切換器、dashboard/counselors/maintenance/org/export 未一致依體系篩選。`SheetSystem` 型別與 `findBySheet()` 雖存在，但因 `sheet_system` 無效，需改以 `business_chain` 為準。

## Goals / Non-Goals

**Goals:**
- 帳號+密碼登入（bcrypt），`users` 表，session 承載使用者身分（id/role/system）。
- superadmin 開設/停用帳號、重設密碼；所有人自行改密碼。
- 所有讀取路徑（頁面 + API）依「有效體系」隔離，以 server session 為準防越權。
- admin TAB 鎖定其體系；superadmin 可切換星光/太陽。
- 體系判定改用 `business_chain`（太陽 vs 非太陽）。
- 修正 `checkAuth()` 被當布林判斷的既有 bug。

**Non-Goals:**
- 不引入 Supabase Auth / OAuth / 第三方登入（維持自訂 cookie session）。
- 不做密碼重設信、Email 驗證、雙因素（未來可另議）。
- 不改寫入路徑的體系歸屬（匯入沿用既有來源；本次聚焦讀取隔離與帳號）。
- 體系 admin 不能管理其他帳號（只 superadmin 能；使用者已決定）。

## Decisions

### D0. 體系判定欄位：`business_chain`（二分：太陽 vs 非太陽）
集中一個工具函式（建議 `lib/utils/system.ts`）：
```
type System = '星光' | '太陽'
systemOf(business_chain): business_chain === '太陽' ? '太陽' : '星光'
```
查詢層篩選對應：
- 太陽：`.eq('business_chain', '太陽')`
- 星光：`.or('business_chain.is.null,business_chain.neq.太陽')`（即非太陽，含 null 與其他值）
- 為什麼用集中函式：判定規則只定義一次，未來若把神兵/覺醒拆出只改一處。
- 不使用 `sheet_system`（已知全為星光、無效）。建議加索引 `idx_students_business_chain` 以維持篩選效能。

### D1. users 表與密碼雜湊
新 migration `010_users.sql`：`users(id uuid pk, username text unique, password_hash text, role text check in (superadmin,admin), system text check in (星光,太陽) null, active bool default true, must_change_password bool default true, created_at, updated_at)`。RLS：anon **不可**讀（敏感），service_role 全權。密碼用 `bcryptjs`（純 JS、無 native binding，適合 Vercel）。
- 約束：`admin` 必須有 system，`superadmin` 的 system 為 null（DB CHECK + 應用層雙重把關）。
- 種子 superadmin：migration INSERT `starlightsystem@gmail.com`，bcrypt 雜湊的初始密碼，`must_change_password=true`。初始密碼字串在實作時產生雜湊寫入 migration，明文僅記於 README/交付訊息，不入庫。
- `business_chain` 已確認無「太陽」變體（697 筆精確相等），二分判定可靠。

### D2. session 承載使用者身分
登入比對 `users.password_hash`（bcrypt.compare）。成功後 session 需識別「是哪個 user」。兩種做法：
- **推薦**：沿用現有 cookie 機制，但 `sl_session` 改存「簽章後的 user payload」。最小改動：新增 httpOnly cookie `sl_session_uid`（user id），`checkAuth()` 以此查 users 表取得 role/system，並確認 active；`sl_session` 仍存 `AUTH_SECRET` 作為「已登入」與防偽（搭配既有 ts/csrf）。
- 進階替代：引入 `jose` 簽 JWT 存於 cookie（免每請求查 DB）。但每請求查 users 表能即時反映停用，較安全，且資料量小。**採推薦做法**。
- `checkAuth()` 回傳 `{ valid, user: { id, username, role, system } }`。停用或查無 → `{ valid: false }`。

### D3. 有效體系與傳遞：server component → prop → store
「有效體系」：admin = `user.system`；superadmin = 其選擇的體系（預設星光，可切太陽），存於 cookie `sl_view_system` 或 client store。
受保護頁 `page.tsx`：`const { valid, user } = await checkAuth(); if (!valid) redirect('/login')`，把 `user.role` 與有效體系當 prop 傳給 Client；Client 寫入 store 並依 role 決定 TAB 可否切換。同時修正 boolean bug。

### D4. 查詢層加體系條件（以 business_chain）
`lib/db/types.ts` 與 `supabaseRepository.ts`（及 `mockRepository.ts`）：
- 新增共用套用函式 `applySystemFilter(query, system)`：太陽→`.eq('business_chain','太陽')`；星光→`.or('business_chain.is.null,business_chain.neq.太陽')`。
- `findBySheet` 改名/改義為依 `business_chain` 篩選（或新增 `findBySystem`），取代原本對 `sheet_system` 的 `.eq`。
- `findByGroupLeader(groupLeader, system, …)`、`findByMaintenanceCategory(category, system, …)` 套用 `applySystemFilter`。
dashboard server 查詢全部套用同一條件。

### D5. counselor_groups 區分體系（不需改 schema）
因體系判定來自學員 `business_chain`，分組隔離可在**查詢層**達成，無需在 `counselor_groups` 加欄位：
- counselors 頁的 `findByGroupLeader` 已套用 `applySystemFilter` → 太陽登入者在任何分組內只見太陽學員，星光登入者只見非太陽學員。
- `buildGroupAssignments()`（`lib/import/assignGroup.ts`）歸屬計算時，沿介紹人/關懷員鏈追溯，建議限定「同體系學員」才納入同一分組，避免跨體系鏈誤歸（太陽學員不應被歸到只有星光的分組，反之亦然）。
- 分組清單本身（9 組）兩體系共用顯示即可；各組內容已被 `applySystemFilter` 切開。若日後要讓某些分組只屬太陽，再加欄位（本次不做）。
- 取消原 `010_counselor_groups_system.sql` migration（改為查詢層隔離）。

### D6. 登出清乾淨
`logout` 補刪 `sl_session` / `sl_session_ts` / `sl_session_uid` / `sl_view_system` / `csrf_token`（目前只刪 `sl_session`）。

### D7. 帳號管理 API 與 UI（僅 superadmin）
- API：`app/api/users/route.ts`（GET 列表、POST 新增）、`app/api/users/[id]/route.ts`（PATCH 停用/啟用、重設密碼）。每個 handler 先 `checkAuth(request)` 且驗證 `user.role === 'superadmin'`，否則 403。
- UI：`app/admin/users/page.tsx`（server 驗 superadmin，否則 redirect）+ client 列表/表單，沿用 login 頁卡片風格與既有 Modal pattern。
- 新增帳號：username、初始密碼、role、（admin 則必填）system；username 重複回錯。

### D8. 自行修改密碼 + 首次強制改密碼
- API：`app/api/account/password/route.ts`（PATCH）：驗 session → 取 user → `bcrypt.compare(oldPassword)` → 不符回 400 → 更新雜湊 → 清除 `must_change_password`。
- 強制改密碼：受保護頁的 `checkAuth()` 後，若 `user.must_change_password` 為 true 則 redirect 到 `/account/change-password`（該頁本身不擋）。或在 layout/各 page 統一判斷。superadmin 新建帳號預設 `must_change_password=true`。
- UI：`app/account/change-password`（強制流程）+ 頂部導覽「改密碼」入口（一般情況）。

## Risks / Trade-offs

- [`business_chain` 為自由文字，可能有未預期值] → 採「太陽 vs 非太陽」二分，任何非太陽值（含 null、神兵、覺醒、錯字）都歸星光，不會漏資料；但若有人把「太陽」打錯字則會被歸星光。可於 tasks 加一次資料盤點確認無變體。
- [星光篩選用 `.or(... neq.太陽)` 效能] → 加索引 `idx_students_business_chain`；資料量 ~2700 筆，影響小。
- [`get_course_funnel` rpc 可能無體系參數] → 若無法加參數，dashboard 漏斗改以 client 端依已篩選學員重算，或新增體系版 rpc。tasks 先探查 rpc 定義再定。
- [RLS 仍允許 anon 全表 SELECT] → 本次隔離在應用層（service key / 查詢條件），非 DB RLS。屬既有架構風險，維持現狀並標註。
- [TAB 鎖定後若 store 預設值殘留] → 確保 Client 掛載即以 prop 覆寫 store，避免閃現他體系。
- [跨體系介紹鏈導致分組誤歸] → `buildGroupAssignments` 限同體系追溯。

## Migration Plan

1. 安裝 `bcryptjs`。
2. 套用 `010_users.sql`（users 表 + RLS + 種子 superadmin）。（可選）加索引 `idx_students_business_chain`。
3. 部署程式碼；`.env.local` 移除 `APP_PASSWORD`，保留 `AUTH_SECRET`。
4. superadmin 登入後開設各體系 admin 帳號。
5. backfill 重新計算分組歸屬（限同體系）。
- 回滾：保留舊 `app/api/login` 固定密碼分支於 git 歷史可還原；users 表為新增、不影響既有資料。

## Open Questions

- ~~初始 superadmin 帳密~~ → 已定：`starlightsystem@gmail.com` + 首次登入強制改密碼。
- ~~business_chain 太陽變體~~ → 已驗證無變體（697 筆精確相等）。
- superadmin 切換體系的 UI 放哪（沿用主表 TAB？還是頂部選單）？以主表 TAB 為主、可調整。
- 神兵/覺醒未來是否拆成獨立體系？（目前歸星光；`systemOf` 預留擴充）
- RLS：users 表絕不可給 anon（已納入設計）；students anon SELECT 維持現狀，標記後續安全項。
