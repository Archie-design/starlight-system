## ADDED Requirements

### Requirement: 分組總表資料來源獨立於學員

系統 SHALL 提供獨立於 `students` 表的分組實體（記錄組名與所屬體系），分組總表 SHALL 依此實體決定顯示哪些組別欄位，而非僅依「目前是否有學員持有該組名」反推。目前無任何組員的組別（空組別）SHALL 仍出現在分組總表中，呈現為一個沒有組員列的空欄位。

#### Scenario: 空組別在重新整理後仍然存在
- **WHEN** 管理者新增一個目前無任何成員的組別，並重新整理頁面
- **THEN** 該組別欄位仍出現在分組總表中，顯示為空欄位（無組員列）

#### Scenario: 既有組別上線後不因新機制而消失
- **WHEN** 系統上線本次變更前，資料庫中已存在若干由學員資料反推得出的分組（例如「星光1」～「星光30」）
- **THEN** 上線後這些組別全部仍出現在分組總表中，顯示內容與上線前一致

### Requirement: 拖曳搬移組員

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色可將分組總表中的任一組員，拖曳到另一個屬於同一有效體系的分組欄位，放開後系統 SHALL 立即將該學員的 `spirit_ambassador_group` 更新為目標分組，無需額外確認步驟即生效。`system_admin` MUST 僅能對其有效體系內的學員與分組執行此操作，跨體系嘗試 MUST 被拒絕。一般 `admin` 角色與非登入者 MUST NOT 能執行此操作。

#### Scenario: 成功將組員拖曳到另一組
- **WHEN** superadmin 或 system_admin 將某組員從「星光3」拖曳並放開到「星光5」欄位
- **THEN** 系統將該學員的 `spirit_ambassador_group` 更新為「星光5」，分組總表重新整理後該學員出現在「星光5」欄位、不再出現在「星光3」

#### Scenario: 一般 admin 無法拖曳搬移組員
- **WHEN** 一般 `admin` 角色嘗試呼叫拖曳搬移對應的更新 API
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

#### Scenario: system_admin 跨體系拖曳被拒絕
- **WHEN** 太陽體系的 system_admin 嘗試透過 API 將一位星光體系學員的分組改為星光體系的某個分組
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

### Requirement: 新增組別

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色在分組總表新增一個目前無任何組員的空組別。新組別的名稱 SHALL 由系統依「星光N」或「太陽N」格式（依操作者的有效體系）自動產生，取該體系目前已存在分組中最大編號加一，MUST NOT 開放使用者自訂組別名稱。一般 `admin` 角色 MUST NOT 能執行此操作。

#### Scenario: 新增組別自動編號
- **WHEN** superadmin 或 system_admin 在星光體系（目前已存在「星光1」～「星光30」）點選新增組別
- **THEN** 系統建立一個名為「星光31」的空組別，並出現在分組總表末端

#### Scenario: 一般 admin 無法新增組別
- **WHEN** 一般 `admin` 角色嘗試呼叫新增組別的 API
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

### Requirement: 刪除組別

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色刪除一個目前沒有任何組員的分組。若該分組仍有至少一位組員，系統 MUST 拒絕刪除。一般 `admin` 角色 MUST NOT 能執行此操作。

#### Scenario: 成功刪除空組別
- **WHEN** superadmin 或 system_admin 對一個目前沒有任何組員的分組執行刪除
- **THEN** 系統刪除該分組，分組總表重新整理後不再顯示該欄位

#### Scenario: 拒絕刪除非空組別
- **WHEN** superadmin 或 system_admin 嘗試刪除一個仍有組員的分組
- **THEN** 系統拒絕該請求，資料庫狀態不變，並提示需先將組員移出該分組

#### Scenario: 一般 admin 無法刪除組別
- **WHEN** 一般 `admin` 角色嘗試呼叫刪除組別的 API
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

### Requirement: 分組總表匯出

系統 SHALL 提供介面，讓可檢視分組總表的使用者將目前分組總表的完整內容（組別、組內排序、組員姓名、小隊長標示、補課狀態標示）匯出為可下載的檔案，供離線比對或更新其他系統使用。匯出內容 SHALL 反映匯出當下畫面顯示的分組與排序結果。

#### Scenario: 匯出完整分組總表
- **WHEN** 使用者在分組總表點選匯出
- **THEN** 系統產生並下載一份檔案，內容涵蓋目前總表所有分組欄位與組員，包含各組員的小隊長與補課狀態標示
