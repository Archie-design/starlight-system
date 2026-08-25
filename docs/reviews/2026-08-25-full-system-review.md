# 全系統程式碼審查報告 — 2026-08-25

← 回 [docs/](../README.md)

**審查方式**：3 個 subagent 平行深入審查（資安 / 效能 / 技術債），涵蓋 `app/`、`lib/`、`components/`、`hooks/`、`store/`（約 122 個檔案、22 個 API route）。
**審查工具**：code-review-expert skill。
**整體評估**：REQUEST_CHANGES — 有多個 P0 級授權漏洞需在下次上線前修復。

本文檔同時作為修復進度追蹤紀錄。每個項目的狀態會隨修復進度更新。

---

## 狀態圖例

| 狀態 | 意義 |
|---|---|
| ⬜ 待處理 | 尚未開始 |
| 🔧 修復中 | 正在處理 |
| ✅ 已修復 | 已完成並驗證 |
| ⏸️ 暫緩 | 已評估但決定延後或不修 |

---

## P0 - Critical

### 1. ✅ `checkAuth()` 系統性遺漏 `request` 參數，CSRF 防護對多數寫入端點形同虛設

**位置**：`app/api/history/route.ts:6`、`app/api/counselor-groups/route.ts:7,43`、`app/api/counselor-groups/[id]/route.ts:9,31`、`app/api/counselor-groups/backfill/route.ts:7`、`app/api/parent-aliases/route.ts:6,20`、`app/api/parent-aliases/[id]/route.ts:9`、`app/api/student-overrides/route.ts:6,45`、`app/api/student-overrides/[id]/route.ts:9,30`、`app/api/import/route.ts:9`、`app/api/edit-logs/route.ts:6`、`app/api/last-updated/route.ts:6`

**問題**：`lib/auth.ts:46-59` 的 CSRF 檢查包在 `if (request) {...}` 內，只有傳入 `NextRequest` 才會執行。上列所有路由都呼叫 `checkAuth()`（不帶參數），CSRF 檢查完全跳過，只驗證 session cookie 有效性。只有 `org`、`export`、`import/apply` 正確傳了 `request`。（資安審查與技術債審查兩個 agent 各自獨立發現，互為交叉驗證。）

**修法**：所有 route handler 統一改為 `checkAuth(request)`；長期應把 `request` 改為必要參數，或拆成 `checkAuthReadOnly()`/`checkAuthMutation(request)` 兩個函式，用型別系統杜絕未來再漏寫。

**修復紀錄**：所有 17 處 `checkAuth()`/`checkAuth()` 呼叫已統一改為傳入 `request`（部分同時升級為 `requireManager(request)`，見 #2-#5、#22）。逐一確認每個 handler 簽章都有 `request: NextRequest` 可用，原本 `GET()` 無參數的（`history`、`edit-logs`、`last-updated`）也補上。跑過 `grep -rn "checkAuth()" app/api` 確認全清除，`npx tsc --noEmit` 全專案通過。

---

### 2. ✅ `import`／`import/apply` 無角色與體系限制，可跨體系寫入/覆蓋學員資料

**位置**：`app/api/import/route.ts:9`、`app/api/import/apply/route.ts:9-11`

**問題**：只驗證「已登入」，一般 `admin`（非管理層級）就能上傳並套用匯入；`import/apply` 直接 upsert `importRows` 進 `students`，未檢查列資料的 `business_chain` 是否等於呼叫者的 `getEffectiveSystem()`。綁定星光體系的 `admin` 可構造含 `business_chain: '太陽'` 的資料覆寫太陽體系學員。

**修法**：改用 `requireManager`；套用前過濾/拒絕不屬於呼叫者體系的資料列（`superadmin` 例外）。

**修復紀錄**：兩個 route 都改用 `requireManager(request)`（一般 `admin` 不再能觸發匯入）。`import/route.ts` 在 preview 階段檢查 `importRows` 是否含非呼叫者有效體系的 `business_chain`，有則直接拒絕（400）。`import/apply/route.ts` 在套用階段對 `diff_snapshot` 讀出的 `importRows` 再做一次同樣的防禦性檢查（不信任 preview 階段的把關已經足夠，因為 apply 可能是不同時間點的請求），有非同體系資料則回 403。`superadmin` 不受此限制。`tsc --noEmit` 通過。

---

### 3. ✅ `counselor-groups`（含 `[id]`）寫入路徑無體系檢查，PATCH 且為 mass-assignment

**位置**：`app/api/counselor-groups/route.ts:42-58`（POST）、`app/api/counselor-groups/[id]/route.ts:5-25`（PATCH，`.update(body)` 無欄位白名單）、`:27-43`（DELETE）

**問題**：GET 有正確依 `root_student_id` 過濾體系，但 POST/PATCH/DELETE 完全沒有等價檢查——PATCH/DELETE 操作前甚至不查詢目標分組屬於哪個體系。任一 `admin` 可直接竄改/刪除另一體系的分組設定，直接影響 `buildGroupAssignments()` 的歸屬計算。

**修法**：PATCH/DELETE 前先查出目標分組所屬體系並比對 `actor.system`；POST 驗證 `root_student_ids` 屬於呼叫者體系；PATCH 改用明確欄位白名單。

**修復紀錄**：全部改用 `requireManager`。`[id]/route.ts` 新增 `resolveGroupSystem()` helper（比照 GET 的判定規則：取 `root_student_ids` 第一個能判定體系的根節點），PATCH/DELETE 操作前都先查出目標分組所屬體系並與 `actor` 的有效體系比對（`superadmin` 不受限）；PATCH 新增 `ALLOWED_FIELDS = ['name', 'display_order', 'root_student_ids']` 白名單，不再 `.update(body)` 全量信任。POST 新增：`root_student_ids` 指定的學員須全部屬於呼叫者有效體系才允許建立。`tsc --noEmit` 通過。

---

### 4. ✅ `counselor-groups/backfill` 無角色/體系限制，任一 admin 可觸發跨體系全量重算

**位置**：`app/api/counselor-groups/backfill/route.ts:6-7`

**問題**：只驗證登入，內部分頁讀取**兩個體系**全部學員並重算寫回 `group_leader`。任一 `admin` 可觸發，可能覆蓋另一體系已手動調整的分組指派，也是潛在 DoS 手段。

**修法**：改用 `requireManager`，且僅重算呼叫者所屬體系（`superadmin` 可選跨體系）。

**修復紀錄**：改用 `requireManager(request)`。計算完 `assignments`（全體系，因為上線鏈追溯需要完整 `studentMap` 才能正確解析）後，新增 `scopedAssignments` 過濾步驟，只把屬於呼叫者有效體系的學員納入實際寫回範圍；`superadmin` 依目前選擇的體系。順手修了 P2 #28：批次 `.update()` 的回傳值原本完全沒檢查 `error`，現在檢查了、失敗會回 500。`tsc --noEmit` 通過。

---

### 5. ✅ `parent-aliases`、`student-overrides` 系列 API 無角色/體系限制

**位置**：`app/api/parent-aliases/route.ts:19-37`（POST）、`[id]/route.ts:5-21`（DELETE）、`app/api/student-overrides/route.ts:44-67`（POST）、`[id]/route.ts`（PATCH/DELETE）

**問題**：這兩組 API 是 CLAUDE.md 明確定義、影響全系統分組歸屬計算的覆寫機制，同樣只驗證登入，未檢查目標 `student_id` 所屬體系。任一 `admin` 可跨體系竄改代管/覆寫關係。

**修法**：寫入前解析涉及學員的 `business_chain` 並比對呼叫者體系；改用 `requireManager` 限制一般 `admin` 不可操作。

**修復紀錄**：新增共用 helper `studentIdsAllInSystem()`（`lib/utils/system.ts`），檢查一批學員 ID 是否全部屬於指定體系。四個檔案（`parent-aliases` GET/POST、`[id]` DELETE、`student-overrides` GET/POST、`[id]` PATCH/DELETE）全部改用 `requireManager`；POST 寫入前用 helper 驗證涉及的學員 ID 皆屬呼叫者體系；`[id]` 的 PATCH/DELETE 先查出既有紀錄涉及的學員 ID 再驗證體系是否相符（`superadmin` 不受限）。`tsc --noEmit` 通過。

---

### 6. ✅ `applySort()` 在兩份 Repository 逐字重複，是已知重構「半套完成」的產物

**位置**：`lib/db/supabaseRepository.ts:100-115`、`lib/db/mockRepository.ts:47-62`

**問題**：commit `1da4699` 只把排序**白名單**抽出共用，排序**演算法**本身仍留在兩處。任何調整都要同步改兩處，且無測試保護，容易漂移出 Mock 與正式環境行為不一致。

**修法**：把 `applySort()` 移到 `lib/utils/columnFilter.ts`（兩個 repository 都已 import 它），純函式抽取，風險低。

**修復紀錄**：`applySort()` 移到 `lib/utils/columnFilter.ts`（`export function applySort`），兩個 repository 都刪除各自的本地定義、改為 import 共用函式。用 mock repository 跑排序驗證（`business_chain` 遞增排序結果正確）確認行為未變。`tsc --noEmit` 通過。

---

### 7. ✅ `MultiSelectDropdown` 清除按鈕仍是雙 callback 各自呼叫 `setColumnFilter` 的舊模式

**位置**：`components/shared/MultiSelectDropdown.tsx:163-173`

**問題**：這正是最近一次修復（commit `0b1541e`）想根除的 race condition 結構，`toggle()` 已改為單一 callback 並在注解寫明原因，但「清除」按鈕仍是 `onChange([]); onIsEmptyChange?.(null)` 兩次獨立呼叫——目前恰好兩邊都寫 `null`/`[]` 才沒現形。`ColumnHeaderControls.tsx` 呼叫此元件時 `onChange`/`onModeChange`/`onIsEmptyChange` 三者也是各自獨立寫入同一個 store key，是同一種根本結構。

**修法**：仿照 `TextFilterPopover` 的 `onApply` 模式，把三個回呼合併成單一 `onApply(result)`，從結構上消除「多個回呼寫同一個 store 欄位」這個問題根源。

**修復紀錄**：新增 `MultiSelectResult` 判別型別（`{kind:'values',...} | {kind:'isEmpty',...} | null`）與單一 `onApply?` prop，取代原本的 `onModeChange`/`onIsEmptyChange` 兩個獨立回呼；模式切換、為空/不為空、清除按鈕現在都只呼叫 `onApply` 一次。`onChange`（勾選 checkbox）維持不變，仍是安全的單一呼叫。`ColumnHeaderControls.tsx` 的 enum 分支改用 `onApply` 依 `result.kind` 寫回對應的 `ColumnFilterValue`。寫腳本模擬 store 的 `setColumnFilter` 語意，驗證 4 個情境（模式切換保留已勾選值、套用為空、從為空狀態改勾選 checkbox 正確覆蓋、清除）全數通過。`tsc --noEmit` 通過。

---

### 8. ✅ 三份 `useXxxStudents` SWR hook 結構與 `updateCell` 邏輯逐字重複

**位置**：`hooks/useStudents.ts:10-69`、`hooks/useCounselorStudents.ts:10-54`、`hooks/useMaintenanceStudents.ts:10-52`

**問題**：三者的 SWR key 組裝、`updateCell()` optimistic update 邏輯（找 student → 抓 oldValue → mutate + rollbackOnError）逐字複製，且 `useMaintenanceStudents` 已因業務差異局部分岔，是持續惡化中的重複。

**修法**：先抽出共用的 `updateCell` 邏輯（低風險純函式），視情況再評估是否抽整個 SWR wrapper。

**修復紀錄**：新增 `hooks/useUpdateCell.ts`，把 optimistic update 邏輯抽成共用 hook `useUpdateCell(repo, data, mutate, username, options?)`，用 `options.removeOnEdit` 參數表達 `useMaintenanceStudents` 的業務差異（編輯後不直接改本地資料、改由 revalidate 重新抓取），不強行合併不同語意。三個 hook 都改為呼叫這個共用 hook，各自檔案從 40-60 行縮到 20 行左右。`tsc --noEmit` 通過。（SWR key 組裝本身因三者的 key 結構仍有實質差異——`counselor` 多了 `activeGroup` 的 null 判斷、`maintenance` 沒有 `sort`——這次先不強行合併整個 wrapper，維持三個薄 hook。）

---

## P1 - High

### 9. ✅ `EditableCell` 每格各自訂閱 `useStudents()`，單一格編輯觸發整頁上千格重渲染

**位置**：`components/StudentGrid/EditableCell.tsx:22`、`components/StudentGrid/columns.tsx`

**問題**：100 列 × ~35 可編輯欄 ≈ 3500 個 `EditableCell` 實例都獨立訂閱同一 SWR key，任一格 `mutate()` 會讓所有訂閱者重新 render 一次。

**修法**：`updateCell` 改由父層 `StudentGrid` 統一取得，透過 props/context 往下傳，子元件不直接訂閱 SWR。

**修復紀錄**：新增 `components/StudentGrid/StudentEditContext.tsx`（`StudentEditProvider`/`useStudentEditContext`），`EditableCell` 改為從 context 讀取 `updateCell`，不再各自呼叫 `useStudents()`。

**⚠️ 修復過程中發現的額外正確性 bug（超出原審查範圍，一併修復）**：`EditableCell` 原本寫死呼叫 `useStudents()`（`/students` 頁專用），但它是 `columns.tsx` 共用的欄位定義，也被 `CounselorStudentGrid`（`/counselors`）與 `MaintenanceStudentGrid`（`/maintenance`）使用——這兩個頁面編輯儲存格時，實際上是在樂觀更新 `/students` 的 SWR 快取（不會反映在畫面上，因為畫面資料來自各自的 `useCounselorStudents()`/`useMaintenanceStudents()`），且稽核紀錄的 `oldValue` 是從 `/students` 的資料裡查（範圍不同，很可能查無此人、記成 `null`，汙染 `edit_logs` 稽核軌跡）。資料庫寫入本身沒錯（`repo.updateCell()` 用 `id` 直接寫，不受此影響），但 UI 樂觀更新與稽核紀錄的 `oldValue` 是錯的。三個 Grid 元件（`StudentGrid`、`CounselorStudentGrid`、`MaintenanceStudentGrid`）都改為各自把自己 hook 拿到的 `updateCell` 透過 `StudentEditProvider` 往下傳，correctness 與 perf 一併修復。`tsc --noEmit` 通過。

---

### 10. 🔧 常用篩選操作預設命中全量載入路徑

**位置**：`lib/db/supabaseRepository.ts:60-68`（`needsPostFilter`）

**問題**：快捷視圖、會籍狀態、課程進度、表頭 enum/range 篩選都不是邊緣情況，而是 FilterBar 上最顯眼的常用功能，命中時把整個體系資料載入記憶體再用 JS filter/sort。

**修法**：優先把高頻條件（courseStage、membershipStatus、isNewbie）下推 SQL 或用 generated column + 索引；僅 `duplicate_name` 因需跨列聚合保留全量路徑。

**修復紀錄**：範圍經與使用者確認縮小為「只下推 `isNewbie`」（低風險，其餘條件維持全量路徑，另評估）。

- `lib/utils/studentStatus.ts`：`NEWBIE_DAYS` 改為 `export`，作為 SQL 下推與 JS 判定共用的唯一天數常數。
- `lib/db/supabaseRepository.ts`：
  - 新增 `newbieThresholdIso(now)`，把 `isNewbie()` 的 `Math.ceil((now - createdAt) / day) <= 30` 語意轉換為 SQL 可下推的 `created_at >= now - 30天` 門檻比較（已用 tsx 腳本驗證邊界案例：29/29.5/30/30±1ms/30.5/31 天皆與原 JS 版本判定一致）。
  - `applyCommonFilters()` 新增 `now` 參數，並在 `filters.isNewbie` 為真時下推 `.gte('created_at', ...)`；5 個呼叫點（`findBySystem`/`findByGroupLeader`/`findByMaintenanceCategory`/`getDistinctValues` 的窄查詢與全量查詢）都已傳入一致的 `now`。
  - `needsPostFilter()` 移除 `!!filters.isNewbie`，使「只勾選 isNewbie」時能走 `.range()` 快速分頁路徑，不再全量載入。
  - `matchesPostFilter()` 移除對應的 JS 端 `isNewbie` 檢查（已在 SQL 層下推，避免兩邊各過濾一次、若語意漂移會篩出不一致結果）。

**明確保留、未下推的部分（範圍內刻意不動，供後續評估）**：
- 「本月新生」快捷視圖（`filters.view === 'newbie'`）語意與 `isNewbie` 勾選相同，但混在同一個 `switch` 分支處理其他快捷視圖（續報/欠款/同名），要下推需拆分該分支邏輯，複雜度與出錯風險較高，這次不動。
- `membershipStatus`、`courseStage` 依使用者決策維持全量路徑——目前資料量（約 2000-3000 筆）尚未構成明顯痛點，之後資料量成長或有效能反饋時再評估下推或建 index。

`npx tsc --noEmit` 通過。

---

### 11. ✅ `applySystemFilter` 對星光體系用未建索引的 OR 查詢，是所有查詢的必經路徑

**位置**：`lib/utils/system.ts:24-31`

**問題**：`business_chain` 無索引，`.or('is.null,neq.太陽')` 難被單一索引利用，且是每次查詢的必經條件。

**修法**：新增 generated column（如 `sheet_system_computed`）並建索引，取代 OR + neq 組合。

**修復紀錄**：附帶發現既有的 `sheet_system` 欄位（已有索引 `idx_students_system`）其實是死欄位——只在匯入時寫入，實際體系判定全部走 `business_chain`（`lib/utils/system.ts` 的 `systemOf()`），從未被查詢用來做體系隔離，所以原本等於完全沒有索引可用。

- 新增 `supabase/migrations/015_performance_indexes.sql`：加 generated column `system_computed`（`CASE WHEN business_chain = '太陽' THEN '太陽' ELSE '星光' END`，STORED）+ 索引，以及與 `id` 的複合索引（體系隔離 + 預設排序是所有分頁查詢的必經路徑）。
- `lib/utils/system.ts` 的 `applySystemFilter()` 改為對 `system_computed` 做等值查詢，取代原本的 `.or('business_chain.is.null,business_chain.neq.太陽')`。
- `npx tsc --noEmit` 通過（型別檢查不會發現欄位是否存在於實際資料庫，僅確認程式碼本身型別正確）。
- ✅ **使用者已於 Supabase SQL Editor 執行 `015_performance_indexes.sql`，並實際連線資料庫驗證**：`system_computed` 欄位查詢正常（星光 2,076 筆／太陽 747 筆）、抽樣 20 筆計算值與 `business_chain` 全部一致，`applySystemFilter()` 的查詢路徑確認可用。

---

### 12. ✅ CSRF 判斷邏輯本身有繞過空間

**位置**：`lib/auth.ts:51-55`

**問題**：`!referer` 直接視為本機放行；`.includes('localhost')` 是子字串匹配，`http://localhost.attacker.com` 也會被誤判通過。

**修法**：改為嚴格 origin 比對（`new URL(referer).origin === allowed`），無 Referer 時不應預設放行，應強制要求有效 CSRF token。

**修復紀錄**：跟 #1 一起修的。改用 `allowedOrigins` Set（`localhost:3000`、`127.0.0.1:3000`、`NEXT_PUBLIC_APP_URL`）+ `new URL(referer).origin` 嚴格比對，取代原本的子字串 `.includes()`；無 Referer 時不再直接放行，必須有有效的 `x-csrf-token` 才能通過。`tsc --noEmit` 通過。

---

### 13. ✅ 登入與改密碼端點無任何速率限制

**位置**：`app/api/login/route.ts`、`app/api/account/password/route.ts`

**問題**：自助登入模式的密碼空間只有手機末四碼（4 位數字，最多 1 萬種組合），學員 ID 是可枚舉的遞增整數，無速率限制下可被暴力破解取得 `admin`/`system_admin` 權限。

**修法**：對這兩個端點加入 IP/帳號維度的速率限制或失敗鎖定機制。

**修復紀錄**：新增 `lib/auth/rateLimit.ts` 的 `checkLoginRateLimit()`。

- 考量 Serverless 部署下記憶體不跨 instance 共用，沒有另外建計數器表或引入 Redis/Upstash 等外部依賴，改為直接查詢既有的 `login_logs` 稽核表（本來就記錄每次登入嘗試的 IP／帳號／時間），當滑動視窗（10 分鐘）計數用。
- 兩個維度分別限制：同 IP 10 分鐘內失敗 ≥ 20 次，或同帳號 10 分鐘內失敗 ≥ 8 次，回傳 429。查詢本身出錯時 fail-open（放行），避免稽核表異常直接讓登入全面中斷。
- `app/api/login/route.ts`：驗證帳密前先檢查速率限制，命中時仍呼叫 `logLoginEvent('login_failure', ...)`（維持稽核完整性）並回 429。
- `app/api/account/password/route.ts`：在驗證舊密碼前檢查（以登入後的 `user.username` 為鍵）；同時修正了新增速率限制過程中發現的計數缺口——原本這支端點驗證舊密碼失敗時完全沒寫入 `login_logs`，速率限制查詢會永遠算不到失敗次數，補上 `logLoginEvent('login_failure', ...)`。

`npx tsc --noEmit` 通過。

---

### 14. 🔧 匯入 upsert 無交易保證，部分失敗不會回滾

**位置**：`app/api/import/apply/route.ts:104-156`

**問題**：程式碼註解自陳「暫時使用批次 upsert，後續可升級為完整事務」。部分批次失敗時已成功的批次不回滾，且冪等性檢查可能導致重試時重複寫入。

**修法**：改用真正的資料庫交易，或至少回傳「哪些 id 已成功寫入」供排查。

**修復紀錄**：採用審查建議的「至少……」路線，未做真正的跨批次資料庫交易——Supabase REST API 沒有原生支援，真正的原子性需要另外寫一個 Postgres function 把整段流程（含 `buildGroupAssignments` 的分組邏輯）搬進 PL/pgSQL 執行，改動範圍與風險都明顯更大，這次不做，留待未來評估。

- `app/api/import/apply/route.ts`：批次 upsert 失敗時，改為精確收集失敗的學員 id（`failedIds`），而非只累加筆數；回應 body 與 `logAdminAction` 的稽核紀錄都帶上完整失敗 id 清單（稽核 detail 超過 50 筆時截斷 + 加註）。
- 確認並補上重試安全性的說明：`upsert(..., { onConflict: 'id' })` 對每一列本來就是冪等覆蓋，失敗批次可直接重試同一個 `session_id`（未成功的 session 不會被標記 `applied`，前面既有的冪等性檢查會擋下已成功的 session 重跑），不會造成重複寫入。

`npx tsc --noEmit` 通過。

---

### 15. ✅ `getDistinctValues()` 的全量後備路徑抓整列而非窄查詢

**位置**：`lib/db/supabaseRepository.ts:234-252`

**問題**：已有篩選需要 JS 後處理時，取得單一欄位不重複值卻 fallback 到 `select('*')`，資料傳輸量放大約 40 倍（欄位數）。

**修法**：依需要的欄位動態決定 select 清單，而非整列。

**修復紀錄**：新增 `POST_FILTER_BASE_FIELDS` 常數 + `postFilterProjectionFields()`，取代該路徑的 `baseSelect()`（`select('*')`）。

- 固定基礎欄位：`matchesPostFilter()` 內部各判定函式實際會用到的欄位——`id`/`name`/`created_at`（快捷視圖：同名／本月新生）、`course_1~5`/`course_wuyun`/`payment_1~5`/`payment_wuyun`（課程進度／續報／欠款）、`membership_expiry`（會籍）。
- 動態欄位：目前生效的表頭逐欄篩選（`sanitizeColumnFilters(columnFilters)` 的 key），確保 `matchesColumnFilters()` 需要比對的欄位一定在投影內。
- 加總後從整列（~50 欄）窄化為固定 16 欄 + 動態命中的篩選欄位，用 tsx 腳本驗證兩種情境（快捷視圖 / 表頭欄位篩選）的欄位清單皆正確涵蓋依賴。
- ⚠️ 修復過程中發現：初版遺漏了 `created_at`（`view === 'newbie'` 快捷視圖判定 `isNewbie(s, now)` 依賴的欄位），若未補上會導致「本月新生」快捷視圖在 `getDistinctValues()` 這條路徑下靜默失效（`created_at` 為 `undefined` → 全部判定為非新生）。已在提交前修正並重新驗證。

`npx tsc --noEmit` 通過。

---

### 16. ✅ 排序/篩選白名單涵蓋的欄位大多沒有對應資料庫索引

**位置**：`supabase/migrations/001_schema.sql`；對照 `lib/utils/columnFilter.ts` 的 `SORTABLE_FIELDS`/`COLUMN_FILTER_FIELDS`

**問題**：僅 `counselor`、`region`、`group_leader` 有索引，`membership_expiry`、`business_chain`、`birthday` 等常用排序/篩選欄位皆無。

**修法**：至少為 `membership_expiry`、`business_chain`、`birthday` 建索引，並考慮與 #11 的 `sheet_system_computed` 組成複合索引。

**修復紀錄**：與 #11 合併在同一個 migration 處理（`supabase/migrations/015_performance_indexes.sql`），新增 `idx_students_membership_expiry`、`idx_students_birthday` 兩個索引（`business_chain` 的索引在核對時發現 `010_users.sql` 已建過，故不重複新增，migration 裡有加註說明）。純新增索引，不影響既有查詢正確性，執行前後程式碼行為一致，只差在有無索引加速。

✅ **使用者已於 Supabase SQL Editor 執行 `015_performance_indexes.sql`**（與 #11 同一個 migration），索引已生效。

---

### 17. ✅ Dashboard 對同一份 `allStudents` 重複約 15 次獨立遍歷

**位置**：`app/dashboard/page.tsx:94-167`

**問題**：每次載入 dashboard（Server Component，每請求重跑）都對全量資料做 15 次 `.filter()`/`.map()`，其中課程進度的 6 次可合併成單一 `reduce`。

**修法**：合併為單次遍歷；更根本是把聚合統計改為 SQL 層 `count()`/`group by`。

**修復紀錄**：把 `courseFunnel`（6 次 `.filter().length`）、`paymentDistribution`（6 個階別各自 `.filter()` + `.forEach()`）、`unpaidAlerts`（`.map()` + `.filter(Boolean)` + `.slice(100)`）、`groupStudents`、`membershipData`、`distributionDetail` 合併為單一 `for...of` 迴圈，一輪算完全部統計。`unpaidAlerts` 改用 push 時即檢查 `length < 100` 提前跳過累積（等效於原本先跑滿全量再 slice(0,100)，因為陣列順序未變、都是取前 100 筆——已用 tsx 腳本以 500 筆隨機資料驗證新舊邏輯輸出完全一致，含 `courseFunnel`/`paymentDistribution`/`groupStudents`/`unpaidAlerts`/`membershipData` 五項）。

更根本的「改成 SQL 層 `count()`/`group by`」未做——目前查詢本身就是為了組出 Dashboard 需要的多種明細（`distributionDetail`/`unpaidAlerts` 需要逐筆資料而非純聚合數字），要整套改寫成 SQL 聚合會動到資料流設計，超出這次「合併重複遍歷」的範圍，列為後續可評估方向。

**⚠️ 修復過程中發現的額外型別問題（超出原審查範圍，一併修復）**：`membershipData` 傳給 `DashboardClient` 的 prop 型別是 `{ id: string, ... }`，但 `Student.id` 實際是 `number`（`lib/supabase/types.ts:24`）。原本因為 Supabase 查詢鏈結果型別在這個檔案裡實質退化為寬鬆型別而沒有被 `tsc` 抓到；這次把中間變數明確標註型別後浮現此不一致，已用 `String(s.id)` 修正。`npx tsc --noEmit` 通過。

---

### 18. ✅ 匯出功能無資料量上限，`exceljs` 全記憶體建構

**位置**：`app/api/export/route.ts:52-61`、`lib/export/buildXlsx.ts:64-66`

**問題**：全量載入 + 非 streaming 的 `ws.addRow()` + 一次性 `writeBuffer()`。資料量成長後有記憶體峰值與 Serverless Function 逾時/OOM 風險。

**修法**：改用 `exceljs` streaming writer，或超過門檻的匯出改為背景任務。

**修復紀錄**：新增 `streamStudentsXlsx()`（`lib/export/buildXlsx.ts`），用 `ExcelJS.stream.xlsx.WorkbookWriter` 邊寫邊吐出 bytes；原本一次性版本 `buildStudentsXlsx()` 保留供小量/測試使用，不刪除。

- `app/api/export/route.ts`：分頁查詢從「先全部塞進 `all: Student[]` 陣列」改為 async generator（`pages()`）逐頁 yield，直接接到 `streamStudentsXlsx()`；回應改用 `Readable.toWeb(nodeStream)` 當 body，整條路徑（DB 查詢 → xlsx 編碼 → HTTP 回應）都是邊產生邊送出，不再有「等全部資料到齊才開始寫檔」的記憶體峰值與延遲。
- 稽核紀錄（`logAdminAction('data_export', ...)`）原本用累積陣列的 `.length`，改為分頁迴圈累加的 `totalCount`，並移到 stream 的 `'end'` 事件觸發（不阻塞回應本身送出）；已用腳本驗證 `Readable.toWeb()` 消費完畢後 Node 端 `'end'` 事件仍會正確觸發。
- 隔行底色原本靠 `ws.eachRow()` 事後統一套用，streaming writer 下尚未 flush 的列讀不到、無法沿用，改為逐列產生時直接依 `rowNumber % 2` 判斷套用。
- **修復過程中的實際踩坑**：`WorksheetWriter`（streaming 版）的 `views` 是唯讀 getter，用一次性 API 慣用的 `ws.views = [...]` 賦值會直接丟 `TypeError`，須改在 `addWorksheet(name, { views: [...] })` 建立當下傳入。已修正。
- 驗證：寫 tsx 腳本用 250 筆隨機資料比對新舊兩條路徑產出的 xlsx——用 ExcelJS 重新解析兩份 buffer，逐列比對 cell values（251 列全部一致）、標題列粗體、隔行底色 `fgColor`，結果完全一致；另外驗證 `Readable.toWeb()` 端到端可正常讀取串流位元組。

`npx tsc --noEmit` 通過。超過門檻改背景任務（審查提到的另一個選項）未做——串流本身已顯著降低記憶體峰值，是否還需要背景任務視實際資料量成長再評估。

---

### 19. ✅ `MaintenanceStudentGrid` 仍用 client-side 排序，架構上從未跟進其他兩個 Grid 的伺服器端排序

**位置**：`components/MaintenanceLayout/MaintenanceStudentGrid.tsx`

**問題**：`StudentGrid`/`CounselorStudentGrid` 已改伺服器端排序，維護專區仍用 `getSortedRowModel()` 對「當頁」排序——有伺服器分頁時語意是錯的。

**修法**：資源有限時可考慮直接移除表頭排序避免誤導；要修正則比照其他兩者加上 `sort` 參數。

**修復紀錄**：與使用者確認後採用「直接移除」（維護專區資料量小、使用頻率低，加伺服器端排序需擴充 `StudentRepository` 介面的 `findByMaintenanceCategory`、兩個 repository 實作、hook、store，改動範圍與風險明顯較大）。

- `MaintenanceStudentGrid.tsx`：移除 `sorting` state、`getSortedRowModel`、`onSortingChange`；表頭 `onClick`/`getToggleSortingHandler`、排序箭頭圖示、`cursor-pointer` 樣式一併移除。維持 repository 回傳的預設順序（依 id 遞增）。
- 未變動 `columns.tsx` 的 `enableSorting`/`getCanSort` 標記——此表格實例已不掛 sorting model，這些標記在這裡自然不生效，不影響其他兩個 Grid 共用同一份欄位定義。

`npx tsc --noEmit` 通過。

---

### 20. ⏸️ `COLUMN_FILTER_FIELDS` 仍是獨立於 `columns.tsx` 之外人工同步的白名單

**位置**：`lib/utils/columnFilter.ts:18-19`

**問題**：排序白名單已統一成單一事實來源，但篩選白名單刻意維持兩處平行維護（為了讓 `lib/` 不依賴 UI 元件）。目前尚未漂移出 bug，但機制上與過去曾發生過的排序白名單漂移是同一種風險。

**修法**：抽出不依賴 React 的共用 `fieldRegistry.ts`，`columns.tsx` 與 `columnFilter.ts` 都從它讀取。

**修復紀錄**：與使用者確認後，這次先不動，僅記錄評估結果，留待後續 P2/技術債排程再處理。

**評估結果**：實際檢視 `columns.tsx` 後發現，每個欄位除了 `filterable` 型態外，還綁了 `enumOptions`（下拉選單選項，純 UI 概念）、中文欄位標題、欄寬（`size`）等大量 UI 專屬資訊，且以 ~46 個 `editable()`/`selectCell()`/`ch.accessor()` 呼叫散落定義，並非單純的型態對照表。要做到審查建議的「完全統一成 `fieldRegistry.ts`」，代表：
- `fieldRegistry.ts` 需要決定 UI 專屬資訊（`enumOptions`/標題/寬度）要不要一起搬進去（搬進去會讓「不依賴 UI 元件」的 `lib/` 分層目的打折；不搬進去則兩處還是要各自維護一部分，統一的效益有限）。
- 至少要重寫 `columns.tsx` ~46 個欄位定義呼叫，並完整回歸測試表頭篩選/排序/欄寬/下拉選單在三個 Grid（`StudentGrid`/`CounselorStudentGrid`/`MaintenanceStudentGrid`）的行為。

**建議**：目前沒有實際 bug、只是預防性技術債，改動面與回歸風險大於現況的好處。建議留在下一輪技術債排程（非本次 P0/P1 修復範圍）時，先確認是否要把 UI 專屬資訊一併搬入共用檔，再動手，避免中途發現搬一半更難維護。

---

### 21. ✅ `NewStudentModal` 是文件已記載的死碼，且繞過 `StudentRepository` 抽象

**位置**：`store/useStudentStore.ts:81-82,146-147`、`components/NewStudentModal/index.tsx:11,40,55-66`

**問題**：`setNewStudentOpen(true)` 沒有任何呼叫點，元件恆為 `null`。額外發現：`handleSave()` 直接呼叫 `createClient().from('students').insert()`，繞過 `StudentRepository`。

**修法**：確定要啟用則接上觸發按鈕並改走 repository 的新增方法；確定不用則直接移除。

**修復紀錄**：與使用者確認後採用「直接移除」。

- 刪除 `components/NewStudentModal/`（整個目錄）。
- `app/students/StudentsClient.tsx`：移除 `import NewStudentModal` 與 `<NewStudentModal />` 渲染。
- `store/useStudentStore.ts`：移除 `newStudentOpen`/`setNewStudentOpen` 狀態與其初始值。
- 確認 `REGIONS`/`ROLES`（`lib/constants`）、`useModalDismiss`（`lib/hooks`）在其他地方仍有使用，未變成孤兒 export，不需一併清理。

`npx tsc --noEmit` 通過，全域搜尋確認無殘留參照。

---

## P2 - Medium

### 22. ✅ 稽核/紀錄類 API 未做體系範圍限制
**位置**：`app/api/edit-logs/route.ts:6`、`app/api/history/route.ts`、`app/api/admin-audit/route.ts:6-9`、`app/api/login-logs/route.ts:6-9`
**修法**：`edit-logs`/`history` 至少要求 `requireManager`；理想上依 `student_id` 反查體系過濾。
**修復紀錄**：`edit-logs`、`history`、`history/[id]` 已改用 `requireManager(request)`（原本只驗證登入）。`admin-audit`、`login-logs` 本來就已是 `requireManager`，不用改。

**剩餘部分（依 `student_id` 反查體系過濾）已補上**：
- `app/api/edit-logs/route.ts`：`edit_logs` 有 `student_id`，非 superadmin 時額外反查 `students.business_chain`，過濾出非本體系的紀錄後才回傳。反查不到體系的（例如學員已被刪除）保守排除，不預設放行。
- `app/api/history/[id]/route.ts`：`import_logs` 明細同樣有 `student_id`，用相同方式過濾。
- `app/api/history/route.ts`：`import_sessions`（session 列表）本身沒有體系欄位；非 superadmin 時額外取 `diff_snapshot`，用第一筆資料的 `business_chain` 推斷整個 session 的體系（#2 已限制匯入不能跨體系，理論上同一 session 內所有列同屬一個體系），過濾後從回應中移除 `diff_snapshot`（不把完整快照回傳給前端）。

**已知限制（可接受，未特別處理）**：`history` 先 `.limit(100)` 取最新 100 筆才過濾體系，若最新 100 筆恰好都不是本體系的資料，可能回傳空陣列（即使更早的歷史中有本體系資料）。這是低流量管理頁面，可接受，未額外處理分頁或提高 limit。

`npx tsc --noEmit` 通過。

### 23. ✅ 體系隔離完全依賴應用層，資料庫 RLS 對 service_role 無體系範圍限制
**位置**：`lib/utils/system.ts`、RLS 政策
**修法**：建立「呼叫 `applySystemFilter`」的 code review checklist 或 lint 規則。
**修復紀錄**：`service_role` 本來就是 Supabase 設計成繞過 RLS 用的角色，無法在 RLS 層面收斂，只能靠應用層紀律；專案目前完全沒有 ESLint 設定（無 lint script、無設定檔），從零建自訂 AST 規則投資偏大，經與使用者確認後改用較輕量的方案。

新增 `scripts/check-system-filter.mjs`（`npm run check:system-filter`）：靜態掃描所有 `app/api/**/route.ts`，找出「查詢了 `students` 表卻沒有呼叫 `applySystemFilter`」的可疑檔案，找到就以非零 exit code 失敗。附帶一份 `ALLOWLIST`，收錄目前 9 個合法但不用（或用其他方式做）體系隔離的檔案，並逐一寫明理由（例如用 `systemOf()` 逐筆檢查、用 `studentIdsAllInSystem()` 驗證、反查 `student_id` 等模式）；腳本也會檢查白名單裡是否有已不存在的檔案路徑，避免白名單隨時間腐化。

這是啟發式（heuristic）字串比對，不是型別系統或 AST 級別的保證，用途是攔住「新增 route 忘記處理體系」這種最常見的疏漏模式，非完整正確性證明。已用真實檔案（22 個 route）跑過確認 0 誤報，並臨時建構一個違規範例確認偵測邏輯正確會抓到。未接入 CI（專案本來就沒有 CI pipeline），僅提供手動執行的 npm script。

### 24. ✅ 密碼強度僅檢查長度，`users` POST 建帳號甚至無任何強度檢查
**位置**：`app/api/account/password/route.ts:22-24`、`app/api/users/route.ts`
**修法**：`users` POST 也套用一致的密碼規則。
**修復紀錄**：新增 `lib/auth/passwordPolicy.ts` 的 `validatePasswordStrength()`（單一事實來源，目前規則為最小長度 8 碼——這系統的自助登入本來就是「學員 ID + 手機末四碼」這種低熵密碼，要求強密碼複雜度對這個情境效益有限，規則刻意保持寬鬆）。三處統一套用：
- `app/api/account/password/route.ts`（使用者自行改密碼，原本就有長度檢查，改呼叫共用函式）
- `app/api/users/route.ts` POST（管理者建帳號，原本完全沒檢查，已補上）
- `app/api/users/[id]/route.ts` PATCH（管理者重設密碼，原本完全沒檢查，已補上）

`npx tsc --noEmit` 通過。

### 25. ✅ 錯誤訊息直接回傳 Supabase 底層錯誤內容給前端
**位置**：多處，模式為 `{ error: error.message }`
**修法**：對外一律回傳通用錯誤訊息，詳細內容只寫 server log。
**修復紀錄**：新增 `lib/utils/apiError.ts` 的 `serverErrorResponse(context, error)`——完整錯誤內容寫進 server log（帶 `context` 標籤方便排查是哪個 route），對外一律回傳通用訊息「伺服器發生錯誤，請稍後再試」+ 500。

用腳本批次替換 14 個檔案、共 20 處 `if (error) return NextResponse.json({ error: error.message }, { status: 500 })`（及 `findErr` 變體）為 `serverErrorResponse(...)`：`org`、`edit-logs`、`login-logs`、`admin-audit`、`users`（2 處）、`users/[id]`、`history`、`history/[id]`、`counselor-groups`（2 處）、`counselor-groups/[id]`（4 處）、`parent-aliases`（2 處）、`parent-aliases/[id]`、`student-overrides`（2 處）、`student-overrides/[id]`（3 處）。刻意只替換這個統一模式，不動其他語意不同的錯誤回應（例如 400/404/403 這類要讓使用者看得懂的合理錯誤訊息予以保留，未被誤改）。

替換後用 `grep` 全域確認無殘留 `error.message`/`findErr.message` 洩漏給前端的地方（唯一剩下的一處是 `import/apply/route.ts` 的 `console.error(...)`，本來就只寫 log 不回傳，不需要改）。`npx tsc --noEmit` 通過，`npm run check:system-filter` 仍通過（確認替換過程未破壞 #23 的白名單匹配）。

### 26. ✅ `account/password` 修改密碼不會使其他既有 session 失效
**位置**：`app/api/account/password/route.ts:42-50`
**修法**：引入每帳號 session version/nonce。
**修復紀錄**：與使用者確認後實作。原本 session token 是全域固定的 `AUTH_SECRET`（所有帳號的 cookie 值都一樣，身分靠另一個 `sl_session_uid` cookie 區分），無法單獨讓「某個帳號」的 session 失效。

- 新增 `supabase/migrations/016_session_version.sql`：`users` 表新增 `session_version INTEGER NOT NULL DEFAULT 1`。
- `lib/auth.ts`：新增 `SESSION_VERSION_COOKIE` 常數；`checkAuth()` 查完 `users` 表後，比對 cookie 裡的版本號與 DB 的 `session_version` 是否一致，不一致視為 session 失效。
- `lib/supabase/types.ts`：`AppUser` 型別加上 `session_version` 欄位。
- `app/api/login/route.ts`：`buildSession()` 新增 `sessionVersion` 參數，寫入 `SESSION_VERSION_COOKIE`；既有帳號登入時查出當前版本號寫入 cookie，自助登入首次建帳號時用 DB default（1）。
- `app/api/account/password/route.ts`（使用者自行改密碼）：更新密碼時把 `session_version` +1，讓其他裝置的既有 session 失效；同時把呼叫者自己這次請求的 cookie 版本號同步更新（否則自己下一個請求也會被判失效，等於改完密碼自己也被登出）。
- `app/api/users/[id]/route.ts`（管理者重設密碼）：`newPassword` 分支同樣把目標帳號的 `session_version` +1，讓被重設密碼的帳號既有 session 失效；因為是重設「別人」的密碼，不需要處理呼叫者自己的 cookie。
- `getAuthUser`/`requireManager`/`requireSuperadmin`（`lib/auth/middleware.ts`）都是包裝 `checkAuth()`，`session_version` 驗證邏輯自動套用到所有使用這些函式的地方，不需個別修改。

**⚠️ 需要注意的部署影響**：這個改動一旦連同 migration 部署上線，**所有現有已登入的使用者會被強制登出一次**（因為他們現有的 session cookie 裡沒有 `SESSION_VERSION_COOKIE`，比對會失敗），需要重新登入。這是一次性、預期內的代價，換取往後真正的 session 版本控制能力，但建議挑低峰時段部署並提前告知使用者。

**⚠️ 已知限制**：`account/password` 與 `users/[id]` 的 `session_version` 更新都是「先查舊值、+1、寫回」（read-modify-write），不是 SQL 層的原子 increment（Supabase JS client 沒有原生語法，需要 RPC 才能做到）。同一帳號在極短時間內被多個請求同時改密碼時理論上有競態視窗，但這是單一使用者改自己密碼、或管理者手動重設密碼的操作，實務上發生同時寫入的機率極低，未進一步處理。

用腳本模擬驗證比對邏輯（cookie 版本與 DB 版本一致/不一致/缺少 cookie 三種情境），行為符合預期。`npx tsc --noEmit` 通過。

✅ **使用者已於 Supabase SQL Editor 執行 `016_session_version.sql`，並實際連線資料庫驗證**：`users.session_version` 欄位查詢正常，抽樣帳號皆為預設值 `1`（符合預期——尚未有人在此變更上線後改過密碼）。

### 27. ✅ `getDistinctValues()` 的「排除自身欄位」邏輯在兩個 repository 重複
**位置**：`lib/db/supabaseRepository.ts:213-265`、`lib/db/mockRepository.ts:124-145`
**修復紀錄**：抽出 `lib/utils/columnFilter.ts` 的 `scopeFiltersForDistinctValues(field, filters)`——欄位不在白名單回傳 `null`（呼叫端回傳空陣列），否則回傳排除 `field` 自身篩選條件後的 `scopedFilters`。兩個 repository 的 `getDistinctValues()` 都改呼叫這個共用函式，移除各自逐字重複的三行邏輯；連帶移除兩邊都不再需要的 `COLUMN_FILTER_FIELDS` import。`npx tsc --noEmit` 通過。

### 28. ✅ API route 錯誤處理風格不一致，部分 Supabase 呼叫完全未檢查 error
**位置**：`app/api/counselor-groups/backfill/route.ts:69`
**修復紀錄**：跟 #4 一起修的，該行的 `.update()` 現在會檢查 `error` 並回 500。其餘檔案風格不一致的一般性問題（沒有統一的 error wrapper）未處理，非本次範圍。

### 29. ✅ `primaryFilterType()` 為未使用的死碼 export
**位置**：`lib/utils/columnFilter.ts:57-60`
**修復紀錄**：全域搜尋確認無任何呼叫點，直接刪除。`npx tsc --noEmit` 通過。

### 30. ✅ `ColumnHeaderFilter` 單一函式承擔三種篩選型態的分派邏輯
**位置**：`components/StudentGrid/ColumnHeaderControls.tsx:20-102`
**修復紀錄**：拆成三個獨立子元件——`TextColumnFilter`、`EnumColumnFilter`、`RangeColumnFilter`，各自承擔原本對應 `if (meta.filterable === ...)` 分支的邏輯（不改變行為，純粹搬移＋改用 `switch` 分派）。`ColumnHeaderFilter` 現在只負責依 `meta.filterable` 選擇要渲染哪個子元件，不再是單一函式囊括三種型態的所有分支邏輯。`npx tsc --noEmit` 通過。

---

## P3 - Low

### 31. ✅ `last-updated` API 洩漏跨體系的最新更新時間戳
**位置**：`app/api/last-updated/route.ts:8-13`
**修復紀錄**：跟 #1 一起順手修的。改用 `checkAuth(request)` 取得 `user`，套用 `applySystemFilter(query, getEffectiveSystem(user))`，只回傳呼叫者有效體系內的最新更新時間。`tsc --noEmit` 通過。

### 32. ✅ `bcryptjs` cost factor 固定為 10
可視效能預算評估提升至 12。
**修復紀錄**：實測 cost=10 單次 hash/compare 約 50ms、cost=12 約 200ms（4 倍）。經與使用者確認，目前使用者人數少、非高流量系統，維持 10（bcrypt 慣例預設值）不提升，但抽成 `lib/auth/passwordPolicy.ts` 的 `PASSWORD_HASH_COST` 共用常數，取代原本四個 route（`login`、`account/password`、`users`、`users/[id]`）與 `supabase/seed/seedSuperadmin.ts` 各自寫死的 `10`，之後要調整只需改一處。`npx tsc --noEmit` 通過，並確認 `seedSuperadmin.ts`（獨立用 `npx tsx` 執行，非走 Next.js build）能正確解析 `@/` 路徑別名 import。

### 33. ⏸️ `ColumnFilterValue` 三型態對「為空」概念表達方式不完全對稱
不建議現在改動，性價比低。

### 34. ⏸️ `normalizeColumnFilterValue()` 向下相容轉換函式沒有明確清除時機
屬合理的防禦性寫法，非負面技術債。

### 35. ✅ `.env.local.example` 疑似含真實外觀的 Supabase JWT
未受 git 版控，非本次審查範圍，但建議確認是否為真實金鑰、是否曾被提交、必要時輪替 service role key。
**修復紀錄**：decode 檔案中的 JWT 確認為真實格式（`ref: hstzgngoeperivauvnfk`，含 `anon` 與 `service_role` 兩把 key）。雖然此檔案本身在 `.gitignore` 內、`git log --all` 查無任何提交紀錄（從未進版控），但明文寫在磁碟上本身就是風險。**這是安全事件，已即時提報使用者**，使用者確認會自行到 Supabase Dashboard 輪替 `service_role` key。

同時把 `.env.local.example` 內容改為純佔位符（`your-project-ref`／`your-anon-key`／`your-service-role-key`），並補上 `service_role` key 的風險註解，避免之後又不小心留下真實金鑰。順便補上文件中列為必要但範例檔案原本缺少的 `APP_PASSWORD`／`AUTH_SECRET` 兩個變數（CLAUDE.md 記載共需 5 個環境變數，原檔案只有 3 個）。

---

## 已確認安全/無問題的項目

**安全性**：
- `lib/utils/columnFilter.ts` 白名單機制正確防止欄位名稱注入
- `app/api/users/[id]/route.ts` PATCH 的體系範圍檢查是本次審查中做得最完整的範例
- `org`/`export` route 正確傳入 `request`（CSRF 生效）
- RLS 政策對 `anon` 角色只授予必要的 SELECT 權限
- `login` 的自助建帳號競態處理正確
- 密碼雜湊/CSRF token/session secret 未見被記錄或回傳給前端

**效能**：
- `lib/import/assignGroup.ts` 的上線鏈追溯有記憶化快取 + 深度上限，無 N+1
- `app/api/org/route.ts` 分頁抓取合理
- `@tanstack/react-virtual` 虛擬滾動使用得當
- `useOrgData.ts` 的並行請求 + dedupingInterval 是良好實踐

**技術債**：
- `matchesColumnFilters`/`matchesOne` 已收斂到單一來源
- `SORTABLE_FIELDS` 白名單已統一（但排序演算法本身仍重複，見 #6）
- `StudentView` 型別無殘留的已移除視圖引用
- Server Component 直接用 `createServiceClient()` 是既定架構，非 DIP 違反

**未覆蓋範圍**：未驗證資料庫遷移檔案的實際套用狀態、未做滲透測試、未檢視 Supabase Dashboard 的實際 RLS/索引現況（僅比對 migration 檔案）。
