## ADDED Requirements

### Requirement: 敏感操作稽核

系統 SHALL 將下列敏感操作記錄至 `admin_audit`（含操作者帳號、動作、對象、細節、IP、user-agent、時間），寫入 MUST 為 fire-and-forget 不阻塞：
- 帳號管理：新增帳號、停用 / 啟用帳號、重設密碼
- 資料匯出
- 匯入套用

#### Scenario: 記錄帳號新增
- **WHEN** 管理者新增一個帳號
- **THEN** admin_audit 新增一筆（actor=操作者、action=user_created、target=新帳號）

#### Scenario: 記錄資料匯出
- **WHEN** 使用者匯出學員名單
- **THEN** admin_audit 新增一筆（action=data_export，detail 含體系與筆數）

#### Scenario: 記錄匯入套用
- **WHEN** 套用匯入變更
- **THEN** admin_audit 新增一筆（action=import_applied，detail 含套用 / 錯誤數）

### Requirement: 稽核資料保護

`admin_audit` SHALL 僅 service_role 可存取，anon MUST NOT 可讀。

#### Scenario: anon 不可讀
- **WHEN** 以 anon 查詢 admin_audit
- **THEN** 無法取得資料

### Requirement: 修正學員編輯操作者紀錄

學員儲存格編輯寫入 `edit_logs` 時，`changed_by` SHALL 為當前登入者帳號（取自 server 驗證的 session），MUST NOT 因認證來源錯誤而為 null。

#### Scenario: 編輯記錄操作者
- **WHEN** 登入者編輯某學員欄位
- **THEN** edit_logs.changed_by 為該登入者帳號

### Requirement: 管理者查看稽核

具管理權者（superadmin / system_admin）SHALL 能在登入紀錄頁查看 admin_audit 內容（時間 / 操作者 / 動作 / 對象 / IP）。

#### Scenario: 查看稽核
- **WHEN** 管理者於登入紀錄頁切換至「操作稽核」來源
- **THEN** 顯示 admin_audit 事件，最新在前
