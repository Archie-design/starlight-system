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

### Decision 6：匯出——複用 `downloadRosterCsv()` 模式，純前端組裝

**決定**：新增一個「匯出總表」按鈕，點擊後用目前頁面已有的 `rosterGroups` 資料（前端 state，已含組別、排序後的組員、小隊長/補課標示）直接組裝 CSV 字串，比照 `app/courses/CourseClient.tsx` 的 `downloadRosterCsv()`：UTF-8 BOM 前綴、`Blob` + `URL.createObjectURL` + 合成 `<a download>` 點擊。不新增伺服器端匯出端點。

**欄位**：組別、組內順序、姓名、是否小隊長、是否已完成補課（含「已是正式心之使者」三態說明，避免管理者誤讀）。

**理由**：匯出當下畫面上的 `rosterGroups` 就是「目前最終分組結果」，不需要額外一趟伺服器查詢；與課程專區的既有先例技術一致，不引入新的匯出基礎設施。

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
