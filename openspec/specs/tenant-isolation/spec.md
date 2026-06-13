# tenant-isolation Specification

## Purpose
TBD - created by archiving change split-starlight-sun-systems. Update Purpose after archive.
## Requirements
### Requirement: 學員名單依有效體系隔離

所有顯示學員資料的頁面（students、counselors、maintenance）SHALL 僅顯示與登入者「有效體系」相符的學員。「有效體系」定義：`admin` 為其綁定體系；`superadmin` 為其當前選擇的體系。體系判定依 `business_chain`：`=== '太陽'` 屬太陽，其餘（null / 星光 / 神兵 / 覺醒）屬星光。`admin` MUST NOT 能看見另一體系的任何一筆學員。

#### Scenario: 太陽 admin 檢視學員主表
- **WHEN** 太陽 admin 開啟 `/students`
- **THEN** 列表僅含 `business_chain='太陽'` 的學員（約 697 人），筆數只反映太陽

#### Scenario: 星光 admin 檢視學員主表
- **WHEN** 星光 admin 開啟 `/students`
- **THEN** 列表僅含 `business_chain` 非「太陽」的學員（含 null 與神兵/覺醒，約 2009 人）

#### Scenario: admin 檢視關懷長專區
- **WHEN** 太陽 admin 開啟 `/counselors`
- **THEN** 依 `group_leader` 查詢的結果額外受 `business_chain='太陽'` 限制，不含星光學員

#### Scenario: 資料維護專區依體系篩選
- **WHEN** admin 開啟 `/maintenance`
- **THEN** 各維護類別的結果僅含其體系學員

### Requirement: 體系 TAB 依角色

學員主表的體系 TAB SHALL 依角色決定行為：`admin` 鎖定為其綁定體系、不可切換；`superadmin` 可在星光 / 太陽之間切換，切換即改變其有效體系。

#### Scenario: admin TAB 鎖定
- **WHEN** 太陽 admin 檢視主表工具列
- **THEN** TAB 顯示「太陽」且無法切換到星光

#### Scenario: superadmin 可切換體系
- **WHEN** superadmin 在工具列點選另一體系
- **THEN** 列表與統計切換為該體系資料

### Requirement: 統計儀表板依體系彙總

`/dashboard` 的所有彙總（總人數、課程漏斗、分組統計、會籍預警、付款分佈）SHALL 僅統計登入者有效體系的學員。

#### Scenario: 儀表板總人數
- **WHEN** 太陽 admin 開啟 `/dashboard`
- **THEN** 總人數與各圖表僅計入 `business_chain='太陽'` 的學員（約 697 人）

### Requirement: API 以 server session 身分為準防止越權

組織圖（`/api/org`）與匯出（`/api/export`）等 API SHALL 以 server 端 session 的身分決定有效體系，MUST NOT 信任 client 傳入的 `system` 查詢參數來放寬範圍。`admin` 帳號發出指定他體系的請求 MUST 仍只取得自身體系資料。`superadmin` 可指定體系（須為其權限內的星光/太陽）。

#### Scenario: admin 越權嘗試讀取他體系組織圖
- **WHEN** 太陽 admin 發出 `GET /api/org?system=星光`
- **THEN** API 忽略該參數，僅回傳太陽體系資料

#### Scenario: admin 越權嘗試匯出他體系
- **WHEN** 太陽 admin 發出 `GET /api/export?system=星光`
- **THEN** 匯出檔僅含太陽體系學員

#### Scenario: superadmin 指定體系匯出
- **WHEN** superadmin 發出 `GET /api/export?system=太陽`
- **THEN** 匯出檔含太陽體系學員（superadmin 有權跨體系）

#### Scenario: 未登入請求
- **WHEN** 無有效 session 的請求呼叫 `/api/org` 或 `/api/export`
- **THEN** API 回應 401，不回傳任何學員資料

