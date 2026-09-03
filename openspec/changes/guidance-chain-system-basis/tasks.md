## 1. 資料庫

- [x] 1.1 建立新 migration（例如 `019_guidance_chain_system_basis.sql`）：`DROP COLUMN IF EXISTS system_computed` 後重新 `ADD COLUMN system_computed TEXT GENERATED ALWAYS AS (CASE WHEN guidance_chain = '星光' THEN '星光' WHEN guidance_chain = '太陽' THEN '太陽' ELSE NULL END) STORED`，並重建 `idx_students_system_computed`、`idx_students_system_computed_id` 兩個索引；於 Supabase SQL Editor 執行後，用 `SELECT system_computed, count(*) FROM students GROUP BY 1` 驗證結果與本次盤點的實測數字一致（星光 1017、太陽 423、NULL 1402）——**檔案已建立於 `supabase/migrations/019_guidance_chain_system_basis.sql`，待使用者於 Supabase SQL Editor 手動執行並回報驗證結果**

## 2. 核心判定邏輯

- [x] 2.1 修改 `lib/utils/system.ts`：`systemOf()` 參數改名為 `guidanceChain`、回傳型別改為 `SheetSystem | null`（精確等於「星光」/「太陽」才回傳對應值，其餘含 null 回傳 `null`），更新函式頂部註解說明判定依據已從 `business_chain` 改為 `guidance_chain`；`applySystemFilter()`、`studentIdsAllInSystem()` 維持不動（`studentIdsAllInSystem()` 內部 `.select('id, business_chain')` 改為 `.select('id, guidance_chain')`，`systemOf(s.business_chain)` 改為 `systemOf(s.guidance_chain)`）
- [x] 2.2 執行 `npx tsc --noEmit`，確認 `systemOf()` 回傳型別改變後，所有呼叫端都出現預期的型別錯誤（下一步逐一修正），藉此完整列出需要處理的呼叫點清單，不遺漏

## 3. 修正直接呼叫 systemOf() 的呼叫端

- [x] 3.1 `lib/import/assignGroup.ts`：`StudentEntry` 介面的 `business_chain?` 欄位改為 `guidance_chain?`（含欄位註解更新），`systemOf(root.business_chain)`、`systemOf(entry.business_chain)` 改為讀 `guidance_chain`——額外發現：`groupSystem` 型別改為 `Map<string, SheetSystem>`，`systemOf(root.guidance_chain) ?? '星光'`（根節點不屬於任何體系時預設星光，與 counselor-groups API 一致，經使用者確認）
- [x] 3.2 找出 `buildGroupAssignments()` 的呼叫端（`app/api/counselor-groups/backfill/route.ts` 等），確認建構 `studentMap`/`StudentEntry` 時查詢的欄位與傳入值同步從 `business_chain` 改為 `guidance_chain`
- [x] 3.3 `lib/utils/littleAngel.ts`：`MinimalCrossSystemLookup`、`findDanglingAndCrossSystemPointers()` 型別簽章中的 `business_chain?` 欄位改為 `guidance_chain?`，找出其呼叫端（`app/little-angel/page.tsx` 等）同步更新查詢欄位與傳入值——`targetSystem` 型別改為 `string | null`，`page.tsx` 端 fallback 為「未知」供顯示
- [x] 3.4 `app/api/login/route.ts`：`.select('id, name, role, phone, business_chain')` 改為選取 `guidance_chain`（可視情況保留 `business_chain` 於 select 中，但 `systemOf()` 呼叫改用 `guidance_chain`），`systemOf(student.business_chain)` 改為 `systemOf(student.guidance_chain)`；`systemOf()` 回傳 `null` 時視同「非關懷長」情形處理（自助登入失敗，不建立帳號，回應與既有失敗情形一致的錯誤訊息）
- [x] 3.8（規劃階段遺漏，實作時全域排查發現後補上，經使用者確認修復範圍）修正另外 4 個實質使用 `systemOf(business_chain)` 的檔案：`app/api/edit-logs/route.ts`（編輯紀錄依體系分類）、`app/api/history/route.ts`、`app/api/history/[id]/route.ts`（匯入歷史依體系篩選）、`app/api/last-import/route.ts`（最近匯入狀態判斷，2處，含 JSONB path 運算子 `->0->>business_chain` 需同步改為 `->0->>guidance_chain`）；以及未接線但為保持一致性同步修正的 `lib/db/mockRepository.ts`（5處）
- [x] 3.5 `app/api/import/route.ts`：`systemOf(r.business_chain)` 改為 `systemOf(r.guidance_chain)`
- [x] 3.6 `app/api/import/apply/route.ts`：`systemOf(r.business_chain)` 改為 `systemOf(r.guidance_chain)`；確認第 108-116 行左右建構 `studentMap`（`{ id, counselor, introducer, business_chain }`）的型別與內容是否也需要改用 `guidance_chain`（視其用途是否涉及體系判定而定，若僅供 `assignGroup.ts` 使用則需同步 3.1 的欄位改名）——確認需要，已同步改名
- [x] 3.7 執行 `npx tsc --noEmit`，確認零錯誤（所有因 2.1 型別改變而產生的錯誤皆已修正）

## 4. 匯入流程完整性確認（不因體系篩選資料）

- [x] 4.1 檢查 `lib/import/transform.ts`、`lib/import/diff.ts`、`lib/import/parseXlsx.ts`：確認 `guidance_chain` 欄位的解析、diff 比對、寫入邏輯本身完全不受這次變更影響（本次不新增/修改任何匯入欄位，`guidance_chain` 早已存在於既有欄位清單中），僅確認沒有任何地方誤用 `systemOf()` 的結果去跳過某列資料的寫入——確認無誤，無需修改
- [x] 4.2 用真實樣本檔案（或既有測試資料）模擬一次完整匯入流程（預覽 + 套用），確認 `guidance_chain` 不屬於星光/太陽的學員列正常寫入資料庫（`guidance_chain` 值正確保存），且不會被跳過或報錯——用 `reference/學員資料庫 20260826 (1).xlsx` 模擬解析：2096 筆來源列，2096 筆解析成功（0 筆被跳過），674 筆 `guidance_chain` 不屬於星光/太陽者皆正常解析保留

## 5. 驗證

- [x] 5.1 執行 `npx tsc --noEmit` 與 `npm run build`，確認零錯誤
- [x] 5.2 對照真實資料庫驗證：`system_computed` 欄位的星光/太陽/NULL 分布與本次盤點的實測數字一致（星光 1017、太陽 423、NULL 1402）——**migration 已執行，實測結果星光1017/太陽423/NULL1402，與盤點數字完全吻合，0筆計算不一致；額外驗證511名「業務脈=大行/關懷脈=星光」樣本全數正確歸類星光**
- [x] 5.3 驗證顯示層：分別以星光 admin、太陽 admin 身分（或模擬對應查詢）確認 `/students`、`/dashboard`、`/counselors`、`/maintenance` 回傳的學員數與 `system_computed` 分布一致，且找不到任何 `guidance_chain` 不屬於該體系的學員——**模擬 `.eq('system_computed', system)` 查詢，星光1017人/太陽423人皆零混入，合計1440人與非任何體系1402人互補（=2842）**
- [x] 5.4 驗證關懷長分組（`buildGroupAssignments()`）：抽樣確認分組結果依 `guidance_chain` 判定，而非 `business_chain`——找一名 `business_chain='大行'` 但 `guidance_chain='星光'` 的學員，確認其被正確分組於星光體系的關懷長分組中——**對真實資料重放分組演算法，確認「因跨體系隔離被擋下」人數精確等於1402（不屬於任何體系者），11個既有分組中4個根節點business_chain為大行/神兵、guidance_chain為星光，正確判定為星光分組**
- [x] 5.5 驗證小天使跨體系偵測（`findDanglingAndCrossSystemPointers()`）：確認判定依據已改用 `guidance_chain`——**對真實資料重放邏輯，找到1筆太陽學員的跨體系指標案例（謝涵霏→何雅筠，guidance_chain=星光），正確判定targetSystem=星光而非誤判為懸空指標**
- [x] 5.6 驗證匯入授權：模擬（或實測）太陽 admin 上傳含 `guidance_chain='星光'` 學員列的 xlsx，確認整批匯入被拒絕；模擬含 `guidance_chain` 不屬於任何體系（例如「大行」或 null）的學員列，確認同樣被拒絕——**純函式邏輯模擬4種情境（含星光列/含大行列/含null列/全太陽），前三者正確判定offSystem=true（拒絕），最後一者正確判定false（放行）**
- [x] 5.7 驗證關懷長自助登入：抽樣一名 `guidance_chain` 不屬於星光/太陽的關懷長以上角色學員，確認其無法自助登入建立帳號（回應與既有失敗情形一致的錯誤訊息）——**對真實資料查詢確認存在5名符合此邊界情況的真實學員（例如李嘉容，關懷長，guidance_chain=明明），邏輯層級驗證 `systemOf()` 回傳null會正確觸發fail()；對照組10名guidance_chain屬於星光/太陽者不受影響。未對正式環境發起實際登入請求（避免寫入副作用），端對端瀏覽器測試留給使用者**
- [x] 5.8 全域排查殘留引用：執行 `grep -rn "business_chain" --include="*.ts" --include="*.tsx"` 確認所有剩餘引用皆為「純顯示欄位」用途（學員資料卡、匯入/匯出欄位映射、`COMPARABLE_FIELDS` 等），不再有任何體系判定/篩選/授權邏輯依賴它——**過程中發現規劃階段遺漏的 8 處（見 3.8），已全部修正並確認零殘留**
- [x] 5.9 更新 `openspec/specs/tenant-isolation/spec.md`、`openspec/specs/leader-self-login/spec.md`（於封存時自動套用 delta，此處僅確認 delta 內容與最終實作一致，若實作過程中有偏差需回頭更新 delta spec）——**複核 delta spec 全部 scenario，與最終實作及本次驗證結果完全一致，無需修改**
