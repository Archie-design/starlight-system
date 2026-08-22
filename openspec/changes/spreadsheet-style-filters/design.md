## Context

現況（見 proposal.md - Why）：

- `ColumnFilterValue`（`lib/db/types.ts`）目前是 `text | enum | range` 三種型態的判別聯合，`text` 只有一個 `value: string`（固定「包含」比對），`enum` 只有勾選清單 `values: string[]`（選項來源是 `columns.tsx` 裡 `selectCell()` 寫死的常數陣列 `enumOptions`），兩者皆支援 `mode: 'include' | 'exclude'`（前一輪已加）。
- text 型欄位（介紹人、業務脈、關懷員、課程梯次等，共 22+ 個）目前完全沒有「列出實際出現過的值」的能力——選項只存在於資料庫，前端沒有任何機制查詢「這個欄位在目前查詢範圍內有哪些不重複值」。
- 篩選比對邏輯集中在 `lib/utils/columnFilter.ts` 的 `matchesOne()`，由 `supabaseRepository.ts`（SQL 下推 `applyCommonFilters` + JS 後處理 `matchesPostFilter`）與 `mockRepository.ts`（純 JS `matchesFilters`）共用；SQL 下推目前只處理 `text` 型的「包含」模式，其餘一律走全量載入 + JS 過濾。
- 表頭篩選 UI 由 `ColumnHeaderControls.tsx` 依欄位 `meta.filterable` 分派到 `TextFilterPopover.tsx` / `MultiSelectDropdown.tsx`（enum，含 include/exclude 切換）/ `RangeFilterPopover.tsx`。
- 體系隔離統一由 `applySystemFilter()`（`lib/utils/system.ts`）處理，所有查詢路徑（含分頁查詢、匯出）都會先套用。

## Goals / Non-Goals

**Goals:**
- text 型欄位取得「依值篩選」能力：列出目前查詢範圍內實際出現過的不重複值，供勾選，行為上等同把 text 型也接上一份動態產生的 `enumOptions`。
- text 型欄位的「依條件篩選」從固定的包含/排除，擴充成 7 種比對條件（包含、不包含、等於、開頭是、結尾是、為空、不為空）。
- enum 型欄位新增「為空／不為空」條件，與既有複選並列。
- 依值篩選的不重複值查詢、依條件篩選的比對邏輯，都要遵循既有的體系隔離與其他已生效篩選條件範圍，不能繞過 `applySystemFilter()`。

**Non-Goals:**
- range 型（日期/數值區間）不擴充條件，維持現有「區間包含/排除」（proposal 已排除）。
- 不做「依顏色篩選/排序」（系統無儲存格顏色概念，不適用）。
- 不做多條件同時套用同一欄位（例如「開頭是 A 且結尾是 B」）——一個欄位一次仍只有一組條件，與現有 `ColumnFilterValue` 單一物件的資料結構一致。
- 不改變 range 型、既有 enum 複選 include/exclude、text 既有 include/exclude 的預設行為（向下相容）。

## Decisions

### 1. `ColumnFilterValue` 的 `text` 分支擴充 `operator` 欄位，取代單純以 `mode` 表達語意

```ts
type TextOperator = 'contains' | 'not_contains' | 'equals' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty'

type ColumnFilterValue =
  | { type: 'text'; operator: TextOperator; value: string } // value 在 is_empty/is_not_empty 時忽略
  | { type: 'enum'; values: string[]; mode?: ColumnFilterMode; isEmpty?: boolean } // isEmpty 為 true 時忽略 values/mode，改比對「是否為空」
  | { type: 'range'; min?: string; max?: string; mode?: ColumnFilterMode }
```

**理由**：原本的 `mode: 'include' | 'exclude'` 只能表達「包含」的正反面，無法表達「等於」「開頭是」這種比對方式本身的差異。與其疊加更多 boolean flag（`isExact`、`isPrefix`...），不如直接用一個 `operator` 判別式取代 text 型的 `mode`+`value`，語意更明確、UI 端也只需渲染一個下拉選單決定 operator。`contains`/`not_contains` 對應原本的 `mode: 'include'/'exclude'`，是既有行為的重新命名而非破壞——為了向下相容 URL 中可能已存在的舊格式（`{ type: 'text', value, mode }`），解碼層（`sanitizeColumnFilters`／`decodeColumnFiltersFromParams`）需要做一次型態轉換：偵測到舊格式（有 `mode` 無 `operator`）時，轉換成 `operator: mode === 'exclude' ? 'not_contains' : 'contains'`。

**替代方案考慮**：保留 `mode`，另外加 `matchType: 'contains' | 'exact' | 'prefix' | 'suffix'` 兩個欄位相乘。放棄原因：`is_empty`/`is_not_empty` 用 `mode × matchType` 表達會出現無意義的欄位組合（例如 `matchType: 'prefix', mode: 'exclude'` 對 `is_empty` 沒有意義），單一 `operator` 判別式更乾淨、無法表達出不合法的組合。

### 2. enum 型改用 `isEmpty` 布林旗標而非併入 text 的 operator 體系

enum 的「為空/不為空」與既有的複選勾選是互斥的操作模式（互斥即 UI 上要嘛勾清單、要嘛選為空/不為空），用一個獨立的 `isEmpty?: boolean` 表達「這次篩選改用為空/不為空語意」，比把 enum 也套上 `operator` 判別式更省事——enum 沒有「開頭是」「等於」這些概念（本來就是精確匹配），只多「為空」這一種特殊情況。

**理由**：enum 選項清單本身就是精確值域，不需要 text 那 5 種文字比對方式，只有「為空」是清單勾選無法表達的（因為空值不會出現在 `enumOptions` 清單裡）。

### 3. 依值篩選的不重複值查詢新增 `StudentRepository.getDistinctValues()` 方法

```ts
interface StudentRepository {
  // ...既有方法
  /** 取得指定欄位在目前查詢範圍（體系 + 其他已生效篩選）內的不重複值，用於依值篩選的值清單 */
  getDistinctValues(field: string, system: SheetSystem, filters: StudentFilters, scope: { groupLeader?: string }): Promise<string[]>
}
```

Supabase 端用 `.select(field).neq(field, null)` 搭配既有的 `applySystemFilter` + `applyCommonFilters`（沿用可下推的部分），JS 端 `Set` 去重；因為欄位是白名單內的固定欄位（見 `COLUMN_FILTER_FIELDS`），不會有 SQL injection 疑慮。查詢範圍要排除「該欄位自己的表頭篩選」（否則已經勾選的值會讓其他選項在下次開面板時消失），但要包含其他所有已生效的篩選條件——即傳入的 `filters.columnFilters` 需要先移除 `field` 自己那個 key。

**理由**：這是唯一需要新增資料存取方法的地方，因為現有的 `findBySystem`/`findByGroupLeader` 回傳的是分頁後的 `Student[]`，無法直接拿來做「全體不重複值」查詢（分頁範圍不等於全體）。獨立方法讓值清單查詢與分頁查詢的關注點分開，且兩個 repository 實作（Supabase/mock）都要提供，維持既有的 repository 抽象一致性。

**替代方案考慮**：讓前端自己從當前頁面已載入的 `Student[]` 收集不重複值。放棄原因：分頁只載入當頁最多 100 筆，值清單會不完整、且跟畫面上「共 2,076 筆」的資料量脫鉤，不符合 Google 試算表「列出全部出現過的值」的預期。

### 4. UI：`TextFilterPopover` 拆分為「依值」與「依條件」兩個分頁籤，而非兩個獨立面板

面板內加一組籤頁切換（「依值」／「依條件」），依值籤頁顯示動態值清單＋搜尋＋全選/清除（沿用 `MultiSelectDropdown` 的清單渲染邏輯，但資料來源是動態查詢而非寫死選項）；依條件籤頁顯示 operator 下拉＋條件文字輸入（`is_empty`/`is_not_empty` 時隱藏文字輸入）。兩籤頁共用同一個 `ColumnFilterValue`，切換籤頁不會保留另一籤頁的草稿狀態（例如從依值切到依條件，原本勾選的值清單會被捨棄）。

**理由**：這對應 Google 試算表原生選單「依條件篩選」與「依值篩選」在同一個選單內並列、切換即互斥的體驗，使用者心智模型一致；且 enum 型欄位的依值清單原本就用 `MultiSelectDropdown`，讓 text 型的依值籤頁重用同一套渲染與搜尋邏輯，避免重造。

## Risks / Trade-offs

- **[Risk]** `getDistinctValues()` 若欄位值分佈很廣（例如每個學員的「介紹人」欄位幾乎都不同），值清單會很長，渲染與搜尋體驗變差。
  → **Mitigation**：值清單超過門檻（例如 200 筆）時，面板提示「值過多，建議使用依條件篩選」並仍提供搜尋框協助縮小範圍；不做分頁載入或虛擬滾動（Non-Goal，日後量測後再評估）。
- **[Risk]** `getDistinctValues()` 排除「該欄位自己的表頭篩選」但納入其他篩選，實作上容易漏改（例如忘記排除自己），導致值清單隨著使用者勾選而遞減到只剩已勾選的值。
  → **Mitigation**：在 design 明確記錄這個規則，並在 tasks 中列為獨立驗證項目。
- **[Risk]** 新增 `getDistinctValues()` 到 `StudentRepository` 介面是一個介面擴充，若未來有其他 repository 實作（目前只有 Supabase 與 Mock 兩個）忘記實作會造成 TypeScript 編譯錯誤而非執行期錯誤——這其實是好事（強制同步），但要留意 `findByMaintenanceCategory` 是否也需要對應方法（本次範圍限定在 `/students`、`/counselors` 兩個主要清單，維護專區暫不需要依值篩選）。
  → **Mitigation**：`getDistinctValues()` 不綁定 `findByMaintenanceCategory` 的呼叫路徑，維護專區頁面本次不接這個新方法。
- **[Trade-off]** text 型從單一 `mode` 改成 `operator` 判別式，是一次型別擴充但非破壞性變更（新舊格式共存於解碼層），仍會讓 `matchesOne()` 的 text 分支從 2 個分支（include/exclude）變成 7 個分支，複雜度上升但都是純函式、容易個別驗證。

## Migration Plan

- `ColumnFilterValue.text` 新增 `operator` 欄位、舊有 `mode` 欄位保留但標記淘汰（deprecated），解碼層（URL 還原、`sanitizeColumnFilters`）做一次性轉換，確保線上已存在的舊格式 URL（例如使用者書籤、分享連結）仍可正確還原成新格式的等效篩選。
- 分階段：1) 型別擴充 + 向下相容轉換 → 2) `matchesOne()` 新增 operator 分支邏輯 → 3) `getDistinctValues()` 兩個 repository 實作 → 4) UI 依值/依條件雙籤頁面板 → 5) 匯出路徑驗證（沿用既有共用邏輯，理論上不需改動程式碼，僅需驗證）。
- 無資料庫 schema 變更，純屬應用層邏輯與 UI。
- Rollback：新籤頁與新 operator 皆為疊加式，若需回退可只回退 UI 層（面板改回單一包含/排除輸入框），底層型別與比對邏輯的新增分支不影響舊有呼叫端。
