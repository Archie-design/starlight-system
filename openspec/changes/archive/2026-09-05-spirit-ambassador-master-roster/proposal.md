## Why

心之使者專區（`/spirit`）目前只有彙總統計（KPI、長條圖、資料品質提醒），沒有「各組成員總表」這種一目了然的名冊視圖——關懷長平時用 Excel/Google 表單手動維護一份「27欄分組總表」（每欄=一組，組長在最上、組員垂直排列），這份手動表單完全獨立於系統之外，需要在系統裡也能看到同等視覺呈現的總表，減少切換工具的成本。

同時，這份手動表單用綠底標記「已報名分組、但尚未完成心之使者補課（因此還不是正式心之使者）」的成員——這是一個系統目前完全沒有欄位可以表達的中間狀態。目前系統對「是否為心之使者」只有二分判定（`spirit_ambassador_join_date` 有值 = 是），這些綠底成員因為還沒補課，`join_date` 理應維持空白（符合既有定義），但他們已經被分進組別、需要被追蹤「還差補課這一步」，系統需要新欄位承接這個狀態，否則這批人會在系統裡「查無此人」（不在任何統計裡），只存在於手動表單。

## What Changes

- 新增資料庫欄位 `spirit_ambassador_makeup_completed`（boolean，nullable，語意：`true`=已完成補課、`false`/`null`=已分組但尚未完成補課）。既有的 `spirit_ambassador_join_date`/`spirit_ambassador_group` 欄位語意不變——「是否為心之使者」仍然只看 `join_date`，新欄位不影響既有判定。
- 心之使者專區（`/spirit`）最上方新增「分組總表」區塊：以網格呈現目前有效體系內所有分組（組長置頂、組員垂直排列，比照使用者提供的截圖佈局），依組別動態產生（`星光N`/`太陽N` 依數字排序在前，非數字命名組別接在後面），不寫死固定欄數、以自動換行呈現（不需要橫向捲動）；`spirit_ambassador_makeup_completed !== true` 且已分組者的格子標示為淺綠底（對應截圖的「尚未完成補課」狀態）；完全未分組者不出現在總表中，也不另外呈現未分組名單（使用者實際看到畫面後回饋移除，見 design.md）。
- 一次性資料修復：依使用者提供的截圖，將截圖中綠底、目前資料庫查無分組資料的成員，手動比對姓名寫入 `spirit_ambassador_group`（不寫入 `spirit_ambassador_join_date`，也標記 `spirit_ambassador_makeup_completed = false`）。以一次性腳本執行，不改動既有 xlsx 匯入流程。
- 補課狀態編輯：分組總表的綠底格子新增可點擊的勾選按鈕，讓 `superadmin`/`system_admin` 可直接標記該學員「已完成補課」（`spirit_ambassador_makeup_completed = true`），無需再透過一次性腳本手動改資料庫——這是初版實作完成、使用者實際使用後發現的缺口（原設計只有唯讀顯示，沒有任何修改途徑）。新增專用 API 端點 `PATCH /api/students/[id]/spirit-makeup`，權限與越權防護比照既有的 `student-overrides`/`parent-aliases` 寫入端點。
- 順手修正 `spirit-ambassador-hub` 既有 spec 中「僅統計 `business_chain='太陽'`」等過時措辭（已於 `guidance-chain-system-basis` 變更中，透過 `applySystemFilter`／`system_computed` 底層改依 `guidance_chain` 判定生效，但當時未同步更新此 spec 文字）。
- 新增資料庫欄位 `spirit_ambassador_is_leader`（boolean，nullable，語意：`true`=該組小隊長，其餘=一般組員）。原本用「該組累積年資最長者」近似推斷小隊長身分並置頂顯示，但小隊長實際上是任命制、與年資無關（可能異動、可能新人被指派但年資不是最長），需要獨立欄位明確記錄。分組總表排序改為「小隊長優先置頂，其餘依年資高到低；若某組未標記小隊長則自動退回既有的年資排序」，並用紅底+粗體+★徽章視覺標示小隊長。
- 小隊長標記編輯：分組總表每位組員旁新增可點擊的 ★ 按鈕，讓 `superadmin`/`system_admin` 可雙向切換小隊長標記（吸取先前補課狀態「初版只做單向標記、後來才發現需要雙向切換」的教訓，這次一開始就做成雙向）。標記某人為小隊長時，若該組已有其他人被標記，系統自動將舊小隊長降級為一般組員，保證每組最多一位。新增專用 API 端點 `PATCH /api/students/[id]/spirit-leader`。
- 一次性資料寫入：依截圖逐一比對 27 位組長姓名後，20 位確認組別與姓名皆吻合，已寫入 `spirit_ambassador_is_leader = true`；其餘 7 位（第8、14、21組組長姓名查無此人；第22、23、26、27組組長姓名查得到但實際所屬組別編號與截圖不一致，顯示截圖組別編號可能已與系統現況脫節）暫不處理，留待與使用者確認後再補。

## Capabilities

### Modified Capabilities
- `spirit-ambassador-hub`：新增「分組總表」需求（含補課狀態與小隊長標記的視覺標示與編輯功能），既有 KPI/圖表/資料品質提醒需求不變；順手修正過時的體系判定措辭（`business_chain` → `guidance_chain`，不影響行為，僅文字校正）。

## Impact

- **資料庫**：新 migration 新增 `students.spirit_ambassador_makeup_completed`、`students.spirit_ambassador_is_leader` 兩個欄位（皆為 boolean，nullable，預設 null）。
- **型別**：`lib/supabase/types.ts` 的 `Student` 介面新增對應欄位。
- **頁面**：`app/spirit/page.tsx`（新增分組總表的資料查詢/組裝邏輯，含小隊長優先排序）、`app/spirit/SpiritClient.tsx`（新增總表 UI 區塊，插入於現有 KPI 摘要卡之前；新增補課狀態與小隊長標記的點擊編輯互動）。
- **新 API 端點**：`app/api/students/[id]/spirit-makeup/route.ts`（`PATCH`，更新單一學員的補課狀態）、`app/api/students/[id]/spirit-leader/route.ts`（`PATCH`，更新單一學員的小隊長標記，含同組互斥自動降級邏輯）——皆僅 `superadmin`/`system_admin` 可用，`system_admin` 限其有效體系內學員。
- **一次性資料修復/寫入腳本**：依截圖手動比對，寫入本次確認的綠底成員分組資料、20位確認無誤的小隊長標記（不透過既有匯入管線，範圍侷限於截圖中確認無誤的人員）。
- **匯入管線保留邏輯**：`app/api/import/apply/route.ts` 的 upsert batch 組裝，`spirit_ambassador_makeup_completed`、`spirit_ambassador_is_leader` 皆比照既有 `group_leader` 模式保留資料庫既有值，不被匯入覆蓋（見 design.md）。
- **不影響**：既有的 KPI 統計、長條圖、資料品質提醒、匯入流程（`lib/import/transform.ts` 等）本次不新增這兩個欄位到匯入映射——這是刻意的範圍界定，見 design.md。
- **spec 文字校正**：`openspec/specs/spirit-ambassador-hub/spec.md` 的體系隔離 scenario 文字更新為 `guidance_chain`，不涉及行為變更。
