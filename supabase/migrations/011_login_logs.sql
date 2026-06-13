-- 登入稽核紀錄
-- 記錄成功登入 / 失敗登入 / 改密碼，供 superadmin 查看登入狀況
-- 含 IP 為敏感資料，僅 service_role 可存取（anon 不可讀）

CREATE TABLE IF NOT EXISTS login_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text,
  event       text NOT NULL CHECK (event IN ('login_success', 'login_failure', 'password_change')),
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at DESC);

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_all" ON login_logs;
CREATE POLICY "service_all" ON login_logs FOR ALL TO service_role USING (true);
