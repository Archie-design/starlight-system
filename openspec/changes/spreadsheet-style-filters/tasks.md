## 1. 型別擴充與向下相容

- [x] 1.1 在 `lib/db/types.ts` 新增 `TextOperator` 型別（`'contains' | 'not_contains' | 'equals' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty'`），`ColumnFilterValue.text` 分支改為 `{ type: 'text'; operator: TextOperator; value: string }`
- [x] 1.2 `ColumnFilterValue.enum` 分支新增 `isEmpty?: boolean`（為 true 時忽略 `values`/`mode`，比對「欄位是否為空」）
- [x] 1.3 在 `lib/utils/columnFilter.ts`（或獨立的相容轉換函式）新增舊格式（`{ type: 'text', value, mode }`）轉新格式（`operator`）的轉換邏輯，供 `sanitizeColumnFilters()` 與 URL 解碼共用
- [x] 1.4 更新 `lib/utils/columnFilterUrl.ts` 的 `decodeColumnFiltersFromParams()`，解碼時套用 1.3 的相容轉換

## 2. 篩選比對邏輯

- [x] 2.1 在 `lib/utils/columnFilter.ts` 的 `matchesOne()` 中，text 分支依 `operator` 分派到對應比對邏輯（contains/not_contains/equals/starts_with/ends_with/is_empty/is_not_empty），空值在 `is_empty` 回傳 true、其餘 operator 對空值一律視為不符合
- [x] 2.2 `matchesOne()` 的 enum 分支新增 `isEmpty` 判斷：`isEmpty` 有值時忽略 `values`/`mode`，改判斷欄位是否為空（`true`=為空、`false`=不為空）
- [x] 2.3 為 2.1、2.2 的每個 operator/isEmpty 分支撰寫邊界案例驗證（空值、空字串、大小寫、恰好等於邊界）——31 項測試全數通過

## 3. 依值篩選：不重複值查詢

- [x] 3.1 在 `lib/db/types.ts` 的 `StudentRepository` 介面新增 `getDistinctValues(field: string, system: SheetSystem, filters: StudentFilters, scope?: { groupLeader?: string }): Promise<string[]>`
- [x] 3.2 在 `lib/db/supabaseRepository.ts` 實作 `getDistinctValues()`：套用 `applySystemFilter`、`scope.groupLeader`（若提供）、其他已生效的 `columnFilters`（明確排除欲查詢欄位 `field` 自身的篩選條件），查詢僅回傳白名單（`COLUMN_FILTER_FIELDS`）內的欄位，JS 端以 `Set` 去重
- [x] 3.3 在 `lib/db/mockRepository.ts` 實作對應的 `getDistinctValues()`，行為與 3.2 一致
- [x] 3.4 驗證「排除欲查詢欄位自身的篩選條件」規則：對某欄位已勾選部分值時，重新開啟該欄位的依值篩選面板，值清單仍顯示全部選項（不會遞減到只剩已勾選的值）——已用 mock repository 驗證三種情境（無篩選/自身篩選被排除/其他欄位篩選生效）皆正確

**實作過程中發現的設計缺口（已解）**：design.md 決策 1 讓 text 型的 `ColumnFilterValue` 只有單一 `value: string`（給 operator 用），但「依值篩選」需要多選值清單，text 型本身無法表達。改為讓 text 型欄位在 `COLUMN_FILTER_FIELDS` 白名單中同時允許 `'text'`（依條件）與 `'enum'`（依值，沿用既有 enum 多選/include-exclude 語意，選項來源改為 `getDistinctValues()`）兩種篩選型態，互斥使用（切籤頁即切換型態）。`COLUMN_FILTER_FIELDS` 型別從 `Record<string, ColumnFilterValue['type']>` 改為 `Record<string, ColumnFilterValue['type'][]>`。

## 4. UI：依值／依條件雙籤頁面板

- [x] 4.1 為 text 型欄位設計雙籤頁面板（重構 `TextFilterPopover.tsx`）：「依值」籤頁顯示動態值清單（呼叫 `getDistinctValues()`）＋搜尋框＋全選/清除；「依條件」籤頁顯示 operator 下拉＋條件文字輸入（`is_empty`/`is_not_empty` 時隱藏輸入框）
- [x] 4.2 依值籤頁的值清單渲染與搜尋邏輯與既有 `MultiSelectDropdown` 的清單/搜尋行為保持一致的視覺與互動語言
- [x] 4.3 切換籤頁（依值 ↔ 依條件）時捨棄另一籤頁尚未套用的草稿狀態
- [x] 4.4 enum 型欄位的篩選面板（`MultiSelectDropdown`）新增「為空／不為空」選項，與既有複選並列（互斥：套用為空/不為空時清空已勾選清單，反之亦然）
- [x] 4.5 在 `components/StudentGrid/ColumnHeaderControls.tsx` 串接新的雙籤頁面板與 `getDistinctValues()` 查詢；`StudentGrid/index.tsx`、`CounselorStudentGrid.tsx` 各自綁定 `fetchDistinctValues`（體系／關懷長分組範圍）

## 5. 匯出與體系隔離驗證

- [x] 5.1 驗證匯出路徑（`app/api/export/route.ts`）在套用新 operator（等於/開頭是/結尾是/為空/不為空）與 enum「為空」條件時，結果與畫面所見一致（沿用既有共用篩選邏輯，未改動程式碼；已用模擬匯出分頁迴圈驗證「介紹人為空」情境）
- [x] 5.2 驗證太陽/星光體系的依值篩選查詢彼此不洩漏（太陽體系的值清單不包含僅星光體系存在的值，反之亦然）——已驗證
- [x] 5.3 驗證關懷長分組表格（`/counselors`）的依值篩選查詢範圍侷限於該分組內的學員——已驗證

## 6. 收尾

- [x] 6.1 執行 `npx tsc --noEmit` 確認無型別錯誤
- [x] 6.2 依 `specs/smart-filters/spec.md` 新增的 Scenario 逐一驗證（依值篩選清單/搜尋/全選清除、7 種 text operator、enum 為空/不為空、體系隔離、匯出一致性）——過程中發現「全選」應為聯集（保留搜尋範圍外已勾選的值）而非取代，已修正
- [x] 6.3 確認舊格式 URL（含 `mode` 無 `operator` 的 text 篩選）可正確還原為新格式的等效篩選（向下相容驗證）——4 項測試通過
