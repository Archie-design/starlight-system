## MODIFIED Requirements

### Requirement: 自助帳號的權限與體系

自助建立的帳號 SHALL 為 `admin` 角色、綁定該學員所屬體系（依 `guidance_chain` 判定：精確等於「星光」或「太陽」），登入後可檢視整個該體系資料，且 MUST NOT 能進入帳號管理（/admin/users）。若該學員的 `guidance_chain` 不屬於「星光」或「太陽」（包含 null 或其他值），MUST NOT 建立帳號，自助登入失敗。

#### Scenario: 體系綁定正確
- **WHEN** 一位 `guidance_chain='太陽'` 的關懷長自助登入
- **THEN** 其帳號 system 為「太陽」，登入後僅見太陽體系資料

#### Scenario: 不能管理帳號
- **WHEN** 關懷長 admin 嘗試進入 /admin/users
- **THEN** 被導離 / 回應 403（僅 superadmin 可進）

#### Scenario: 關懷長本人不屬於任何體系時無法自助登入
- **WHEN** 一位符合關懷長以上角色條件、密碼也正確的學員，其 `guidance_chain` 為 null 或非「星光」「太陽」的值（例如「大行」）
- **THEN** 自助登入失敗，不建立帳號，回應與其他失敗情形一致的錯誤訊息（不洩漏「因體系不明」這個具體原因）
