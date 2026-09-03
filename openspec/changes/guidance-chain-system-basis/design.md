## Context

See proposal.md - Why. 目前 `lib/utils/system.ts` 是體系判定的單一事實來源：`systemOf(businessChain)` 回傳 `SheetSystem`（`'星光' | '太陽'`，永遠二選一，無第三態），`applySystemFilter()` 對 `students` 表的 `system_computed`（generated column，`GENERATED ALWAYS AS (CASE WHEN business_chain = '太陽' THEN '太陽' ELSE '星光' END) STORED`，migration 015）做等值查詢。所有透過 repository 層（`lib/db/supabaseRepository.ts`）查詢學員的頁面/API 都經過 `applySystemFilter()`，因此改變 `system_computed` 的計算依據即可讓全站生效，不需要逐頁修改。

`SheetSystem` 型別本身另外被 `getEffectiveSystem()`（決定使用者當前檢視哪個體系）、`SystemSwitcher` 元件、`useCounselorGroups(system?)` 等處使用，語意是「UI 上可選擇的體系，恆二選一」——這與「某學員實際屬於哪個體系（可能都不屬於）」是不同的概念，這次變更不能混淆兩者。

## Goals / Non-Goals

**Goals:**
- 體系判定依據從 `business_chain` 改為 `guidance_chain`，且新增「不屬於任一體系」的第三態。
- 不屬於任一體系的學員在所有查詢路徑上被排除，不需要在每個查詢處額外加條件。
- 匯入流程完整寫入所有資料（不因體系判定結果過濾），只有顯示受影響。
- 匯入授權檢查與顯示邏輯使用同一套判定依據，行為一致。

**Non-Goals:**
- 不改變 `getEffectiveSystem()`／`SheetSystem` 型別本身（仍是二選一，代表「使用者當前選擇檢視哪個體系」）。
- 不新增「大行」「神兵」等作為系統正式支援的第三、第四個體系——proposal 明確排除，這些人只是被排除在星光/太陽的顯示之外，不是新增體系分類。
- 不處理 `business_chain` 本身的顯示/篩選 UI（欄位維持現狀，只是角色退場——不再驅動任何判定邏輯）。
- 不追溯修正歷史 `edit_logs`／`import_logs` 中曾經記錄的 `business_chain` 相關內容。

## Decisions

**1. `systemOf()` 回傳型別改為 `SheetSystem | null`，不複用 `SheetSystem` 本身表示「無體系」。**
`SheetSystem`（`'星光' | '太陽'`）在多處被當作「恆二選一」使用（`getEffectiveSystem()` 的回傳型別、`SystemSwitcher`、`ALL_SYSTEMS` 常量），若把它改成可能包含第三個值（例如新增 `'其他'`）會連帶破壞這些假設二選一的呼叫端；用 `null` 表示「不屬於任何體系」，讓型別系統直接在編譯期強制每個呼叫端處理這個情況（`tsc` 會在忘記處理 `null` 分支時報錯），比新增字串常量更安全。
- 考慮過的替代方案：新增 `type SheetSystemOrNone = SheetSystem | 'none'`。否決——`null` 是 TypeScript/JS 中「無值」更符合語感的表示，且 Supabase 對 generated column 空值本來就回傳 `null`，不需要額外的字串常量轉換。

**2. `systemOf()` 參數改名為 `guidanceChain`（語意隨判定依據調整），簽章維持單一必要參數。**
```ts
export function systemOf(guidanceChain: string | null | undefined): SheetSystem | null {
  if (guidanceChain === '星光') return '星光'
  if (guidanceChain === '太陽') return '太陽'
  return null
}
```
所有呼叫端（`assignGroup.ts`、`littleAngel.ts`、`app/api/login/route.ts`、`app/api/import/route.ts`、`app/api/import/apply/route.ts`）改傳入 `guidance_chain` 欄位值，查詢的 `.select()` 需要新增 `guidance_chain`（若原本只選了 `business_chain`）。

**3. `applySystemFilter()` 本身不需要修改。**
它只是把 `system_computed` 的字面值套用 `.eq()`，計算依據換成 `guidance_chain` 完全在 generated column 的定義裡處理，`applySystemFilter()` 這一層對「依據哪個欄位計算」無感知，維持現狀。

**4. `system_computed` 用新 migration 以 `DROP COLUMN` + 重新 `ADD COLUMN ... GENERATED ALWAYS AS (...) STORED` 的方式重建（而非 `ALTER COLUMN` 改運算式，Postgres 不支援直接修改 generated column 的運算式）。**
```sql
ALTER TABLE students DROP COLUMN IF EXISTS system_computed;
ALTER TABLE students
  ADD COLUMN system_computed TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN guidance_chain = '星光' THEN '星光'
      WHEN guidance_chain = '太陽' THEN '太陽'
      ELSE NULL
    END
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_students_system_computed ON students (system_computed);
CREATE INDEX IF NOT EXISTS idx_students_system_computed_id ON students (system_computed, id);
```
`DROP COLUMN` 會一併移除該欄位既有的索引，故索引語句需要在新增欄位後重新執行（`IF NOT EXISTS` 已存在於既有 migration 語句中，直接沿用）。`NULL` 值不會匹配任何 `.eq('system_computed', '星光'|'太陽')` 查詢，天然排除「不屬於任何體系」的學員，不需要額外的 `IS NOT NULL` 條件或應用層過濾。

**5. 匯入授權檢查（`app/api/import/route.ts`、`app/api/import/apply/route.ts`）與顯示邏輯共用 `systemOf()`，包含「不屬於任何體系」時一律視為越權（拒絕匯入）。**
現有邏輯是 `importRows.some((r) => systemOf(r.business_chain) !== effectiveSystem)` → 改為 `systemOf(r.guidance_chain) !== effectiveSystem`。因為 `systemOf()` 現在可能回傳 `null`，`null !== effectiveSystem`（`effectiveSystem` 恆為 `'星光'|'太陽'`）永遠成立，所以「這批匯入資料裡有任何一列不屬於 admin 有效體系的學員（含不屬於任一體系者）」都會被判定為越權而整批拒絕——這與 tenant-isolation delta spec 的「太陽 admin 匯入含不屬於任何體系的資料」scenario 一致。

**6. 關懷長自助登入（`app/api/login/route.ts`）：本人 `guidance_chain` 不屬於星光/太陽時，視同「非關懷長」情形處理，統一回覆「帳號或密碼錯誤」，不额外洩漏原因。**
與既有「不洩漏失敗原因」的既定規則一致（leader-self-login spec 既有 requirement），只是新增一種會走到失敗分支的情形（`systemOf(student.guidance_chain)` 回傳 `null`）。

## Risks / Trade-offs

- [Risk] `guidance_chain` 資料品質未必如預期（例如同一位學員的欄位在不同批次匯入中被覆寫成不同值，或欄位本身有拼寫變體如全形/半形差異）→ Mitigation：`systemOf()` 用精確字串相等比對（不 trim、不模糊匹配），若匯入資料存在髒資料問題應在匯入階段的資料清理/驗證解決，不在顯示層做寬鬆匹配掩蓋問題；後續若發現大量本應歸屬星光/太陽卻因格式差異被排除的學員，需回頭修正來源資料而非放寬比對邏輯。
- [Risk] 這是一個 **BREAKING** 變更：部署後可見學員總數大幅減少（實測：變更前依 `business_chain` 星光 2084 人＋太陽 758 人＝全數 2842 人皆顯示；變更後依 `guidance_chain` 星光 1017 人＋太陽 423 人，共 1402 人不屬於任何體系、完全消失於所有頁面——降幅接近一半，是這次變更中影響最大的一步）→ Mitigation：資料庫本身不受影響（`guidance_chain`／`business_chain` 皆保留），若判定結果不符預期，可透過確認/修正來源學員的「輔導體系」欄位重新匯入來調整，不需要程式碼層級的回滾；已與使用者確認這是預期行為（見 proposal.md），部署後仍建議立即用 dashboard 總人數與此處數字對照複核。
- [Risk] 忘記把某處直接讀 `business_chain` 做體系判斷的程式碼一併改掉（例如未來新增的 hub 頁面複製舊程式碼模式）→ Mitigation：`systemOf()` 保持唯一的判定入口，程式碼審查與 `grep -rn "business_chain" --include="*.ts*"` 排查所有殘留引用是驗收步驟之一（見 tasks.md）。

## Migration Plan

1. 部署包含新 migration（重建 `system_computed`）與程式碼變更的版本。migration 需要在應用程式碼部署**之前或同時**套用，避免程式碼已預期新語意但資料庫仍是舊計算依據的中間態（本專案 migration 為手動於 Supabase SQL Editor 執行，非自動化部署管線，需在部署程式碼前手動執行）。
2. 因為是 generated column 重建（非簡單新增），既有資料在 migration 執行當下會即時重新計算，不需要額外的資料回填腳本。
3. 回滾策略：若需要回滾，重新執行一次 migration（運算式換回 `business_chain` 版本）並回滾程式碼版本即可；`guidance_chain`／`business_chain` 兩欄位在整個變更過程中都不會被刪除或覆寫，回滾不會造成資料遺失。
