# account-login Specification

## Purpose
TBD - created by archiving change split-starlight-sun-systems. Update Purpose after archive.
## Requirements
### Requirement: 帳號密碼登入

系統 SHALL 以 username + 密碼登入，比對 `users` 表中該帳號的 bcrypt `password_hash`。帳號不存在、密碼不符、或 `active=false` 時 MUST 回 401 且不建立 session。

#### Scenario: 成功登入
- **WHEN** 使用者輸入存在且 active 的帳號與正確密碼
- **THEN** 系統建立 session 並重導向至 `/students`

#### Scenario: 密碼錯誤
- **WHEN** 密碼與該帳號雜湊不符
- **THEN** 回 401「帳號或密碼錯誤」，不建立 session

#### Scenario: 停用帳號登入
- **WHEN** 帳號存在但 `active=false`
- **THEN** 回 401，不建立 session

### Requirement: session 承載使用者身分

登入成功後 session SHALL 承載使用者身分（id、role、system），其有效期維持 30 分鐘且為 httpOnly。`checkAuth()` SHALL 於驗證成功時回傳 `{ valid: true, user: { id, username, role, system } }`，並 MUST 重新確認該帳號仍存在且 active（避免停用後舊 session 仍有效）。

#### Scenario: checkAuth 回傳使用者
- **WHEN** 帶有效 session 的請求呼叫 `checkAuth()`
- **THEN** 回傳該使用者的 id / role / system

#### Scenario: 停用後既有 session 失效
- **WHEN** 帳號在 session 有效期內被停用，之後該 session 發出請求
- **THEN** `checkAuth()` 回傳 `{ valid: false }`

#### Scenario: session 過期
- **WHEN** session 時間戳超過 30 分鐘
- **THEN** 系統清除所有 session cookie 並回 `{ valid: false }`

### Requirement: 登出清除所有 session cookie

登出時系統 SHALL 清除全部 session 相關 cookie（`sl_session`、`sl_session_ts`、使用者身分相關 cookie、`csrf_token`）。

#### Scenario: 登出
- **WHEN** 使用者呼叫登出 API
- **THEN** 所有 session cookie 被刪除，後續請求 `checkAuth()` 回 `{ valid: false }`

