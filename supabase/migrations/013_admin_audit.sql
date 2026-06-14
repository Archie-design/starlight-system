-- 操作稽核：記錄帳號管理 / 資料匯出 / 匯入套用等敏感操作
-- 含 IP 等敏感資料，僅 service_role 可存取

CREATE TABLE IF NOT EXISTS admin_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor       text,        -- 操作者帳號
  action      text NOT NULL, -- user_created / user_disabled / user_enabled / password_reset / data_export / import_applied
  target      text,        -- 操作對象（如目標帳號、體系）
  detail      text,        -- 細節（如筆數、套用/錯誤數）
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC);

ALTER TABLE admin_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_all" ON admin_audit;
CREATE POLICY "service_all" ON admin_audit FOR ALL TO service_role USING (true);
