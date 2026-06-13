## ADDED Requirements

### Requirement: 登入稽核紀錄

系統 SHALL 記錄認證相關事件至 `login_logs`：成功登入（`login_success`）、失敗登入（`login_failure`）、改密碼（`password_change`）。每筆含帳號、IP、user-agent、時間。寫入 MUST 為 fire-and-forget，不阻塞登入回應。

#### Scenario: 記錄成功登入
- **WHEN** 任一帳號登入成功（含關懷長自助登入）
- **THEN** 新增一筆 `login_success`，含其帳號、IP、user-agent、時間

#### Scenario: 記錄失敗登入
- **WHEN** 登入失敗（密碼錯誤 / 帳號不存在 / 自助條件不符）
- **THEN** 新增一筆 `login_failure`，username 記錄輸入值

#### Scenario: 記錄改密碼
- **WHEN** 使用者成功修改密碼
- **THEN** 新增一筆 `password_change`

### Requirement: 稽核資料保護

`login_logs` SHALL 僅 service_role 可存取（含 IP 為敏感資料），anon MUST NOT 可讀。

#### Scenario: anon 不可讀
- **WHEN** 以 anon 角色查詢 login_logs
- **THEN** 無法取得資料

### Requirement: superadmin 查看登入紀錄

系統 SHALL 提供 superadmin 專屬的「登入紀錄」頁與 API，顯示稽核事件（時間、帳號、事件、IP、user-agent），可搜尋、依時間新到舊排序。非 superadmin MUST 無法存取。

#### Scenario: superadmin 查看
- **WHEN** superadmin 開啟登入紀錄頁
- **THEN** 顯示稽核事件列表，最新在前

#### Scenario: 非 superadmin 被擋
- **WHEN** admin（含關懷長）存取登入紀錄頁或 API
- **THEN** 被導離 / 回應 403
