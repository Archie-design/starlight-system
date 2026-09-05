-- ============================================================
-- 心之使者「分組」獨立資料表
-- ============================================================
--
-- 背景：分組總表原本完全依 students.spirit_ambassador_group（自由文字欄位）
-- 反推「目前存在哪些分組」——沒有任何學員持有某組名，該組就不存在。這次
-- 新增拖曳搬移、新增/刪除組別功能，「新增一個目前無成員的空組別」需要
-- 能在重新整理後仍然存在，因此新增這張獨立小表記錄組別本身。
-- 見 openspec/changes/spirit-roster-drag-edit。
--
-- guidance_chain 決定組別所屬體系（'星光'/'太陽'），與 students 表判定
-- 體系的欄位一致（見 lib/utils/system.ts 的 systemOf()），不使用
-- business_chain。
CREATE TABLE IF NOT EXISTS spirit_ambassador_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  guidance_chain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS：比照既有表模式（009_rls_allow_anon.sql）——anon 唯讀（實際寫入
-- 皆經過 API 層的 requireManager 驗證），service_role 完全存取。
ALTER TABLE spirit_ambassador_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON spirit_ambassador_groups;
DROP POLICY IF EXISTS "service_all" ON spirit_ambassador_groups;
CREATE POLICY "anon_read" ON spirit_ambassador_groups FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON spirit_ambassador_groups FOR ALL TO service_role USING (true);

-- 一次性回填：既有資料庫中已存在、由學員資料反推得出的組別（例如
-- 「星光1」～「星光30」），若不在這裡回填，上線後這些組別會因為這張新表
-- 是空的而從總表消失（即使底下仍有學員）。依學員的 guidance_chain 判斷
-- 該組別所屬體系；只回填 guidance_chain 為 '星光' 或 '太陽' 的學員所屬
-- 組別，其餘體系與既有的 systemOf() 排除規則一致。
INSERT INTO spirit_ambassador_groups (name, guidance_chain)
SELECT DISTINCT
  TRIM(spirit_ambassador_group) AS name,
  guidance_chain
FROM students
WHERE spirit_ambassador_group IS NOT NULL
  AND TRIM(spirit_ambassador_group) != ''
  AND guidance_chain IN ('星光', '太陽')
ON CONFLICT (name) DO NOTHING;
