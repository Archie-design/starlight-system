## ADDED Requirements

### Requirement: 帳號顯示名稱解析

系統 SHALL 提供一致的「帳號顯示名稱」解析規則，將一個帳號 username 對應到可讀姓名，供登入紀錄、操作稽核、帳號管理、頁面頂端顯示使用。解析優先序為：

1. 若該帳號的 `users.display_name` 非空 → 使用 `display_name`。
2. 否則，若 username 可解析為一個存在的學員 ID（自助註冊者）→ 使用「`students.name`（`ID`）」格式。
3. 否則 → 退回顯示 username 原值。

解析 MUST 在伺服端進行；對多筆紀錄 SHALL 批次解析（不逐筆查資料庫）。

#### Scenario: 有 display_name 優先顯示
- **WHEN** 帳號 `starlightsystem@gmail.com` 的 display_name 為「星光管理員」
- **THEN** 顯示「星光管理員」，而非信箱

#### Scenario: 自助註冊者以姓名(ID)顯示
- **WHEN** 帳號 username 為 `12345`、display_name 為空，且學員 12345 姓名為「王小明」
- **THEN** 顯示「王小明（12345）」

#### Scenario: 無對應時退回 username
- **WHEN** 帳號 username 為某信箱、display_name 為空、且該 username 非學員 ID
- **THEN** 顯示該 username 原值（不報錯、不顯示空白）

#### Scenario: 批次解析
- **WHEN** 登入紀錄一次載入多筆不同帳號
- **THEN** 系統以最多常數次查詢批次帶出姓名，逐筆附上解析後顯示名稱

### Requirement: 顯示名稱套用範圍

登入紀錄 / 操作稽核（`/admin/login-logs`）、帳號管理列表（`/admin/users`）、以及各受保護頁面頂端的登入者標示，SHALL 顯示解析後的姓名；當解析退回 username 時，顯示 username 本身。原始 username 仍 SHALL 可用於搜尋與辨識。

#### Scenario: 登入紀錄顯示姓名
- **WHEN** 管理者開啟登入紀錄
- **THEN** 「帳號 / 操作者」欄顯示解析後姓名（無姓名者顯示 username）

#### Scenario: 帳號管理列表顯示姓名
- **WHEN** 管理者開啟帳號管理
- **THEN** 帳號欄顯示解析後姓名，並仍能辨識該帳號

#### Scenario: 頂端顯示登入者姓名
- **WHEN** 使用者登入後瀏覽任一受保護頁面
- **THEN** 頁面頂端顯示其解析後姓名（無姓名者顯示 username）
