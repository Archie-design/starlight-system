## Why

比對 Google 試算表的欄位篩選選單（依值篩選、依條件篩選）盤點後，目前表頭篩選（`components/StudentGrid/ColumnHeaderControls.tsx`）仍有兩項明顯缺口：① enum 型欄位（`selectCell()` 建立的性別／角色／地區）只能篩選寫死在程式碼裡的固定選項，text 型欄位（介紹人、業務脈、關懷員、課程梯次等大多數欄位）完全沒有「列出實際出現過的值供勾選」的能力——使用者若想篩選「介紹人＝3034_張安奇」，必須用文字包含比對手打，無法像 Google 試算表那樣直接勾選清單；② 目前的篩選條件只有「包含／排除」兩種比對方式，沒有「等於」「開頭是」「結尾是」「為空」「不為空」這類更精確的條件，遇到「介紹人為空」「業務脈開頭是星」這類需求時做不到。

## What Changes

- 新增「依值篩選」：text 與 enum 型欄位的篩選面板改為列出該欄位在目前體系範圍內實際出現過的不重複值（依出現頻率或字母排序），提供搜尋框即時過濾選項清單、以及「全選／清除」快捷操作，取代 text 型目前僅有的手動輸入框（手動輸入包含比對仍保留，作為值清單之外的補充方式，兩者可切換）。
- 新增「依條件篩選」：text 型欄位新增比對條件選單（包含／不包含／等於／開頭是／結尾是／為空／不為空），取代目前只有「包含」與「排除（不包含）」兩種寫死的比對方式；enum 型欄位額外提供「為空／不為空」條件。
- range 型欄位（日期/數值區間）不在此次範圍內，維持現有「區間包含/排除」不變。
- 依值篩選的動態值清單需與其餘已套用的篩選條件（FilterBar、其他欄位表頭篩選）保持一致的體系隔離範圍，不得洩漏其他體系的值。
- 匯出套用相同的依值/依條件篩選結果，維持「匯出＝畫面所見」。

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `smart-filters`：新增「依值篩選」需求（動態值清單、搜尋、全選/清除、體系隔離）與「依條件篩選」需求（text 型比對條件選單：包含/不包含/等於/開頭是/結尾是/為空/不為空；enum 型新增為空/不為空）。

## Impact

- **Affected code**:
  - `lib/db/types.ts`（`ColumnFilterValue` 的 `text` 分支擴充比對條件、`enum` 分支支援「為空/不為空」的特殊值集合表示）
  - `lib/utils/columnFilter.ts`（`matchesOne()` 依新條件比對；新增「取得欄位不重複值清單」的查詢邏輯）
  - `lib/db/supabaseRepository.ts`、`lib/db/mockRepository.ts`（提供欄位不重複值清單的查詢方法，並套用體系隔離）
  - `components/shared/TextFilterPopover.tsx`（改版為條件選單＋值清單雙模式面板，或拆分為新元件）
  - `components/StudentGrid/ColumnHeaderControls.tsx`（串接新的欄位值清單查詢與條件選單）
  - `app/api/export/route.ts`（延續既有共用邏輯，理論上不需改動，僅需驗證新條件在匯出路徑正確套用）
- **Affected specs**: `openspec/specs/smart-filters/spec.md`
- **No breaking changes**：現有「包含」比對條件的預設行為不變，`ColumnFilterValue` 的既有欄位（`value`、`values`、`mode`）維持相容，新增欄位皆為選填。
