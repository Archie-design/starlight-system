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

-- 插入目前已設定的強制換線特例
INSERT INTO student_overrides (student_id, override_parent_id, note)
VALUES
  (8418,  4929,  '1150329安奇說蕭琇方-余家懿歸屬到潘立瑄頁面'),
  (10181, 4929,  '1150329安奇說蕭琇方-潘昀歸屬到潘立瑄頁面'),
  (21555, 4929,  '1150329安奇說蕭琇方-游芳瑜歸屬到潘立瑄頁面'),
  (21474, 4929,  '1150329安奇說羅梵云-盧姵禎歸屬到潘立瑄頁面'),
  (20924, 10393, '1150328安奇說何弈翰-莊海柔歸屬到郭芷萱頁面')
ON CONFLICT (student_id) DO UPDATE
SET override_parent_id = EXCLUDED.override_parent_id,
    note = EXCLUDED.note;
