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

-- 種子初始系統管理者（superadmin）
--
-- ⚠️ 不在此處硬編碼帳號/密碼（避免複製部署時帶到別組織的帳號，且 bcrypt 雜湊
--    含 '$' 在 SQL 編輯器易被 dollar-quoting 破壞）。
--    請改用參數化種子腳本建立第一個 superadmin：
--
--      SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
--      SUPERADMIN_USERNAME=admin@example.com SUPERADMIN_PASSWORD='初始密碼' \
--      npx tsx supabase/seed/seedSuperadmin.ts

-- 維持 students 依 business_chain 篩選的效能
CREATE INDEX IF NOT EXISTS idx_students_business_chain ON students(business_chain);
