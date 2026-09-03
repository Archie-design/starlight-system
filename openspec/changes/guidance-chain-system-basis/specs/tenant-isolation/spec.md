## MODIFIED Requirements

### Requirement: 學員名單依有效體系隔離

所有顯示學員資料的頁面（students、counselors、maintenance、dashboard、spirit、little-angel、courses 等）SHALL 僅顯示與登入者「有效體系」相符的學員。「有效體系」定義：`admin` 為其綁定體系；`superadmin` 為其當前選擇的體系。體系判定依 `guidance_chain`（關懷脈/輔導體系）：精確等於「星光」屬星光、精確等於「太陽」屬太陽；其餘所有值（包含 null、海洋、明明、神兵、大行、地球、蛻變、方圓等）**不屬於任何體系**，MUST NOT 顯示於任何頁面，即使該學員的 `business_chain`（業務脈）為「星光」或「太陽」。`admin` MUST NOT 能看見另一體系或不屬於任何體系的任何一筆學員。

#### Scenario: 太陽 admin 檢視學員主表
- **WHEN** 太陽 admin 開啟 `/students`
- **THEN** 列表僅含 `guidance_chain='太陽'` 的學員，筆數只反映太陽

#### Scenario: 星光 admin 檢視學員主表
- **WHEN** 星光 admin 開啟 `/students`
- **THEN** 列表僅含 `guidance_chain='星光'` 的學員，不含 `guidance_chain` 為其他值或 null 的學員

#### Scenario: admin 檢視關懷長專區
- **WHEN** 太陽 admin 開啟 `/counselors`
- **THEN** 依 `group_leader` 查詢的結果額外受 `guidance_chain='太陽'` 限制，不含星光學員或不屬於任何體系的學員

#### Scenario: 資料維護專區依體系篩選
- **WHEN** admin 開啟 `/maintenance`
- **THEN** 各維護類別的結果僅含其體系（依 `guidance_chain` 判定）學員

#### Scenario: 不屬於任何體系的學員完全不顯示
- **WHEN** 某學員的 `guidance_chain` 為 null、或為「星光」「太陽」以外的值（例如「大行」「神兵」「海洋」）
- **THEN** 無論該學員的 `business_chain` 為何，任何角色（含 superadmin 切換至任一體系時）在 students、dashboard、counselors、maintenance、spirit、little-angel、courses 等頁面皆看不到這名學員；該學員的資料仍完整保留在資料庫中，未被刪除或修改

#### Scenario: 業務脈與關懷脈不一致時以關懷脈為準
- **WHEN** 某學員的 `business_chain='大行'` 但 `guidance_chain='星光'`
- **THEN** 該學員顯示於星光體系的所有頁面（視同一般星光學員），不因業務脈為「大行」而被排除

### Requirement: 統計儀表板依體系彙總

`/dashboard` 的所有彙總（總人數、課程漏斗、分組統計、會籍預警、付款分佈）SHALL 僅統計登入者有效體系（依 `guidance_chain` 判定）的學員；不屬於任何體系的學員 MUST NOT 計入任一體系的彙總數字。

#### Scenario: 儀表板總人數
- **WHEN** 太陽 admin 開啟 `/dashboard`
- **THEN** 總人數與各圖表僅計入 `guidance_chain='太陽'` 的學員

### Requirement: 匯入流程不因體系判定結果過濾資料

xlsx 匯入流程（預覽與套用）SHALL 將來源檔案中的每一列學員資料完整寫入資料庫，包含 `business_chain`、`guidance_chain` 及其他所有欄位，MUST NOT 因某學員的 `guidance_chain` 不屬於星光或太陽而跳過寫入或報錯——體系判定僅影響「顯示」，不影響「匯入」。

#### Scenario: 匯入含關懷脈為「大行」的學員
- **WHEN** 匯入的 xlsx 中某列學員的「輔導體系」欄位值為「大行」
- **THEN** 該學員正常寫入資料庫（`guidance_chain='大行'`），匯入不因此列而失敗或被跳過；該學員之後不會顯示在任何體系頁面，但資料已存在資料庫中

### Requirement: 匯入授權依有效體系限制

非 superadmin 使用者匯入資料時，SHALL 僅能匯入/套用其有效體系（依 `guidance_chain` 判定）的學員資料；匯入資料中若含不屬於其有效體系（含「不屬於任何體系」的情形）的學員，系統 MUST 拒絕整批匯入並提示錯誤。

#### Scenario: 太陽 admin 匯入含其他體系資料
- **WHEN** 太陽 admin 上傳的 xlsx 中含 `guidance_chain='星光'` 的學員列
- **THEN** 系統拒絕該次匯入（預覽或套用階段），提示含有非「太陽」體系的資料

#### Scenario: 太陽 admin 匯入含不屬於任何體系的資料
- **WHEN** 太陽 admin 上傳的 xlsx 中含 `guidance_chain='大行'`（或 null）的學員列
- **THEN** 系統拒絕該次匯入，因為該學員不屬於「太陽」體系
