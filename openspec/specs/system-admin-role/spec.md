# system-admin-role Specification

## Purpose
TBD - created by archiving change system-admin-role-audit-expansion. Update Purpose after archive.
## Requirements
### Requirement: system_admin 角色

系統 SHALL 支援 `system_admin` 角色：綁定單一體系（同 admin）、僅檢視自己體系資料，但具備帳號管理與登入紀錄的存取權限。users 表 SHALL 允許 role 為 superadmin / admin / system_admin，其中 admin 與 system_admin MUST 綁定 system、superadmin MUST 不綁定。

#### Scenario: system_admin 看自己體系
- **WHEN** 一位 system_admin（system='太陽'）登入
- **THEN** 僅檢視太陽體系資料，且無體系切換器（不可跨體系）

#### Scenario: system_admin 可進帳號管理
- **WHEN** system_admin 開啟 /admin/users 或 /admin/login-logs
- **THEN** 允許進入（不被導離）

### Requirement: 體系長自助登入建為 system_admin

當自助登入的學員 role 為 體系長 / 體系長共同經營 時，系統 SHALL 建立 `system_admin` 帳號（綁其體系、must_change_password=true）；role 為 關懷長 / 關懷長共同經營 時維持建立 `admin`。

#### Scenario: 體系長自助登入
- **WHEN** 體系長以 ID + 手機末四碼自助登入
- **THEN** 自動建立 system_admin 帳號（綁其體系），導向強制改密碼

#### Scenario: 關懷長維持 admin
- **WHEN** 關懷長以 ID + 手機末四碼自助登入
- **THEN** 仍建立 admin 帳號（行為不變）

### Requirement: 管理權守門

帳號管理與登入紀錄的頁面與 API SHALL 以「可管理」判定（role ∈ superadmin, system_admin），非此二者 MUST 被拒（redirect / 403）。

#### Scenario: admin 仍被擋
- **WHEN** 一般 admin（關懷長）存取 /admin/users
- **THEN** 被導離 / 回 403

### Requirement: system_admin 帳號管理限同體系

system_admin 透過帳號管理 SHALL 僅能檢視與操作**同體系**帳號，MUST NOT 建立 superadmin 或他體系帳號、MUST NOT 管理他體系帳號。superadmin 不受此限。

#### Scenario: 只見同體系帳號
- **WHEN** 太陽 system_admin 開啟帳號管理
- **THEN** 僅列出太陽體系帳號

#### Scenario: 不可建他體系或 superadmin
- **WHEN** 太陽 system_admin 嘗試建立星光 admin 或 superadmin
- **THEN** 被拒（403 / 錯誤）

#### Scenario: 不可管他體系帳號
- **WHEN** 太陽 system_admin 嘗試停用 / 重設一個星光帳號
- **THEN** 被拒

