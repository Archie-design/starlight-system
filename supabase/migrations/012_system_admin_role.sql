-- 新增 system_admin 角色：綁定單一體系（同 admin）但具帳號管理權限（給體系長）
-- 放寬 users 的 role 與 role/system 約束

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- 原 CHECK (role IN ('superadmin','admin')) 由欄位 inline CHECK 建立，名稱可能為 users_role_check
-- 為保險，改以具名約束統一管理
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_allowed;
ALTER TABLE users ADD CONSTRAINT users_role_allowed
  CHECK (role IN ('superadmin', 'admin', 'system_admin'));

-- 體系綁定約束：admin / system_admin 須綁體系；superadmin 不綁
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_system_chk;
ALTER TABLE users ADD CONSTRAINT users_role_system_chk CHECK (
  (role IN ('admin', 'system_admin') AND system IS NOT NULL) OR
  (role = 'superadmin' AND system IS NULL)
);
