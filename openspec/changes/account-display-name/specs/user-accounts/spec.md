## MODIFIED Requirements

### Requirement: 使用者帳號資料模型

系統 SHALL 以 `users` 表保存帳號：`id`、`username`（唯一）、`password_hash`（bcrypt）、`role`（`superadmin` | `admin` | `system_admin`）、`system`（`星光` | `太陽` | null）、`display_name`（可空的顯示姓名）、`active`（boolean）、時間戳。`admin` 與 `system_admin` 角色 MUST 綁定一個 `system`；`superadmin` 的 `system` MUST 為 null（代表跨體系）。密碼 MUST NOT 以明文儲存。`display_name` 為選填，若留空則由顯示名稱解析規則退回其他來源。

#### Scenario: admin 必須綁定體系
- **WHEN** 建立 role=admin 但未指定 system 的帳號
- **THEN** 系統拒絕並回報錯誤

#### Scenario: 密碼以雜湊儲存
- **WHEN** 任一帳號被建立或改密碼
- **THEN** `password_hash` 為 bcrypt 雜湊值，資料庫中查無明文密碼

#### Scenario: display_name 可留空
- **WHEN** 建立帳號時未提供 display_name
- **THEN** 帳號成功建立，display_name 為 null，顯示時退回姓名解析規則

### Requirement: superadmin 開設與管理帳號

具管理權者（`superadmin` 或 `system_admin`）SHALL 能新增帳號、停用/啟用帳號、重設他人密碼；`system_admin` 僅限同體系且不可建立 `superadmin`。新增時需指定 username、初始密碼、role、（admin/system_admin 則含）體系，並 MAY 設定 `display_name`。無管理權者呼叫這些 API MUST 回 403。

#### Scenario: superadmin 新增體系管理者
- **WHEN** superadmin 提交 `{ username, password, role: 'admin', system: '太陽' }`
- **THEN** 系統建立該帳號，密碼經雜湊儲存，該帳號可用太陽身分登入

#### Scenario: 新增帳號可設定顯示姓名
- **WHEN** 管理者新增帳號並提供 `display_name: '王小明'`
- **THEN** 該帳號 display_name 存為「王小明」，於登入紀錄與帳號管理顯示此姓名

#### Scenario: 重複 username
- **WHEN** superadmin 新增的 username 已存在
- **THEN** 系統拒絕並回報「帳號已存在」

#### Scenario: 停用帳號
- **WHEN** superadmin 將某帳號設為 `active=false`
- **THEN** 該帳號後續登入一律失敗

#### Scenario: 非管理權者嘗試管理帳號
- **WHEN** role=admin 的使用者呼叫帳號管理 API
- **THEN** 系統回 403，不執行任何變更
