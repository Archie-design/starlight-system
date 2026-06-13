## ADDED Requirements

### Requirement: 使用者帳號資料模型

系統 SHALL 以 `users` 表保存帳號：`id`、`username`（唯一）、`password_hash`（bcrypt）、`role`（`superadmin` | `admin`）、`system`（`星光` | `太陽` | null）、`active`（boolean）、時間戳。`admin` 角色 MUST 綁定一個 `system`；`superadmin` 的 `system` MUST 為 null（代表跨體系）。密碼 MUST NOT 以明文儲存。

#### Scenario: admin 必須綁定體系
- **WHEN** 建立 role=admin 但未指定 system 的帳號
- **THEN** 系統拒絕並回報錯誤

#### Scenario: 密碼以雜湊儲存
- **WHEN** 任一帳號被建立或改密碼
- **THEN** `password_hash` 為 bcrypt 雜湊值，資料庫中查無明文密碼

### Requirement: superadmin 開設與管理帳號

只有 `superadmin` SHALL 能新增帳號、停用/啟用帳號、重設他人密碼。新增時需指定 username、初始密碼、role、（admin 則含）體系。非 superadmin 呼叫這些 API MUST 回 403。

#### Scenario: superadmin 新增體系管理者
- **WHEN** superadmin 提交 `{ username, password, role: 'admin', system: '太陽' }`
- **THEN** 系統建立該帳號，密碼經雜湊儲存，該帳號可用太陽身分登入

#### Scenario: 重複 username
- **WHEN** superadmin 新增的 username 已存在
- **THEN** 系統拒絕並回報「帳號已存在」

#### Scenario: 停用帳號
- **WHEN** superadmin 將某帳號設為 `active=false`
- **THEN** 該帳號後續登入一律失敗

#### Scenario: 非 superadmin 嘗試管理帳號
- **WHEN** role=admin 的使用者呼叫帳號管理 API
- **THEN** 系統回 403，不執行任何變更

### Requirement: 使用者自行修改密碼

任何登入中的使用者 SHALL 能修改自己的密碼，且 MUST 先驗證舊密碼。新密碼經雜湊後更新。

#### Scenario: 成功改密碼
- **WHEN** 使用者提供正確舊密碼與新密碼
- **THEN** 系統更新雜湊，下次登入須用新密碼

#### Scenario: 舊密碼錯誤
- **WHEN** 使用者提供的舊密碼不符
- **THEN** 系統拒絕更新並回報錯誤

### Requirement: 種子系統管理者

部署時系統 SHALL 透過 migration 建立初始 `superadmin` 帳號，username 為 `starlightsystem@gmail.com`，初始密碼經 bcrypt 雜湊儲存，且 `must_change_password=true`。

#### Scenario: 初始 superadmin 可登入
- **WHEN** 套用帳號 migration 後以 `starlightsystem@gmail.com` 與初始密碼登入
- **THEN** 登入成功

### Requirement: 首次登入強制改密碼

帳號 SHALL 具備 `must_change_password` 旗標。當帶此旗標的使用者登入後，系統 MUST 在進入任何資料頁前要求其修改密碼；改密碼成功後該旗標清除。superadmin 新開的帳號 SHOULD 預設帶此旗標，使初始密碼僅為一次性。

#### Scenario: 強制改密碼導向
- **WHEN** `must_change_password=true` 的使用者登入並嘗試開啟任何受保護頁
- **THEN** 系統導向改密碼流程，完成前不顯示學員資料

#### Scenario: 改密碼後清除旗標
- **WHEN** 該使用者成功修改密碼
- **THEN** `must_change_password` 設為 false，之後正常使用
