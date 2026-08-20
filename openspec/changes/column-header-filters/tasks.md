## 1. 型別與狀態擴充

- [x] 1.1 在 `lib/db/types.ts` 的 `StudentFilters` 新增 `columnFilters?: Record<string, ColumnFilterValue>`，定義 `ColumnFilterValue`（`text` / `enum` / `range` 三種）
- [x] 1.2 在 `lib/db/types.ts` 新增 `SortState { field: string; direction: 'asc' | 'desc' } | null` 型別
- [x] 1.3 擴充 `StudentRepository.findBySystem` / `findByGroupLeader` 簽章，新增 `sort?: SortState` 參數
- [x] 1.4 在 `useStudentStore.ts`、`useCounselorStore.ts` 新增 `columnFilters`、`sort` 狀態與對應 setter（`setColumnFilter(field, value)`、`clearColumnFilter(field)`、`setSort(sort)`），變更時比照既有 `setFilter` 重置 `page: 0`

## 2. 欄位白名單與表頭 UI

- [x] 2.1 在 `components/StudentGrid/columns.tsx` 的欄位定義新增 `filterable?: 'text' | 'enum' | 'range'`、`sortable?: boolean` 中介資料（僅原生資料庫欄位可標記 `sortable: true`，衍生欄位如課程進度不開放）
- [x] 2.2 抽出 `MultiSelectDropdown` 的共用 popover 定位/點外部關閉邏輯，供新元件重用
- [x] 2.3 新增 `components/shared/TextFilterPopover.tsx`（文字包含比對）
- [x] 2.4 新增 `components/shared/RangeFilterPopover.tsx`（數值／日期區間）
- [x] 2.5 在 `components/StudentGrid/index.tsx` 表頭渲染中，依欄位的 `filterable` 中介資料掛載對應的篩選圖示與 popover
- [x] 2.6 在 `components/StudentGrid/index.tsx` 表頭渲染中，依欄位的 `sortable` 中介資料掛載排序控制（遞增/遞減/取消），並在切換時清除前一個排序欄位
- [x] 2.7 在 `components/CounselorsLayout/CounselorStudentGrid.tsx` 套用相同的表頭篩選/排序 UI（重用同一批共用元件與欄位中介資料）

## 3. 篩選與排序邏輯（伺服器端）

- [x] 3.1 新增 `lib/utils/columnFilter.ts`，實作 `matchesColumnFilters(student, columnFilters): boolean` 純函式
- [x] 3.2 在 `lib/db/supabaseRepository.ts` 的 `applyCommonFilters()` 中，將可下推的 `columnFilters`（`type: 'text'` 對應資料庫原生文字欄）動態轉為 `.ilike()` 條件
- [x] 3.3 在 `lib/db/supabaseRepository.ts` 的 `needsPostFilter()` 納入無法下推的 `columnFilters`（enum/range），`matchesPostFilter()` 呼叫 `matchesColumnFilters()`
- [x] 3.4 在 `lib/db/supabaseRepository.ts` 的查詢建構中，依 `sort` 參數套用 `.order(field, { ascending })`（僅限白名單內 `sortable` 欄位；未提供 `sort` 時維持既有 `.order('id', { ascending: true })`）
- [x] 3.5 在 `lib/db/mockRepository.ts` 的 `matchesFilters()` 中呼叫同一個 `matchesColumnFilters()`，並在分頁前依 `sort` 對全量結果排序
- [x] 3.6 為 `matchesColumnFilters()` 三種篩選型態（text/enum/range）分別驗證邊界情況（空值、`min`/`max` 其中一端缺省、複選為空陣列視為不限）

## 4. URL 同步

- [x] 4.1 在 `components/StudentGrid/FilterBar.tsx`（或表格容器層）的 URL 同步 `useEffect` 中，將 `columnFilters` 序列化進 query string（例如 `cf.<field>=<encoded>`）與還原邏輯
- [x] 4.2 將 `sort` 序列化為 `sortField`、`sortDir` 兩個 query 參數，並在初次載入時還原
- [x] 4.3 `components/CounselorsLayout/index.tsx` 套用相同的 URL 同步邏輯

## 5. 匯出一致性

- [x] 5.1 將 `app/api/export/route.ts` 改為呼叫 `StudentRepository.findBySystem`（以大 `pageSize` 或分頁迴圈取得全量結果），取代目前獨立重寫的 filter 邏輯，並傳入當前的 `columnFilters`、`sort`
- [x] 5.2 確認匯出結果的排序順序與畫面一致（同一個 `sort` 條件）
- [x] 5.3 確認匯出結果的體系隔離與既有權限判斷（`getEffectiveSystem`）未受影響

## 6. 驗證

- [x] 6.1 依 `specs/smart-filters/spec.md` 新增的 Scenario 逐一手動驗證（表頭文字篩選、疊加 FilterBar 篩選、清除單一欄位篩選、遞增/遞減/切換排序欄位、重新整理保留條件、關懷長分組隔離、匯出一致性）
- [x] 6.2 執行 `npx tsc --noEmit` 確認無型別錯誤
- [x] 6.3 確認 `mockRepository.ts` 路徑（無 Supabase 環境時的開發模式）行為與 `supabaseRepository.ts` 一致
