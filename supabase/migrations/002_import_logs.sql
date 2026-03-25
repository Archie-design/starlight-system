CREATE TABLE import_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        REFERENCES import_sessions(id),
  applied_at   TIMESTAMPTZ DEFAULT now(),
  student_id   INTEGER     NOT NULL,
  student_name TEXT,
  field        TEXT        NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  change_type  TEXT        NOT NULL  -- 'insert' | 'update'
);

CREATE INDEX import_logs_session_id_idx ON import_logs(session_id);
CREATE INDEX import_logs_student_id_idx ON import_logs(student_id);
