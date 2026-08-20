## Why

使用者希望能比照 Google 試算表的操作習慣，直接在欄位表頭做篩選與排序，而不是每次都要到頂部 FilterBar 尋找對應欄位的篩選器。目前 FilterBar（`components/StudentGrid/FilterBar.tsx`、`components/CounselorsLayout/index.tsx`）只涵蓋姓名、關懷員、地區、角色、課程進度、會籍狀態等固定幾個欄位，其餘欄位（如介紹人、關係人、業務脈、關懷員、小天使等）完全無法篩選，也沒有任何欄位可以排序。與其新開一個獨立的「試算表專區」重建整套資料流與權限判斷，不如直接在現有表格（`components/StudentGrid/index.tsx`、`components/CounselorsLayout/CounselorStudentGrid.tsx`）的表頭上疊加逐欄篩選與排序能力，延續現有的 filters/store/API 架構。

## What Changes

- 在學員表格與關懷長分組表格的每個欄位表頭加入篩選圖示，點擊開啟該欄位專屬的篩選面板（文字欄用包含比對，列舉欄用複選核取方塊，日期欄用區間，數值欄用範圍）。
- 在支援排序的欄位表頭加入排序控制（遞增/遞減/取消排序），一次僅套用單一排序欄位。
- 欄位表頭篩選與現有 FilterBar 篩選共同疊加生效（AND 關係），操作邏輯與 store 結構延伸自既有 `StudentFilters`，不建立平行的第二套篩選狀態。
- 匯出（`GET /api/export`）套用相同的篩選與排序條件，維持「匯出 = 畫面所見」。
- 篩選/排序狀態同步進 URL query string（延伸現有 FilterBar 的 URL 同步模式），可分享、可重新整理後保留。
- 不另建獨立頁面或路由；不引入試算表風格的儲存格編輯/公式等能力。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `smart-filters`：新增「表頭欄位篩選」需求（逐欄篩選面板、與既有篩選疊加、體系隔離、匯出一致）與「欄位排序」需求（單欄位排序、URL 同步）。

## Impact

- **Affected code**:
  - `components/StudentGrid/columns.tsx`、`components/StudentGrid/index.tsx`（表頭 UI、篩選/排序控制）
  - `components/CounselorsLayout/CounselorStudentGrid.tsx`（同款表頭 UI）
  - `store/useStudentStore.ts`、`store/useCounselorStore.ts`（篩選狀態擴充至逐欄條件、新增排序狀態）
  - `lib/db/types.ts`（`StudentFilters` 擴充逐欄篩選欄位與排序欄位）
  - `lib/db/supabaseRepository.ts`、`lib/db/mockRepository.ts`（套用逐欄篩選與排序邏輯）
  - `app/api/export/route.ts`（匯出時套用相同的逐欄篩選與排序）
  - `components/shared/MultiSelectDropdown.tsx`（可能重用於列舉型欄位的表頭篩選面板）
- **Affected specs**: `openspec/specs/smart-filters/spec.md`
- **No breaking changes**：既有 FilterBar 篩選行為與 URL 參數維持不變，新增能力為疊加式。
