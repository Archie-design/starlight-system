-- 輔導長分組清單
CREATE TABLE counselor_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  root_student_ids int[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE counselor_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read"   ON counselor_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage" ON counselor_groups FOR ALL    TO authenticated USING (true);

-- 學員歸屬欄位
ALTER TABLE students ADD COLUMN IF NOT EXISTS group_leader text;
CREATE INDEX IF NOT EXISTS idx_students_group_leader ON students(group_leader);

-- 初始 9 個分組（順序同資料庫現況）
INSERT INTO counselor_groups (name, display_order, root_student_ids) VALUES
  ('張安奇高珮綺', 1, '{3034,2888}'),
  ('謝貿如蔡京唐', 2, '{6968,21711}'),
  ('李筱婷',       3, '{5231}'),
  ('李宜娟',       4, '{8700}'),
  ('郭芷萱',       5, '{10393}'),
  ('潘立瑄',       6, '{4929}'),
  ('王姿尹',       7, '{13235}'),
  ('陳宥翎',       8, '{3545}'),
  ('夏嘉鴻',       9, '{4252}')
ON CONFLICT (name) DO NOTHING;
