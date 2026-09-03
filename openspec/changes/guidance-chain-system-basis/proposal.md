## Why

體系判定目前依 `business_chain`（業務脈）：`=== '太陽'` 屬太陽，其餘（null / 星光 / 神兵 / 覺醒）一律歸入星光。但業務脈近期新增了「大行」體系（實測 511 人，佔比最大），依現行規則會被錯誤歸入星光顯示，與實際關懷歸屬不符。而實際上「哪個人需要被星光或太陽的關懷體系管理」是由另一個獨立欄位 `guidance_chain`（關懷脈/輔導體系）決定的——業務脈與關懷脈實測常常不一致（例如 511 人業務脈是「大行」但關懷脈是「星光」；99 人業務脈是「太陽」但關懷脈是「大行」），繼續用業務脈判定體系會讓關懷人員看到不該由他們管理的人、或看不到該由他們管理的人。

## What Changes

- **BREAKING**：體系判定基準從 `business_chain`（業務脈）改為 `guidance_chain`（關懷脈/輔導體系）。`systemOf()` 改為：`guidance_chain` 精確等於「星光」才屬星光、精確等於「太陽」才屬太陽，其餘所有值（海洋、明明、神兵、大行、地球、蛻變、方圓、null，實測共 1163 人）**皆不屬於任何體系**。
- **BREAKING**：不屬於任何體系的學員，在所有透過 `applySystemFilter` 查詢的頁面（students、dashboard、counselors、maintenance、spirit、little-angel、courses 等）**完全不顯示**（既不算入星光、也不算入太陽），任何角色都看不到。資料本身仍完整保留在資料庫中，未來若補上 `guidance_chain` 仍可依規則正常顯示。
- 匯入流程（`app/api/import`、`app/api/import/apply`）**不因 `guidance_chain` 不屬於星光/太陽而拒絕匯入或跳過該筆資料**——xlsx 裡的所有列都正常寫入資料庫（含 `business_chain`、`guidance_chain` 等全部欄位），只有「顯示」這一關會篩掉不屬於任一體系的人。
- 匯入授權檢查（admin 只能匯入自己體系的資料）比照顯示邏輯，同步改用 `guidance_chain` 判定，確保「誰能匯入什麼」與「誰能看到什麼」用同一套規則，不會出現匯入允許但顯示又篩掉的不一致情形。
- `business_chain`（業務脈）本身完全不受影響——仍正常匯入、匯出、顯示於學員資料卡，但不再用於體系篩選、分組歸屬、匯入授權等任何判定邏輯。
- `system_computed`（generated column，migration 015）改依 `guidance_chain` 重新計算；不屬於任何體系的學員此欄位值為 `NULL`，讓既有的 `.eq('system_computed', system)` 索引查詢天然排除他們，不需額外的 `IS NOT NULL` 判斷、也不影響既有索引效能。
- 關懷長分組（`buildGroupAssignments()`）與小天使跨體系偵測（`findDanglingAndCrossSystemPointers()`）改依 `guidance_chain` 判定學員所屬體系，與顯示/匯入邏輯保持一致。

## Capabilities

### Modified Capabilities
- `tenant-isolation`：體系判定依據從 `business_chain` 改為 `guidance_chain`，且新增「不屬於任一體系則完全不顯示」的規則（原規則是「非太陽即星光」，沒有第三態）。
- `leader-self-login`：關懷長自助建立帳號時的體系綁定判定，同步從 `business_chain` 改為 `guidance_chain`。

## Impact

- **核心判定邏輯**：`lib/utils/system.ts`（`systemOf()` 參數與回傳型別、`applySystemFilter()` 沿用不變、`studentIdsAllInSystem()`）。
- **資料庫**：新 migration 重建 `system_computed` generated column，計算依據從 `business_chain` 改為 `guidance_chain`；不屬於星光/太陽者為 `NULL`。
- **直接依賴 `systemOf()` 的呼叫端**（改傳入 `guidance_chain` 而非 `business_chain`）：`lib/import/assignGroup.ts`（`buildGroupAssignments()`）、`lib/utils/littleAngel.ts`（`findDanglingAndCrossSystemPointers()`）、`app/api/import/route.ts`、`app/api/import/apply/route.ts`（匯入授權檢查）。
- **關懷長自助登入**：`app/api/login/route.ts` 建立帳號時判定 `system` 綁定的 `systemOf(student.business_chain)` 呼叫改為 `systemOf(student.guidance_chain)`，`.select()` 查詢欄位同步從 `business_chain` 改為（或新增）`guidance_chain`。
- **不需逐頁修改**：所有透過 `applySystemFilter()` 查詢的頁面/API（students、dashboard、counselors、maintenance、spirit、little-angel、courses、org、export 等）僅依賴 `system_computed` 這個單一計算欄位，migration 更新後自動生效。
- **不受影響**：`business_chain` 欄位本身的匯入、匯出、學員資料卡顯示；`getEffectiveSystem()`（決定使用者當前檢視哪個體系，星光/太陽二選一，與「學員是否屬於任一體系」是不同層面的判定，不需修改）。
