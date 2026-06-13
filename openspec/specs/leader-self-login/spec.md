# leader-self-login Specification

## Purpose
TBD - created by archiving change leader-self-login-audit. Update Purpose after archive.
## Requirements
### Requirement: 關懷長以上自助首次登入

系統 SHALL 允許「關懷長以上」的學員以其學員 ID 為帳號、手機末四碼為預設密碼，自助首次登入。自助條件：輸入的帳號對應一位 `role` 為關懷長 / 關懷長共同經營 / 體系長 / 體系長共同經營 的學員，且其手機末四碼（去除非數字後尾 4 碼）與輸入密碼相符。

#### Scenario: 關懷長首次自助登入
- **WHEN** 一位關懷長以上學員以其 ID 與手機末四碼登入，且 users 表尚無此帳號
- **THEN** 系統自動建立帳號（role=admin、綁定其體系、must_change_password=true），登入成功並導向強制改密碼頁

#### Scenario: 非關懷長無法自助
- **WHEN** 一個學員 ID 對應的 role 非關懷長以上
- **THEN** 自助登入失敗，不建立帳號，回應「帳號或密碼錯誤」

#### Scenario: 手機末四碼不符
- **WHEN** 關懷長以上學員輸入的密碼不等於其手機末四碼
- **THEN** 自助登入失敗，不建立帳號

#### Scenario: 不洩漏失敗原因
- **WHEN** 自助登入因任一條件失敗
- **THEN** 回應一致的錯誤訊息（不區分帳號不存在 / 非關懷長 / 末四碼錯誤）

### Requirement: 自助帳號的權限與體系

自助建立的帳號 SHALL 為 `admin` 角色、綁定該學員所屬體系（依 `business_chain` 判定），登入後可檢視整個該體系資料，且 MUST NOT 能進入帳號管理（/admin/users）。

#### Scenario: 體系綁定正確
- **WHEN** 一位 `business_chain='太陽'` 的關懷長自助登入
- **THEN** 其帳號 system 為「太陽」，登入後僅見太陽體系資料

#### Scenario: 不能管理帳號
- **WHEN** 關懷長 admin 嘗試進入 /admin/users
- **THEN** 被導離 / 回應 403（僅 superadmin 可進）

### Requirement: 首次登入強制改密碼

自助建立的帳號 SHALL `must_change_password=true`，首次登入後 MUST 先改密碼才能正常使用，沿用既有強制改密碼機制。

#### Scenario: 首次強制改密碼
- **WHEN** 關懷長自助登入後
- **THEN** 被導向改密碼頁，完成後旗標清除、恢復正常使用

