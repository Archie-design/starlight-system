-- 指定學員強制換線特例表 (Whitelist Overrides)
CREATE TABLE IF NOT EXISTS student_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id int NOT NULL UNIQUE,          -- 被強制換線的學員 ID
  override_parent_id int NOT NULL,         -- 要強制換過去的上線 ID
  note text,                               -- 備註 (例如: 游芳瑜特例轉潘立瑄)
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read all"   ON student_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage all" ON student_overrides FOR ALL    TO authenticated USING (true);
