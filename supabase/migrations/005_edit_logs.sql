-- 手動編輯稽核紀錄
CREATE TABLE edit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  int         NOT NULL,
  student_name text,
  field       text        NOT NULL,
  old_value   text,
  new_value   text,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  text        -- user email
);

ALTER TABLE edit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read"   ON edit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert" ON edit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_edit_logs_student_id  ON edit_logs(student_id);
CREATE INDEX idx_edit_logs_changed_at  ON edit_logs(changed_at DESC);
