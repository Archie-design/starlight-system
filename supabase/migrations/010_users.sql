-- 多使用者帳號系統
-- 角色：superadmin（跨體系、管理帳號）、admin（綁定單一體系）
-- 體系判定依學員 business_chain（太陽 vs 非太陽）；admin.system 記錄其所屬體系
-- 認證沿用自訂 cookie session（非 Supabase Auth）

CREATE TABLE IF NOT EXISTS users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username             text NOT NULL UNIQUE,
  password_hash        text NOT NULL,
  role                 text NOT NULL CHECK (role IN ('superadmin', 'admin')),
  system               text CHECK (system IN ('星光', '太陽')),
  active               boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- admin 必須綁定體系；superadmin 不綁定體系
  CONSTRAINT users_role_system_chk CHECK (
    (role = 'admin' AND system IS NOT NULL) OR
    (role = 'superadmin' AND system IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- RLS：users 為敏感資料，anon 不可讀；僅 service_role（API 層）可存取
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_all" ON users;
CREATE POLICY "service_all" ON users FOR ALL TO service_role USING (true);

-- 種子初始系統管理者
-- username: starlightsystem@gmail.com
-- 初始密碼: Starlight@2026（首次登入強制修改）
--
-- ⚠️ bcrypt 雜湊含 '$'，某些 SQL 客戶端會誤判為 dollar-quoting 而破壞字串。
--    若套用後登入顯示「帳號或密碼錯誤」，請改用 service role 以程式重設雜湊：
--      const hash = bcrypt.hashSync('Starlight@2026', 10)
--      await supabase.from('users').update({ password_hash: hash }).eq('username','starlightsystem@gmail.com')
INSERT INTO users (username, password_hash, role, system, must_change_password)
VALUES (
  'starlightsystem@gmail.com',
  '$2b$10$.4e8/5agbxf6yBkYfkXmh.01vW.H4.15XTLhsmDpiJIrNsrCHqbbm',
  'superadmin',
  NULL,
  true
)
ON CONFLICT (username) DO NOTHING;

-- 維持 students 依 business_chain 篩選的效能
CREATE INDEX IF NOT EXISTS idx_students_business_chain ON students(business_chain);
