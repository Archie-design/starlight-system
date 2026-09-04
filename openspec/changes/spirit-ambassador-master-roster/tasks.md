## 1. 資料庫

- [x] 1.1 建立新 migration `supabase/migrations/020_spirit_ambassador_makeup_status.sql`：`ALTER TABLE students ADD COLUMN IF NOT EXISTS spirit_ambassador_makeup_completed BOOLEAN`（nullable，無 default）；於 Supabase SQL Editor 執行後，用 `SELECT column_name FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'spirit_ambassador_makeup_completed'` 確認欄位存在——**已執行，查詢確認欄位存在且可正常讀寫**
- [x] 1.2 一次性資料修復腳本：依 design.md Decision 4 的11人清單（鄭林31067、羅唯懿21176、劉芳澤12531、蔡庭妍30536、王婉如20992、梁歆甯14311、林婉瑜25402、周宗霖13840、黃韻苹14731、蔡佳婷27998、黃琳貽12565），以明確 id 為依據（非姓名字串比對）寫入 `spirit_ambassador_group`（依表格對應的組別）與 `spirit_ambassador_makeup_completed = false`，執行前後皆用 `SELECT id, name, spirit_ambassador_group, spirit_ambassador_makeup_completed, spirit_ambassador_join_date FROM students WHERE id IN (...)` 確認：執行前全部 `group`/`join_date`/`makeup_completed` 皆為 null，執行後僅 `group`/`makeup_completed` 被寫入、`join_date` 仍維持 null——**執行前逐筆確認姓名與資料皆乾淨（11/11符合），寫入後逐筆確認全部正確落地，`join_date` 全程維持 null**
- [x] 1.3（規劃階段遺漏，實作時發現後補上）修正 `app/api/import/apply/route.ts` 的 upsert 批次組裝邏輯：`spirit_ambassador_makeup_completed` 比照既有 `group_leader` 的保留模式，改用 `dbMap.get(row.id)?.spirit_ambassador_makeup_completed ?? null` 保留資料庫既有值，不被匯入覆蓋——**發現原因**：`transformSourceRow()` 因來源 xlsx 無此欄位而固定填 `null`，但 `upsert` 是整列覆蓋語意，若不在 apply 階段保留既有值，未來任何一次真正的 xlsx 匯入都會把這批人（以及未來手動標記完課的人）的補課狀態洗回 `null`，抹除關懷長的維護紀錄；同步在 `lib/import/transform.ts`、`supabase/seed/migrate.ts` 補上這個欄位（皆填 `null`，滿足 `StudentInsert` 型別要求，不影響上述保留邏輯）；確認 `lib/import/diff.ts` 的 `COMPARABLE_FIELDS` 未包含此欄位（不會產生假 diff），無需修改

## 2. 型別與查詢邏輯

- [x] 2.1 `lib/supabase/types.ts` 的 `Student` 介面新增 `spirit_ambassador_makeup_completed: boolean | null`
- [x] 2.2 `app/spirit/page.tsx`：`Row` 型別新增 `spirit_ambassador_makeup_completed`，`.select()` 查詢欄位同步新增；實作 `sortGroups()` 依 design.md Decision 2 的演算法（`^(?:星光|太陽)\d+$` 格式依數字排序在前，其餘依字串排序接續在後）
- [x] 2.3 `app/spirit/page.tsx`：組裝分組總表資料結構——依組別分桶（`spirit_ambassador_group` 非空者，母體為 `all` 全體學員而非既有 `spirits`，與既有 KPI/圖表用的 `groupMap` 分開，互不影響），每組依累積年資高到低排序（複用既有排序邏輯），每位成員標示是否為「已分組未完課」（`spirit_ambassador_group` 非空 且 `spirit_ambassador_makeup_completed !== true` 且尚未是正式心之使者）；未分組者（`spirit_ambassador_group` 為空）另外收集成一份清單（含 `isSpirit` 標記），不進入分組網格資料結構
- [x] 2.4 將分組總表資料結構（`rosterGroups`）與未分組名單（`unassigned`）一併傳給 `SpiritClient`

## 3. UI：分組總表

- [x] 3.1 `app/spirit/SpiritClient.tsx`：新增分組總表區塊，插入於現有 KPI 摘要卡（`grid grid-cols-2 lg:grid-cols-4`）之前；比照使用者截圖佈局——橫向多欄網格，每欄一組，組長（年資最長者）視覺置頂、其餘組員垂直排列於其下
- [x] 3.2 已分組未完課者（`pendingMakeup`）的格子套用淺綠底樣式（`bg-green-100`），與現有頁面的琥珀色警示色（`amber-*`）視覺區分——未分組名單中「已是心之使者但缺組別」用既有 amber 色系呈現，維持一致性
- [x] 3.3 未分組名單於總表下方獨立呈現，可點姓名連結至 `/students?search=...`（沿用既有連結模式）
- [x] 3.4 組數多時（星光體系實測29+1組）用 `overflow-x-auto` + `min-width: max-content` + 每欄 `shrink-0` 固定寬度處理橫向捲動，不破版
- [x] 3.5 執行 `npx tsc --noEmit`，確認零錯誤

## 4. 驗證

- [x] 4.1 執行 `npx tsc --noEmit` 與 `npm run build`，確認零錯誤
- [x] 4.2 對照真實資料庫驗證：星光體系分組總表應顯示星光1~29（依序）+ 小兔組，共30欄；未分組名單應含14人（不含本次補資料的11人，因為他們執行1.2後已有 `group`）——**實測30組、順序正確（星光1~29+小兔組）；未分組人數為818（母體是全體星光學員，非限定心之使者範圍，與既有「有加入日但無組別」14人 alert 是不同統計口徑，符合 design.md 設計）**
- [x] 4.3 驗證綠底標示：分組總表中，鄭林（星光10）、羅唯懿（星光10）、劉芳澤（星光10）等本次補資料的11人格子應顯示淺綠底；黃詩庭、林君豪（星光21，已完課轉正）不應顯示綠底——**實測鄭林/羅唯懿/劉芳澤 pendingMakeup=true（綠底）；黃詩庭/林君豪 pendingMakeup=false（不顯示綠底），符合預期**
- [x] 4.4 驗證既有 KPI「心之使者總數」不因本次11人補資料而變動（因為他們 `join_date` 仍為 null，不計入既有心之使者判定）——執行 1.2 前後分別記錄「心之使者總數」數字，確認一致——**執行後實測心之使者總數=202，與規劃盤點階段查到的數字一致，確認無變動**
- [x] 4.5 驗證體系隔離：太陽 admin（或模擬對應查詢）開啟心之使者專區，分組總表僅顯示 `guidance_chain='太陽'` 的分組與成員，不含星光資料——**實測星光199人/30組、太陽77人/11組，「星光N」分組中混入非星光關懷脈人數=0，零跨體系洩漏**
- [x] 4.6 更新 `openspec/specs/spirit-ambassador-hub/spec.md`（於封存時自動套用 delta，此處僅確認 delta 內容與最終實作一致）——**逐條核對 delta spec 三個 Requirement 與最終實作/驗證結果完全一致，無需修改**

## 5.（部署後使用者實際看到畫面的回饋調整，任務組4完成後追加）

- [x] 5.1 `app/spirit/SpiritClient.tsx`：移除未分組名單 UI 區塊（含 `unassigned` prop 與型別定義）；`app/spirit/page.tsx` 同步移除收集 `unassigned` 的迴圈邏輯與 `return` 中的 `unassigned={unassigned}` 傳遞，避免無謂的資料傳輸——執行 `npx tsc --noEmit` 確認零錯誤
- [x] 5.2 `app/spirit/SpiritClient.tsx`：分組總表版面從「`overflow-x-auto` 橫向捲動固定寬欄（`w-28`）」改為「`flex flex-wrap` 自動換行窄欄（`w-20`，文字縮至 `text-[11px]`）」，不再需要橫向捲動即可看到全部分組——執行 `npx tsc --noEmit` 與 `npm run build` 確認零錯誤
- [x] 5.3 更新 `design.md`（新增 Decision 6 記錄回饋與調整內容）與 `specs/spirit-ambassador-hub/spec.md`（「分組總表」Requirement 措辭與 scenario 同步反映：新增「不得橫向捲動」「不呈現未分組名單」，移除舊有「未分組者另列名單」scenario）

## 6. 補課狀態編輯（部署後使用者提出新需求：目前完全沒有修改補課狀態的介面）

- [x] 6.1 新建 `app/api/students/[id]/spirit-makeup/route.ts`：`PATCH` 端點更新單一學員的 `spirit_ambassador_makeup_completed`，僅 `superadmin`/`system_admin`（`requireManager`）可用，`system_admin` 用 `studentIdsAllInSystem()` 驗證目標學員屬於其有效體系（比照 `student-overrides/[id]` 既有模式）——執行 `npx tsc --noEmit` 確認零錯誤
- [x] 6.2 `app/spirit/SpiritClient.tsx`：分組總表綠底格子新增獨立的勾選（✓）按鈕，與姓名連結分開各自的點擊熱區；點擊後 `confirm()` 二次確認、呼叫 `csrfFetch` PATCH 該端點、成功後用既有的 `toast.success`/`toast.error` 回饋並 `router.refresh()` 重新整理（沿用頁面既有的 `switchSystem()` 更新策略，不做本地樂觀更新）；僅 `role === 'superadmin' || role === 'system_admin'` 時顯示按鈕
- [x] 6.3 驗證：對真實資料庫模擬 `studentIdsAllInSystem` 權限判斷（太陽 system_admin 嘗試修改星光學員應拒絕、星光 system_admin 修改星光學員應允許），並實際執行一次真實寫入（鄭林 id=31067，`makeup_completed: false→true`）確認寫入路徑正確，驗證後還原回原始測試狀態（`false`），不污染既有測試資料
- [x] 6.4 執行 `npx tsc --noEmit` 與 `npm run build`，確認零錯誤
- [x] 6.5 更新 `proposal.md`（What Changes/Impact 新增此功能）、`design.md`（新增 Decision 7）、`specs/spirit-ambassador-hub/spec.md`（新增「補課狀態編輯」Requirement，含管理層級操作、一般 admin 拒絕、跨體系拒絕三個 scenario）

## 7. 修正補課狀態編輯無法復原的 bug（使用者回報「點錯了無法恢復成未補課狀態」）

- [x] 7.1 排查現況：對真實資料庫查詢原本11人清單的目前狀態，確認蔡庭妍（id=30536）被誤觸卡在 `spirit_ambassador_makeup_completed=true`，其餘10人維持原本一次性腳本寫入的 `false`
- [x] 7.2 `app/spirit/page.tsx`：組員資料新增獨立的 `canToggleMakeup` 欄位（`= !spirit_ambassador_join_date`），與 `pendingMakeup`（是否顯示綠底）分開判斷，避免「操作入口」與「視覺狀態」綁在同一個布林值上
- [x] 7.3 `app/spirit/SpiritClient.tsx`：`markMakeupCompleted` 改為雙向的 `toggleMakeupCompleted(id, name, nextCompleted)`；編輯入口改用 `canToggleMakeup` 決定是否顯示（不再受 `pendingMakeup` 限制只在綠底時出現），按鈕圖示依 `pendingMakeup` 顯示「✓ 標記完成」或「↺ 改回未完成」，confirm 訊息依方向調整用詞
- [x] 7.4 執行 `npx tsc --noEmit` 與 `npm run build`，確認零錯誤
- [x] 7.5 手動將蔡庭妍（id=30536）的 `spirit_ambassador_makeup_completed` 復原為 `false`，執行前後皆查詢確認，其餘10人資料未受影響
- [x] 7.6 更新 `design.md`（新增 Decision 8 記錄根因與修法）、`specs/spirit-ambassador-hub/spec.md`（「補課狀態編輯」Requirement 措辭改為「雙向切換」，新增「已轉正者不提供編輯入口」規則與對應 scenario）

## 8. 小隊長標記（使用者提出新需求：截圖第一列粉紅底為小隊長，需要獨立欄位取代年資近似推斷）

- [x] 8.1 資料比對：逐一比對截圖27位小隊長姓名與資料庫的分組歸屬，確認20位姓名與組別皆吻合；發現7位有問題（第8/14/21組姓名查無此人；第22/23/26/27組姓名查得到但實際所屬組別編號與截圖不同），與使用者確認先只處理20位，其餘留待後續確認
- [x] 8.2 建立新 migration `supabase/migrations/021_spirit_ambassador_leader.sql`：`ALTER TABLE students ADD COLUMN IF NOT EXISTS spirit_ambassador_is_leader BOOLEAN`——待使用者於 Supabase SQL Editor 執行
- [x] 8.3 `lib/supabase/types.ts` 的 `Student` 介面新增 `spirit_ambassador_is_leader: boolean | null`
- [x] 8.4 修正因新必填欄位產生的 tsc 錯誤：`lib/import/transform.ts`、`supabase/seed/migrate.ts` 皆填 `null`（滿足 `StudentInsert` 型別，實際值由 apply route 保留）；`app/api/import/apply/route.ts` 的 upsert batch 組裝比照 `makeup_completed` 的既有保留模式，新增 `spirit_ambassador_is_leader: dbMap.get(row.id)?.spirit_ambassador_is_leader ?? null`，避免未來匯入覆蓋既有標記
- [x] 8.5 `app/spirit/page.tsx`：`Row` 型別與查詢欄位新增 `spirit_ambassador_is_leader`；分組總表排序邏輯改為「`isLeader` 不同則小隊長優先，相同則落入既有年資比較」（`isLeader` 全為 `false` 時天然 fallback 回年資排序，不需要額外分支）
- [x] 8.6 新建 `app/api/students/[id]/spirit-leader/route.ts`：`PATCH` 端點更新 `spirit_ambassador_is_leader`，權限比照既有寫入端點（`requireManager` + `studentIdsAllInSystem`）；標記為 `true` 時，先查詢目標學員所屬 `spirit_ambassador_group`，將該組其餘 `is_leader=true` 者一併改為 `false`，再把目標學員設為 `true`，保證每組最多一位小隊長；取消標記（`false`）不影響同組其他人
- [x] 8.7 `app/spirit/SpiritClient.tsx`：`RosterMember` 型別新增 `isLeader`；新增 `toggleLeader()` 雙向切換函式（一開始就做成雙向，吸取任務組7的教訓）；格子新增可點擊的 ★ 按鈕（灰色=可標記、紅色=已是小隊長可取消），小隊長格子套用紅底+粗體樣式，優先於補課狀態的綠底顯示；`CardHeader` 的 subtitle 補上「★＝小隊長」圖例
- [x] 8.8 執行 `npx tsc --noEmit` 與 `npm run build`，確認零錯誤
- [x] 8.9 一次性資料寫入：對20位確認無誤的組長，以明確 id 為依據（非姓名字串比對）寫入 `spirit_ambassador_is_leader = true`，執行前逐筆確認姓名與組別皆與截圖吻合，執行後逐筆確認正確落地
- [x] 8.10 驗證：對真實資料庫模擬排序邏輯（有標記的組小隊長正確置頂、無標記的組正確 fallback 回年資排序）；模擬同組互斥邏輯（標記新小隊長時舊小隊長自動降級），執行一次真實寫入測試後還原；模擬權限判斷（太陽 system_admin 修改星光學員應拒絕、星光 system_admin 修改星光學員應允許）；最終確認全體恰好20位小隊長、每組最多一位、無重複
- [x] 8.11 更新 `proposal.md`（What Changes/Impact 新增小隊長功能）、`design.md`（新增 Decision 9，並在 Decision 3 附註「已被取代」、Risks 段落更新驗證結果與新風險、Migration Plan 補上步驟5）、`specs/spirit-ambassador-hub/spec.md`（「分組總表」Requirement 排序措辭改為依小隊長優先＋年資fallback、新增排序相關2個scenario；新增「小隊長標示」「小隊長標記編輯」兩個 Requirement，各含2-4個scenario）
