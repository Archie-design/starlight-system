## Context

分組總表（`app/spirit/page.tsx` 的 `rosterGroups` 組裝、`app/spirit/SpiritClient.tsx` 的渲染）目前完全由 `students.spirit_ambassador_group` 反推：查詢全體學員、依這個自由文字欄位分桶、用 `sortGroups()` 排序欄位。沒有獨立的「分組」資料表，組別的存在與否是「是否有至少一位學員持有這個組名」的隱含推論。

本次新增拖曳搬移、新增/刪除組別、匯出，三者都要求「組別」本身成為一個可獨立存在、可持久化的實體（尤其新增的空組別，重新整理後不能消失），因此需要引入一張新的分組資料表，改變總表的資料來源方式。

拖曳、新增/刪除、匯出三個子功能都遵循已在 `spirit-makeup`/`spirit-leader` 端點確立的模式：`requireManager` 權限、`studentIdsAllInSystem` 越權防護、前端 `confirm()` 二次確認、`csrfFetch`、`toast` 回饋、`router.refresh()`。本設計不偏離這個既有模式，只在此基礎上擴充。

## Goals / Non-Goals

**Goals:**
- 分組總表的組別本身可獨立於學員而持久存在（支援空組別）。
- 拖曳搬移組員後立即寫入資料庫（不做前端暫存草稿），與既有補課/小隊長編輯的「即時生效」心智模型一致。
- 新增/刪除組別、匯出總表，皆比照既有端點的權限與確認模式。

**Non-Goals:**
- 不做「前端暫存編輯、定版後才寫入」的草稿機制（使用者已確認拖曳即時寫入資料庫）。
- 不支援組別自由命名（僅自動編號），因此不處理命名衝突/校驗 UI。
- 不處理「原官網資料庫」的自動同步——匯出後的手動比對更新流程在系統之外，本次僅產出匯出檔案。
- 不遷移既有的非數字命名組別（例如歷史資料中可能存在的「小兔組」）到新表以外的其他結構調整；新表只需能容納任意字串組名。

## Decisions

### Decision 1：新增獨立的 `spirit_ambassador_groups` 資料表

**決定**：新 migration 建立 `spirit_ambassador_groups` 表：`id`（PK）、`name`（text, unique）、`guidance_chain`（text，決定體系歸屬，值為 `'星光'` 或 `'太陽'`）、`created_at`。這張表記錄「目前存在的組別」，不論是否有成員。

**理由**：
- 拖曳搬移只是改變某學員的 `spirit_ambassador_group` 值，不需要這張表也能運作（沿用既有的隱含推論即可涵蓋「非空組別」）。但「新增空組別」若不持久化，重新整理後就會消失——因為沒有任何學員的欄位值等於這個組名。
- 用「虛擬占位學員」保留空組別（proposal 中列為備選方案）會污染 `students` 表語意，且需要在總表查詢、匯入管線、其他既有統計（KPI、圖表）到處新增排除邏輯，風險擴散到整個 `/spirit` 頁面以外的既有功能；獨立小表則是新增查詢邏輯，不影響任何既有查詢路徑。
- `guidance_chain` 欄位（而非 `system_computed`）：比照 `students` 表本身「以 `guidance_chain` 為單一事實來源、其餘計算得出」的既有慣例（見 `lib/utils/system.ts`），組別新增時直接依當前操作者的有效體系寫入對應中文字串。

**替代方案考慮**：
- 虛擬占位學員——如上，污染既有表語意，pass。
- 把組別清單放進某個設定檔/JSON 欄位（例如塞進 `counselor_groups` 表旁的一個 KV）——沒有既有先例，且未來若要擴充組別屬性（例如組別備註、建立者）會比關聯表更難擴充，pass。

**總表查詢改法**：`app/spirit/page.tsx` 改為先查 `spirit_ambassador_groups`（依 `guidance_chain = system` 過濾）取得完整組名清單，再用既有的學員查詢結果 LEFT JOIN 填入組員——`sortGroups()` 排序邏輯不變，只是排序的輸入來源從「反推出的組名」改為「資料表查到的組名」。**既有組別的回填**：這張表是全新的，既有資料庫裡已經存在的組別（例如「星光1」~「星光29」）目前不會出現在這張表裡；需要一次性 migration 腳本，依目前 `students.spirit_ambassador_group` 的既有 distinct 值回填進 `spirit_ambassador_groups`，確保上線當下既有組別不會從總表消失。

### Decision 2：拖曳落點的寫入方式——複用/新增一個學員層級的 PATCH 端點

**決定**：新增 `PATCH /api/students/[id]/spirit-group`，body 為 `{ group: string }`，直接 `update({ spirit_ambassador_group: body.group })`。拖放結束（`onDragEnd`）時，前端讀出目標組別的 `name`，呼叫此端點。

**理由**：與 `spirit-makeup`/`spirit-leader` 是同一種「更新單一學員單一欄位」形狀，沿用相同端點粒度而非做一個「批次搬移」端點——拖曳操作本來就是一次一人，不需要批次語意徒增複雜度。

**權限與越權**：`requireManager` + `studentIdsAllInSystem`（比照既有兩端點）；此外目標組別必須存在於 `spirit_ambassador_groups` 且屬於操作者的有效體系（system_admin 不能把學員拖進另一個體系的組別，即使 UI 上不會顯示——伺服器端仍需校驗，防止繞過前端直接打 API）。

### Decision 3：拖放函式庫——`@dnd-kit/core`

**決定**：新增依賴 `@dnd-kit/core`（`DndContext` 包住整個總表、每位組員是 `useDraggable`、每個分組容器是 `useDroppable`）。

**理由**：本專案目前無任何拖放先例；`@dnd-kit` 是目前 React 生態最活躍維護、對觸控裝置與鍵盤可及性支援較完整的選項，`react-beautiful-dnd` 已停止維護。使用者已確認採用此方案。

**範圍控制**：只在分組總表這個區塊引入 `DndContext`，不影響頁面其他區塊（KPI 卡、圖表、資料品質提醒維持原生 DOM）。

### Decision 4：新增組別——自動編號 + 新端點

**決定**：新增 `POST /api/spirit-groups`，body 不需帶組名，伺服器依操作者的有效體系（`星光`/`太陽`）與該體系既有的 `spirit_ambassador_groups.name`，用與 `sortGroups()` 相同的 `^(?:星光|太陽)(\d+)$` 正則解析出目前最大編號，取 `+1` 作為新組名（例如目前最大是「星光30」，新增後為「星光31」），寫入新表後回傳新組名。

**理由**：使用者已確認不開放自由命名。編號計算放在伺服器端（而非前端算好組名再傳）以避免併發下兩個管理者同時新增組別導致編號衝突——資料表對 `name` 有 unique 約束，衝突時伺服器可重試一次（取新的 max+1）或回傳明確錯誤讓前端提示重新操作。

### Decision 5：刪除組別——僅限空組別

**決定**：新增 `DELETE /api/spirit-groups/[name]`，伺服器先查詢是否有任何學員的 `spirit_ambassador_group` 等於該組名，若有則拒絕（400），否則從 `spirit_ambassador_groups` 刪除該筆記錄。前端在該組還有成員時，直接停用刪除按鈕（而非讓使用者點了才被伺服器拒絕），但伺服器端校驗仍是最終防線（防止併發：刪除當下另一位管理者剛好拖了人進來）。

**理由**：使用者已確認採此方案，避免誤刪導致組員資料流失疑慮。

### Decision 6：匯出改為「本次工作階段異動對照表」，前端以 Map 追蹤原始分組

**背景（取代原設計）**：原設計匯出「目前完整分組總表現況」，但這與使用情境不符——管理者拿到匯出檔案後，要做的事是回到另一個無法批次匯入、只能逐筆手動編輯的「原官網系統」去更新分組。完整現況表要求管理者自己比對「這次跟上次有什麼不一樣」，這正是最容易漏改、看錯的環節。改為只匯出「這次工作階段中實際變更過的人」，把比對工作從人腦移到程式邏輯裡（見 openspec-propose 附帶的 UI/UX 評估）。

**決定**：`SpiritClient.tsx` 新增一個 `useRef<Map<number, { name: string; originalGroup: string }>>`（每位學員只記錄「進入本次工作階段時的原始分組」，不隨後續多次拖曳更新這個值）與一個 `useState<Map<number, string>>`（記錄每位曾被拖曳學員的「目前最新分組」，用於觸發重渲染與判斷是否已拖回原點）：

- `handleDragEnd` 成功呼叫 PATCH 後：若該學員 id 尚未出現在 `originalGroupRef` 中，記錄其 `currentGroup`（拖曳前的分組）為原始分組；接著更新 `latestGroup` state 為目標分組。
- 若某學員的 `latestGroup` 與其 `originalGroup` 相同（拖回原點），該學員從 `latestGroup` state 中移除——不在異動清單中出現。
- 匯出時比對雅兩個 Map：僅列出 `latestGroup` 中仍存在的學員，欄位為姓名、`originalGroup`、`latestGroup`。
- `useRef` 存「原始分組」是因為這個值語意上不該隨渲染改變、也不需要觸發重渲染；`useState` 存「目前最新分組」是因為它需要驅動「匯出按鈕是否停用」「按鈕上是否顯示異動筆數」等 UI 呈現。

**頁面重新整理後歸零**：`router.refresh()` 只重新查詢 Server Component 的資料並重渲染，不會重新掛載 `SpiritClient` 這個 Client Component 本身，因此 `useRef`/`useState` 不會自動清空。但使用者若手動重新整理瀏覽器分頁（F5／重新導覽），整個 React tree 重新掛載，天然歸零——這才是 spec scenario 說的「重新整理後歸零」的實際觸發時機（並非每次 `router.refresh()` 都清空；若在同一次 `router.refresh()` 之間累積多筆拖曳，異動清單應該持續累加，這正是這個功能存在的意義：讓管理者一次處理完一整輪調整後，才產出一次完整的對照表）。

**欄位**：姓名、原分組、目前分組（三欄，不含小隊長/補課狀態——那些標示對「去外部系統改分組」這件事沒有幫助，維持欄位精簡）。

**匯出入口的停用狀態**：`latestGroup` Map 為空時，匯出按鈕 `disabled`，避免匯出一份空白或無意義的檔案；按鈕文案可顯示目前累積的異動筆數（例如「匯出異動對照表（3）」），讓管理者在按下前就能大致確認範圍。

**替代方案考慮**：
- 保留完整現況匯出、額外新增異動對照表作為第二個匯出選項——使用者已確認不需要，直接汰換即可，避免介面上有兩顆容易混淆的匯出按鈕。
- 用伺服器端記錄每次 PATCH 的異動 log（例如寫進一張新表）再查詢匯出——比純前端 state 更「正確」（能跨裝置、跨分頁彙總），但這次的使用情境是單一管理者在一次操作階段內完成調整後就匯出，不需要跨裝置持久化這種複雜度，pass；若未來需求變成「多人協作、隔天才彙總」，才需要升級為伺服器端記錄（見 Open Questions 或後續 change）。

## Risks / Trade-offs

- **[風險] 新表與既有反推邏輯並存期間可能不一致**——上線時既有組別若忘記回填進 `spirit_ambassador_groups`，會導致這些組別從總表消失（即使底下仍有學員）。
  → 緩解：一次性 migration 腳本在同一個 migration 檔案內，用 `INSERT ... SELECT DISTINCT spirit_ambassador_group FROM students WHERE spirit_ambassador_group IS NOT NULL AND spirit_ambassador_group != ''`（依 `guidance_chain` 對應寫入 `星光`/`太陽`）完成回填，作為 migration 的一部分而非額外手動腳本，確保回填與建表同一次執行、不會遺漏。
- **[風險] 拖曳把人拖進另一體系的組別**——理論上 UI 只會顯示同體系組別，但需要伺服器端仍然校驗，防止繞過前端直接呼叫 API。
  → 緩解：Decision 2 已納入伺服器端校驗目標組別所屬體系。
- **[風險] `@dnd-kit` 是全新依賴，觸控裝置（平板）上的手感需要實測**——關懷長可能在平板上操作。
  → 緩解：`@dnd-kit` 內建 `PointerSensor`/`TouchSensor`，先以預設感應器設定實作，若實測體驗不佳再調整 `activationConstraint`（例如拖曳觸發距離），不阻塞本次上線。
- **[取捨] 拖曳即時寫入、不做暫存草稿**——代表每次拖曳都是一次即時的、無法整批復原的資料庫寫入（誤拖一個人到錯的組別，只能再拖一次或用既有學員管理頁面手動改回，沒有整批 undo）。
  → 使用者已確認接受此取捨（維持與既有補課/小隊長編輯一致的「立即生效」心智模型），且拖曳操作本身仍是雙向可逆的（拖過去可以再拖回來），與先前教訓「編輯入口必須雙向」的精神一致。

## Migration Plan

1. 新 migration：建立 `spirit_ambassador_groups` 表（`id`, `name` unique, `guidance_chain`, `created_at`）+ RLS 政策比照其餘表（`009_rls_allow_anon.sql` 模式）+ 回填既有 distinct 組名（見上）。
2. 型別：`lib/supabase/types.ts` 新增 `SpiritAmbassadorGroup` 介面。
3. 後端：三個新 API 端點（`spirit-group` PATCH、`spirit-groups` POST、`spirit-groups/[name]` DELETE）。
4. 前端：`app/spirit/page.tsx` 改查詢來源為 `spirit_ambassador_groups` LEFT JOIN 學員；`app/spirit/SpiritClient.tsx` 引入 `@dnd-kit`、新增/刪除組別 UI、匯出按鈕。
5. `package.json` 新增 `@dnd-kit/core` 依賴。
6. 手動驗證：對真實資料庫執行一次「新增空組別 → 重新整理確認仍存在 → 拖一位組員進去 → 刪除另一個已淨空的舊組別 → 匯出 CSV 核對內容」的完整流程，確認無誤後才視為完成（比照先前 spirit-leader 開發時「模擬驗證 + 實際寫入測試並還原」的驗證慣例）。

無需 rollback 特殊處理——新表為新增（不影響既有表結構），新 API 端點為新增路由，既有端點與頁面行為不變；若需回退，刪除新 migration 對應的 `DROP TABLE IF EXISTS spirit_ambassador_groups` 並還原程式碼即可。
