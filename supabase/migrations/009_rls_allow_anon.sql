-- 更新 RLS 政策：允許 anon 存取
-- 原本只允許 authenticated（Supabase Auth），改為 anon + authenticated 皆可
-- 因為已改用自訂密碼登入，不再使用 Supabase Auth

-- students
DROP POLICY IF EXISTS "auth_users_all" ON students;
DROP POLICY IF EXISTS "allow_all" ON students;
CREATE POLICY "allow_all" ON students FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- import_sessions
DROP POLICY IF EXISTS "auth_users_all" ON import_sessions;
DROP POLICY IF EXISTS "allow_all" ON import_sessions;
CREATE POLICY "allow_all" ON import_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- import_logs
DROP POLICY IF EXISTS "auth read" ON import_logs;
DROP POLICY IF EXISTS "auth insert" ON import_logs;
DROP POLICY IF EXISTS "allow_all" ON import_logs;
CREATE POLICY "allow_all" ON import_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- counselor_groups
DROP POLICY IF EXISTS "auth read" ON counselor_groups;
DROP POLICY IF EXISTS "auth manage" ON counselor_groups;
DROP POLICY IF EXISTS "allow_all" ON counselor_groups;
CREATE POLICY "allow_all" ON counselor_groups FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- edit_logs
DROP POLICY IF EXISTS "auth read" ON edit_logs;
DROP POLICY IF EXISTS "auth insert" ON edit_logs;
DROP POLICY IF EXISTS "allow_all" ON edit_logs;
CREATE POLICY "allow_all" ON edit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- parent_aliases
DROP POLICY IF EXISTS "auth read all" ON parent_aliases;
DROP POLICY IF EXISTS "auth manage all" ON parent_aliases;
DROP POLICY IF EXISTS "allow_all" ON parent_aliases;
CREATE POLICY "allow_all" ON parent_aliases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- student_overrides
DROP POLICY IF EXISTS "auth read all" ON student_overrides;
DROP POLICY IF EXISTS "auth manage all" ON student_overrides;
DROP POLICY IF EXISTS "allow_all" ON student_overrides;
CREATE POLICY "allow_all" ON student_overrides FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
