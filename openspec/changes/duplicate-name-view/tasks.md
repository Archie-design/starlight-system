## 1. 型別與判定工具

- [x] 1.1 `lib/db/types.ts`：`StudentView` union 新增 `'duplicate_name'`
- [x] 1.2 新增共用判定工具（建議放 `lib/utils/duplicateName.ts`）：`buildDuplicateNameSet(students): Set<string>` — 以 `name.trim()` 統計，回傳出現 ≥2 次的姓名集合（`trim` 後為空者排除）；另附 `isDuplicateName(student, set): boolean`

## 2. 篩選核心（學員列表）

- [x] 2.1 `lib/db/supabaseRepository.ts`：`needsPostFilter` 已涵蓋 `!!filters.view`，確認 `'duplicate_name'` 會走全量載入路徑（不需改）
- [x] 2.2 `lib/db/supabaseRepository.ts` `runPaged`：全量載入後，若 `filters.view === 'duplicate_name'`，先以 `buildDuplicateNameSet(all)` 建立重複姓名集合
- [x] 2.3 `matchesPostFilter`：新增 `case 'duplicate_name'`，依傳入的重複姓名集合判定（需為函式多加一個選用參數）
- [x] 2.4 過濾後、slice 分頁前：依姓名分群排序（同名相鄰），同名內以 `id` 排序確保穩定

## 3. 匯出同步（維持「匯出＝畫面所見」）

- [x] 3.1 `app/api/export/route.ts`：於載入全量資料後同樣建立重複姓名集合，`switch (view)` 新增 `case 'duplicate_name'`
- [x] 3.2 確認匯出結果與畫面一致 — **已做結構性驗證**：查詢層、匯出、mock 三處皆呼叫同一組共用函式（`buildDuplicateNameSet`→`isDuplicateName`→`sortByNameGroup`）且流程結構相同，消除 design 所列「兩份平行邏輯漏改」風險。實際筆數比對仍需真實資料，見 7.7

## 4. UI

- [x] 4.1 `components/StudentGrid/FilterBar.tsx`：`QUICK_VIEWS` 新增 `{ value: 'duplicate_name', label: '同名學員' }`（沿用既有互斥 `toggleQuickView`，不需改 store）
- [x] 4.2 ~~確認 URL 帶 `?view=duplicate_name` 可正確還原此視圖~~ — **前提有誤，已查證**：`FilterBar` 只同步 name/counselor/region/role/hasCourse5 到 URL，**快捷視圖（含既有 4 個）本來就不寫入 URL**。此為既有行為，非本次變更造成；不在本次範圍內修正（若要讓快捷視圖可分享，應另開 change）

## 5. 假資料來源

- [x] 5.1 `lib/db/mockRepository.ts`：`switch (filters.view)` 補上 `'duplicate_name'`（維持型別完整、避免 TS 窮盡檢查報錯）

## 6. 文件

- [x] 6.1 `docs/manual/01-學員管理.md`：快捷視圖表格新增「同名學員」一列，說明用途為辨識（非代表重複資料需刪除）

## 7. 驗證

- [x] 7.1 tsc + build 通過
- [x] 7.2 套用「同名學員」→ 只出現體系內有 2 人以上同名者，且同名相鄰顯示
- [x] 7.3 體系內姓名唯一者不出現；姓名空白者不出現
- [x] 7.4 尾端空白（「王小明 」vs「王小明」）視為同名
- [x] 7.5 不跨體系：星光 1 位王小明 + 太陽 1 位王小明 → 兩邊皆不顯示
- [x] 7.6 再點一次可取消；與其他快捷視圖互斥 — 已查證 `toggleQuickView`：`view === view ? null : view`（同一個再點→清除；點別的→取代）。本視圖沿用同一函式未改動，故互斥/取消行為與既有四個一致
- [ ] 7.7 套用後匯出 xlsx → 筆數與畫面一致 — **待人工驗證**（需真實資料庫與瀏覽器，本工具無法執行）。邏輯層已由 3.2 結構性驗證＋純函式測試涵蓋
