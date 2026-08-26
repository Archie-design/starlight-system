## Why

匯入來源 xlsx（`學員資料庫 20260606.xlsx`）已經有「縣市/州/省」「地區」「地址」三個地理位置欄位，但目前匯入流程完全不擷取這些資料，也沒有對應的資料庫欄位可以儲存。這些欄位不是日常操作的高頻欄位，因此需求明確指定預設隱藏、僅在有需要時（例如郵寄、活動地區統計）透過表頭「欄位設定」面板手動開啟顯示，避免預設就佔用主表格畫面空間。

## What Changes

- 新增三個學員資料欄位：縣市（`county`）、地區/地址分類（`district`）、地址（`address`）。
- 匯入流程（`transform.ts`/`parseXlsx.ts`）新增這三欄的來源欄位映射，支援標題文字動態偵測（比照既有欄位的偵測機制）。
- `students` 表新增對應的三個 TEXT 欄位（新 migration）。
- 主表格（`/students`）新增這三個欄位的表頭定義，並在畫面初次載入時預設為隱藏，使用者可透過既有的「欄位設定」面板手動勾選開啟顯示。
- **命名澄清（避免與既有欄位混淆）**：現有 `region` 欄位（對應 xlsx「輔導區域/關懷區域」，UI 顯示為「地區」）語意是輔導組織架構分區，與這次新增的地理位置「地區」欄位（`district`）是完全不同的概念。新欄位在 UI 上顯示為「地區（地址）」以做區隔；現有 `region`／「地區」欄位維持不動。

## Capabilities

### New Capabilities
- `student-address-fields`: 學員的地理位置資訊（縣市、地區、地址）可從 xlsx 匯入、儲存、並在主表格中依欄位設定顯示/隱藏，預設隱藏。

### Modified Capabilities
（無——不修改任何既有 capability 的既有需求；`region`/「地區」既有欄位的語意與行為維持不變，只是新增另一組不同名稱、不同顯示文字的欄位。）

## Impact

- **資料庫**：新增 migration，`students` 表新增 `county TEXT`、`district TEXT`、`address TEXT`（皆可為 null，與其他文字欄位一致）。
- **匯入邏輯**：`lib/import/transform.ts`（`DEFAULT_COL`、`HEADER_TO_COL_KEY`、`transformSourceRow()`）、`lib/supabase/types.ts`（`Student`/`StudentInsert`）。
- **UI**：`components/StudentGrid/columns.tsx`（新增三個表頭定義，`filterable: 'text'`）、`components/StudentGrid/Toolbar.tsx` 依賴的 `lib/constants/index.ts`（`COLUMN_GROUPS`，新增到合適的分組）、`store/useStudentStore.ts`（初始 `columnVisibility` 需明確將這三欄設為 `false` 才會預設隱藏）。
- **匯出**：依 CLAUDE.md 記載的既有慣例，新增欄位通常也要同步加進 `lib/export/buildXlsx.ts`（供「匯出 xlsx」使用）——本次一併評估是否納入，於 design.md 決定。
- **不影響**：既有 `region`／「地區」欄位的資料、顯示、篩選行為完全不變；`/counselors`、`/maintenance` 頁面的欄位分組視個別需要決定是否比照加入（見 design.md）。
