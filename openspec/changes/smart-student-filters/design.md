## Context

學員表格的篩選走 `useStudentStore.filters` → `useStudents` → `repository.findBySystem(system, filters, range)` → Supabase query。現有 `applyCommonFilters` 只處理單欄位 `ilike`/`eq`。新需求含兩類條件：

- **單欄位可直接表達**：課程進度、會籍狀態、心之使者、新生 —— 可用 `.eq`/`.is`/`.gte`/`.lte`。
- **跨欄位衍生條件**：續報（`course_N` 有 AND `course_{N+1}` 空）、欠款（`payment` 為數字 AND `course` 非待確認）—— Supabase 的 PostgREST 不易用單一 query 表達「OR 多組 AND」與「欄位值是否為數字」。

探索已確認的資料語意（重要前提）：
- 付款欄填**純數字 = 還欠金額**（未完款）；「完款」字樣 = 已繳清
- 課程欄「待確認梯次」= 已報名未排課；具體梯次 = 已上課
- 體系依 `business_chain`（太陽 vs 非太陽），已有 `applySystemFilter`

## Goals / Non-Goals

**Goals:**
- 基礎維度篩選（課程進度 / 會籍 / 心之使者 / 新生）
- 跨欄位情境快捷視圖（續報 / 欠款 / 會籍 / 新生），一鍵套用、可取消
- 篩選結果可匯出，維持體系隔離
- 篩選判定邏輯集中、可重用、與 dashboard 的付款判定一致

**Non-Goals:**
- 不做使用者自訂/儲存任意篩選組合（只提供預定義快捷視圖）
- 不改 DB schema、不新增欄位
- 不在本提案處理 dashboard（雖然欠款判定共用，但 dashboard 改動另議）

## Decisions

### D1. 篩選執行位置：能下推就下推，跨欄位則 server 端後處理
- **單欄位條件**（課程進度、會籍、心之使者、新生）→ 在 Supabase query 下推（`applyCommonFilters` 擴充），維持分頁與 count 正確。
- **跨欄位衍生條件**（續報、欠款）→ PostgREST 難表達且需判斷「是否為數字」。採在 **server 端（repository）拉取體系全量後以 JS 過濾**。
  - 學員量小（單體系 ≤ ~2000），全量載入可接受（dashboard 已是此模式）。
  - 過濾後再做分頁/count，確保畫面與筆數一致。
- 為什麼不全部 server 端後處理：單欄位下推能省流量、且大多數情況用單欄位；只有快捷視圖才需全量。

### D2. 判定邏輯集中於 `lib/utils/studentStatus.ts`
共用純函式，給 repository 與（未來）dashboard 重用：
```
highestStage(student): 0..5            // 最高完成階
membershipStatus(expiry, now): 'expired'|'in30'|'in90'|'valid'|'none'
isResubscribeCandidate(student): bool  // 上完N階未上N+1階
owesPayment(student): bool             // 已排梯次但 payment 為數字
isNewbie(student, now): bool           // created_at 近30天
```
- 欠款判定沿用探索結論：`payment` 為 `/^\d+(\.\d+)?$/` 且對應 `course` 非空且非「待確認梯次」。

### D3. Store 與 UI 模型
`StudentFilters` 擴充：
- `courseStage?: 0|1|2|3|4|5 | ''`（基礎）
- `membershipStatus?: 'expired'|'in30'|'in90'|'valid'|'none' | ''`
- `isSpirit?: boolean`、`isNewbie?: boolean`
- `view?: 'resubscribe'|'owing'|'expiring'|'newbie' | null`（快捷視圖，與基礎篩選可疊加或互斥——見 D4）
UI：FilterBar 增兩個下拉（課程進度/會籍）+ 一排快捷視圖按鈕（高亮 active）。

### D4. 快捷視圖與基礎篩選的關係
快捷視圖是「預設好的條件組合」。採**疊加**：套用視圖後仍可再用姓名/關懷員等縮小範圍。視圖之間互斥（一次一個 active），避免語意衝突。取消視圖＝清除 `view`。

### D5. 匯出
`/api/export` 已支援 name/counselor/region 參數，擴充為接受完整篩選集合（含 view）。匯出時 server 重跑同一套 `studentStatus` 過濾，確保「匯出 = 畫面所見」。體系仍以 session 為準（已實作）。

## Risks / Trade-offs

- [跨欄位視圖走全量過濾，count/分頁需自行處理] → repository 對這類 view 改為「取全量→JS 過濾→slice 分頁」，回傳正確 total。資料量小，效能可接受。
- [欄位語意若日後改變（如付款改存「已繳」）] → 判定集中在 `studentStatus.ts`，改一處即可。
- [快捷視圖與既有單欄位篩選的 SWR cache key] → key 需納入新 filter 欄位與 view，沿用現有 key 陣列模式。
- [匯出大名單] → 既有匯出已處理；新條件只是多一層過濾。

## Open Questions

- 「課程進度」與「續報潛力」語意接近，UI 上是否會讓使用者混淆？（基礎篩選=靜態看某階；快捷=跨階衍生。文案需區隔）
- 快捷視圖是否需要顯示「命中筆數」徽章（如 續報潛力 ⟨872⟩）？利於使用者決策，但需先算 count。預設先不做，列為加值。
- 是否要把「待催欠款」的欠款金額一併顯示/排序？（與 dashboard 應收帳款提案可能整合）
