-- RLS 政策：區分讀寫權限
-- 使用自訂密碼登入 (sessions) 而非 Supabase Auth
-- anon 角色：唯讀（需經過 API 驗證層）
-- service_role（API 層）：具有寫入權限

-- students - anon 唯讀，service_role 完全存取
DROP POLICY IF EXISTS "auth_users_all" ON students;
DROP POLICY IF EXISTS "allow_all" ON students;
CREATE POLICY "anon_read" ON students FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON students FOR ALL TO service_role USING (true);

-- import_sessions - anon 唯讀，service_role 完全存取
DROP POLICY IF EXISTS "auth_users_all" ON import_sessions;
DROP POLICY IF EXISTS "allow_all" ON import_sessions;
CREATE POLICY "anon_read" ON import_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON import_sessions FOR ALL TO service_role USING (true);

-- import_logs - anon 唯讀，service_role 完全存取
DROP POLICY IF EXISTS "auth read" ON import_logs;
DROP POLICY IF EXISTS "auth insert" ON import_logs;
DROP POLICY IF EXISTS "allow_all" ON import_logs;
CREATE POLICY "anon_read" ON import_logs FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON import_logs FOR ALL TO service_role USING (true);

-- counselor_groups - anon 唯讀，service_role 完全存取
DROP POLICY IF EXISTS "auth read" ON counselor_groups;
DROP POLICY IF EXISTS "auth manage" ON counselor_groups;
DROP POLICY IF EXISTS "allow_all" ON counselor_groups;
CREATE POLICY "anon_read" ON counselor_groups FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON counselor_groups FOR ALL TO service_role USING (true);

-- edit_logs - anon 唯讀，service_role 完全存取
DROP POLICY IF EXISTS "auth read" ON edit_logs;
DROP POLICY IF EXISTS "auth insert" ON edit_logs;
DROP POLICY IF EXISTS "allow_all" ON edit_logs;
CREATE POLICY "anon_read" ON edit_logs FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON edit_logs FOR ALL TO service_role USING (true);

-- parent_aliases - anon 唯讀，service_role 完全存取
DROP POLICY IF EXISTS "auth read all" ON parent_aliases;
DROP POLICY IF EXISTS "auth manage all" ON parent_aliases;
DROP POLICY IF EXISTS "allow_all" ON parent_aliases;
CREATE POLICY "anon_read" ON parent_aliases FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON parent_aliases FOR ALL TO service_role USING (true);

-- student_overrides - anon 唯讀，service_role 完全存取
DROP POLICY IF EXISTS "auth read all" ON student_overrides;
DROP POLICY IF EXISTS "auth manage all" ON student_overrides;
DROP POLICY IF EXISTS "allow_all" ON student_overrides;
CREATE POLICY "anon_read" ON student_overrides FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON student_overrides FOR ALL TO service_role USING (true);
