## Context

登入紀錄與帳號管理只顯示 username。實務上帳號有兩種格式：
- **信箱型**（superadmin、後台手動建立）：如 `starlightsystem@gmail.com`——與學員資料無直接關聯，靠信箱無法反查姓名。
- **學員 ID 型**（關懷長以上自助註冊）：username 為學員 ID，可 join `students.name`。

現況缺口：`users` 無 name 欄位、`students` 無 email 欄位，因此信箱型帳號沒有姓名來源。auth session（`checkAuth`）目前也不帶姓名。

## Goals / Non-Goals

**Goals:**
- 讓登入紀錄 / 操作稽核 / 帳號管理 / 頁面頂端顯示可讀姓名，找不到時退回 username（永不空白、不報錯）。
- 建立單一、伺服端、可批次的解析規則，避免前端逐筆查表。
- 自助註冊者自動帶姓名，管理者可為任意帳號手填顯示姓名。

**Non-Goals:**
- 不在 `students` 補 email、不做「信箱↔學員」自動比對（無可靠資料源）。信箱型帳號的姓名一律靠手填 `display_name`。
- 不改動登入 / 權限 / 稽核既有行為，只加「顯示」層。
- 不做姓名的模糊搜尋（搜尋仍以 username 為準）。

## Decisions

### D1. 姓名來源：`users.display_name`（可空）為主，學員姓名為輔
新增 `users.display_name text`。解析優先序：`display_name` → （username 為學員 ID 時）`students.name（ID）` → username。
- **為何**：display_name 覆蓋所有帳號型態（含信箱型 superadmin），且不依賴學員資料；學員姓名作為自助帳號的零維護來源。
- **替代**：只 join students（信箱型無解）；students 補 email 再比對（需維護信箱資料、superadmin 非學員仍無解）——皆不採。

### D2. 伺服端批次解析工具 `lib/auth/displayName.ts`
提供 `resolveDisplayNames(rows: {username, display_name?}[]) → Map<username, label>`：
1. 有 display_name 直接用。
2. 其餘 username 中可轉為整數者，彙整成一次 `students.select('id,name').in('id', ids)` 查詢。
3. 組出「姓名（ID）」；查無則退回 username。
- **為何**：登入紀錄/稽核一次數十~數百筆，批次一次查詢即可，O(1) 次 DB round-trip。
- 由 `/api/login-logs`、`/api/admin-audit` 呼叫，於回應每筆附 `display_name` 欄位。`/api/users` 因已含 display_name 且筆數少，GET 時對「學員 ID 型且無 display_name」者一併補姓名。

### D3. 頂端登入者標示走 checkAuth
`AuthUser` 加 `display_name`；`checkAuth` 從 users 讀出。頁面頂端若無 display_name 且 username 為學員 ID，可退回 username（頂端為單筆，姓名(ID) 補值可選；優先顯示 display_name，否則 username）。保持簡單：頂端顯示 `display_name || username`。

### D4. 自助註冊寫入 display_name
`app/api/login/route.ts` 自助分支已查出 student，`insert users` 時多帶 `display_name: student.name`。需在該處的 `.select` 補 `name`。

### D5. 帳號管理表單加「顯示姓名」欄 + 既有帳號可編輯
`UsersClient` 新增選填輸入；`POST /api/users` 接受並存 `display_name`。列表帳號欄改顯示解析後姓名。
既有帳號（尤其信箱型 superadmin）可透過列表「改姓名」按鈕呼叫 `PATCH /api/users/[id]` 設定/清除 `display_name`（稽核 action=`display_name_updated`），補齊無學員對應的帳號姓名。

## Risks / Trade-offs

- [信箱型舊帳號仍無姓名] → 退回顯示 username（信箱），行為與現況一致、不退步；管理者可事後於新增流程或後續 PATCH 補 display_name。
- [學員改名後自助帳號 display_name 不同步] → display_name 是建立當下快照；可接受（姓名極少變動），且解析對「無 display_name」者才即時 join，屬設計取捨。
- [username 為純數字但非現存學員] → `.in` 查無 → 退回 username，安全。
- [批次 join 增加 API 查詢] → 僅一次 `in()` 查詢、且只查有數字 username 者，成本可忽略。

## Migration Plan

1. 套用 `014_user_display_name.sql`（`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text`）——純增量、可空，對既有資料無影響。
2. 部署程式碼。新自助帳號即帶姓名；舊帳號顯示不變（username），管理者可補填。
3. 回滾：移除欄位使用即可（欄位留著不影響）。

## Open Questions

- 是否要提供「批次為既有信箱帳號補 display_name」的後台工具？本次不做——已提供列表「改姓名」逐一補（PATCH），批次需求暫無。
