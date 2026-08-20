## Context

現況（見 proposal.md - Why）：

- 篩選狀態集中在 `StudentFilters`（`lib/db/types.ts`），由 `useStudentStore` / `useCounselorStore`（Zustand）持有，經 `StudentRepository.findBySystem` / `findByGroupLeader` 傳入 `lib/db/supabaseRepository.ts`。可下推 SQL 的條件用 `applyCommonFilters()`（PostgREST `.ilike`/`.eq`），無法下推的條件（課程進度、會籍狀態、快捷視圖）用 `needsPostFilter()` + `matchesPostFilter()` 全量載入後在 JS 端過濾。
- 表格已用 TanStack Table（`components/StudentGrid/index.tsx`），且已有 `sorting` state 與 `getSortedRowModel()`，但這只對**當前已載入的那一頁**（`PAGE_SIZE = 100`）做排序，不是跨頁的全域排序——因為分頁本身是 server-side（`PageRange` + `count`）。
- `MultiSelectDropdown`（`components/shared/MultiSelectDropdown.tsx`）已存在，是最近會籍狀態多選改造時新增的通用元件，可重用於列舉型欄位的表頭篩選面板。
- 匯出（`app/api/export/route.ts`）獨立於表格渲染之外，用同一組篩選邏輯的複製版本（不是共用函式），全量載入後在 JS 端 filter + `logAdminAction`。

## Goals / Non-Goals

**Goals:**
- 讓逐欄篩選與排序條件都能下推到伺服器（Supabase 查詢），確保「跨頁」正確——不能只排序/篩選當前已載入的 100 筆。
- 篩選邏輯集中在一處被 `findBySystem`、`findByGroupLeader`、匯出三處共用，避免像現在這樣三處各自維護一份 filter 邏輯（`supabaseRepository.ts`、`mockRepository.ts`、`export/route.ts` 目前就已經是三份幾乎相同但獨立維護的程式碼，這次不應再擴大這個重複）。
- 表頭篩選面板的互動元件盡量重用 `MultiSelectDropdown`，避免重造。

**Non-Goals:**
- 不做多欄位同時排序（一次僅一個排序欄位，與現有 `SortingState` 的既有使用方式一致）。
- 不做儲存格層級的公式、複製貼上等試算表能力（proposal 已排除）。
- 不改變 FilterBar 現有篩選欄位的行為或 UI（僅新增表頭這個新入口）。
- 不在這次變更中把 `mockRepository.ts` 與 `supabaseRepository.ts` 的重複邏輯做大重構；僅在新增的欄位篩選/排序邏輯上，抽出可共用的純函式讓兩邊呼叫，其餘既有重複維持現狀。

## Decisions

### 1. 逐欄篩選以「欄位 → 條件」的 map 擴充 `StudentFilters`，不建立平行的第二套篩選狀態

新增 `StudentFilters.columnFilters?: Record<string, ColumnFilterValue>`，其中 `ColumnFilterValue` 依欄位型態分三種：
```ts
type ColumnFilterValue =
  | { type: 'text'; value: string }              // 包含比對
  | { type: 'enum'; values: string[] }            // 複選
  | { type: 'range'; min?: string; max?: string } // 日期或數值區間（字串以保留 date/number 兩種來源格式）
```
**理由**：欄位清單會隨 `columns.tsx` 增減（CLAUDE.md「Adding a new xlsx column」已是既定擴充流程），用一個以欄位 key 為索引的 map 可以讓新增欄位時「順便」取得篩選能力，不需要每加一個欄位就改一次 store 的固定欄位清單（目前 `membershipStatus`、`courseStage` 這種每個條件各自一個 top-level 欄位的做法，在欄位數增加後會讓 `StudentFilters` 迅速膨脹）。

**替代方案考慮**：比照 `membershipStatus` 模式，每個可篩選欄位各自开一個 top-level 欄位。放棄原因：欄位表可能持續增加（見 CLAUDE.md 的新增欄位 SOP），固定欄位清單會讓 `StudentFilters`、store 的 `DEFAULT_FILTERS`、URL 同步邏輯都要跟著每次新增欄位而修改，維護成本隨欄位數線性增加。

### 2. 排序改為伺服器端單一欄位排序，透過 `StudentFilters` 之外的獨立 `sort` 參數傳遞

新增 `SortState { field: string; direction: 'asc' | 'desc' } | null`，作為 `findBySystem` / `findByGroupLeader` 的獨立參數（不塞進 `StudentFilters`，因為排序不是「篩選條件」，語意不同，且避免污染 `needsPostFilter()` 的判斷邏輯）。

可下推 SQL 排序的欄位（資料庫原生欄位，如 `name`、`membership_expiry`、`created_at`）直接用 PostgREST `.order()`；需要衍生計算的欄位（如「課程進度＝最高完成階」）暫不開放排序（在表頭排序控制的可用欄位清單中不出現該欄位的排序圖示），避免要在 JS 端對「已下推分頁」的資料做二次排序而導致跨頁排序錯誤。

**理由**：現有 `getSortedRowModel()` 的 client-side 排序只能排當前頁，不符合「排序後結果跨頁一致」的預期（使用者點了排序，理應是全體結果排序後的第 1~100 筆，而非先分頁再排序）。改為伺服器端排序後，前端 TanStack Table 的 `sorting` state 僅用於控制表頭圖示顯示，實際排序改由重新查詢伺服器達成（等同於現有「篩選變更→重新查詢→回到第 0 頁」的既有模式，見 `setFilter` 的 `page: 0` 副作用）。

**替代方案考慮**：保留 client-side 排序，僅排序當前頁。放棄原因：使用者從 Google 試算表得到的心智模型是「排序 = 全體資料重排」，只排當前頁會讓人誤以為資料不完整或系統有 bug。

### 3. 表頭篩選面板重用 `MultiSelectDropdown`；文字/範圍型另建輕量元件

列舉型欄位（如關係人、業務脈等有限選項的欄位）直接重用 `components/shared/MultiSelectDropdown.tsx`。文字包含比對與數值/日期範圍另建 `components/shared/TextFilterPopover.tsx`、`components/shared/RangeFilterPopover.tsx`，共用同一套「點擊開關 + 點外部關閉」的 popover 邏輯（可從 `MultiSelectDropdown` 抽出共用的 `useClickOutside` hook 或相同的 `open/ref` pattern）。

**理由**：`MultiSelectDropdown` 目前的 z-index 修正（`z-50`）、點擊外部關閉、按鈕徽章樣式都已驗證可在表格上方正確顯示（上一輪已修過表頭 sticky 遮擋問題），沿用同一套定位與 z-index 策略可避免新元件重踩同一個坑。

### 4. 逐欄篩選與排序邏輯抽出共用純函式，供 `supabaseRepository.ts` 與 `mockRepository.ts` 呼叫；匯出改為呼叫 repository 而非重寫邏輯

新增 `lib/utils/columnFilter.ts`，提供 `matchesColumnFilters(student, columnFilters): boolean` 純函式，供 `matchesPostFilter()`（supabase 版）與 `matchesFilters()`（mock 版）共用；可下推 SQL 的欄位篩選（`type: 'text'` 對應資料庫原生文字欄）在 `applyCommonFilters()` 中動態迭代 `columnFilters` 下推，其餘（enum/range 或無法下推的欄位）留給 JS 後處理共用函式。

匯出路由目前是獨立重寫一份 filter 邏輯（`app/api/export/route.ts` 的 `rows = all.filter(...)`），這次新增的欄位篩選/排序**不**在匯出路由內重寫第三份邏輯，而是讓匯出改為呼叫 `StudentRepository`（透過既有的 `findBySystem`，用大 `pageSize` 或迴圈分頁取得全量結果）以重用同一套查詢與後處理邏輯。既有的 `courseStage`/`membershipStatus`/`view` 篩選在匯出路由中的重複實作維持現狀不動，僅新增的欄位篩選/排序不再新增第三份重複。

**理由**：明確避免這次新增的兩個能力（欄位篩選、排序）在三個地方各寫一份三份都要同步維護的邏輯，這是 proposal 中特別要避免的「重新開試算表專區」問題的縮小版重演。

## Risks / Trade-offs

- **[Risk]** 動態 `columnFilters` map 若不限制可篩選欄位白名單，可能讓使用者對後端未建索引的欄位做 `ilike`，效能不可控。
  → **Mitigation**：在 `columns.tsx` 的欄位定義中新增 `filterable?: 'text' | 'enum' | 'range'` 中介資料，表頭篩選圖示只在該欄位標記為可篩選時出現；`columnFilters` 的 key 僅限這個白名單內的欄位，其餘一律忽略（後端不信任前端傳來的任意 key）。
- **[Risk]** 匯出改走 `findBySystem` 分頁迴圈可能比現在「一次全量 `.range()` 迴圈」慢（多一層 repository 抽象、多次往返）。
  → **Mitigation**：`findBySystem` 內部本來就是全量載入 + JS 後處理（`needsPostFilter` 為真時），效能特性與現況相近；若量測後有明顯落差，可讓 repository 額外提供一個「不分頁、直接回傳全量」的方法供匯出專用，而非回退成重寫第三份邏輯。
- **[Risk]** 排序欄位若涵蓋「衍生欄位」（如課程進度）未來需求若擴大，伺服器端排序會變複雜（需要 SQL 運算式或維護額外欄位）。
  → **Mitigation**：本次明確排除衍生欄位排序（Non-Goals 之外的欄位範圍限制），未來若有需求，個別評估是否新增資料庫 computed column。
- **[Trade-off]** 排序改為伺服器端後，每次切換排序都會重新打 API（等同一次篩選變更），比純 client-side 排序多一次網路延遲。
  → 可接受：與現有「切換 FilterBar 篩選」的使用者體感一致，且能保證跨頁排序正確性，正確性優先於這點延遲。

## Migration Plan

- 新欄位（`columnFilters`、`sort`）皆為選填（optional），預設 `undefined`/`null`，不影響現有呼叫端（FilterBar 既有篩選、既有 URL 參數）。
- 分階段：1) `lib/db/types.ts` 型別擴充 → 2) `columns.tsx` 白名單標記 + 表頭 UI → 3) `supabaseRepository.ts`/`mockRepository.ts` 套用邏輯 → 4) URL 同步 → 5) 匯出路由改走 repository。每階段可獨立驗證，不需一次性上線。
- 無資料庫 schema 變更，純屬應用層邏輯與 UI，無需新增 migration。
- Rollback：因功能為疊加式（不修改既有 FilterBar 行為），若需回退，移除表頭 UI 與 `columnFilters`/`sort` 的讀取即可，不影響既有篩選路徑。
