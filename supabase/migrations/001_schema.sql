-- ============================================================
-- 星光超級表格系統 - 初始資料庫架構
-- ============================================================

-- 學員主表
CREATE TABLE students (
  -- 主鍵：從 "568_王晴臻" 提取數字 568
  id                    INTEGER PRIMARY KEY,
  name                  TEXT NOT NULL,
  name_with_id          TEXT GENERATED ALWAYS AS (id::text || '_' || name) STORED,

  -- 身份資訊
  gender                TEXT,
  role                  TEXT,
  sheet_system          TEXT NOT NULL,          -- '星光' | '太陽'

  -- 聯絡資訊
  phone                 TEXT,
  line_id               TEXT,

  -- 組織脈絡 (以 "ID_姓名" 格式儲存)
  introducer            TEXT,                   -- 介紹人
  relation              TEXT,                   -- 關係人
  business_chain        TEXT,                   -- 業務脈
  counselor             TEXT,                   -- 輔導員
  little_angel          TEXT,                   -- 小天使
  dream_interpreter     TEXT,                   -- 圓夢解盤員
  senior_counselor      TEXT,                   -- 輔導長
  region                TEXT,                   -- 地區
  guidance_chain        TEXT,                   -- 輔導脈
  membership_expiry     DATE,                   -- 社團會籍到期日

  -- 課程欄位 (TEXT 格式: "1-88-正取" / "完款" / 數字餘額)
  course_1              TEXT,                   -- 一階課程狀態
  payment_1             TEXT,                   -- 一階完款/餘額
  parent_1              TEXT,                   -- 一階大堂課家長

  course_2              TEXT,                   -- 二階課程狀態
  payment_2             TEXT,

  course_3              TEXT,                   -- 三階課程狀態
  payment_3             TEXT,

  course_4              TEXT,                   -- 四階課程狀態
  payment_4             TEXT,

  course_5              TEXT,                   -- 五階課程狀態
  payment_5             TEXT,

  -- 五運班
  course_wuyun          TEXT,                   -- 五運課程狀態
  payment_wuyun         TEXT,                   -- 五運完款/餘額
  wuyun_a               TEXT,                   -- 五運A 出席 (民國日期)
  wuyun_b               TEXT,                   -- 五運B 出席
  wuyun_c               TEXT,                   -- 五運C 出席
  wuyun_d               TEXT,                   -- 五運D 出席
  wuyun_f               TEXT,                   -- 五運F 出席 (無E)

  -- 特殊課程
  life_numbers          TEXT,                   -- 生命數字
  life_numbers_advanced TEXT,                   -- 生命數字實戰班
  life_transform        TEXT,                   -- 生命蛻變
  debt_release          TEXT,                   -- 生生世世告別負債貧窮

  -- 稽核欄位
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  last_synced_at        TIMESTAMPTZ,
  system_id             INTEGER                 -- 學員關懷匯入的系統編號
);

-- 索引
CREATE INDEX idx_students_system     ON students (sheet_system);
CREATE INDEX idx_students_counselor  ON students (counselor);
CREATE INDEX idx_students_region     ON students (region);
CREATE INDEX idx_students_system_id  ON students (system_id);
CREATE INDEX idx_students_fts        ON students
  USING gin(to_tsvector('simple',
    coalesce(name,'') || ' ' ||
    coalesce(counselor,'') || ' ' ||
    coalesce(introducer,'') || ' ' ||
    coalesce(senior_counselor,'')
  ));

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 匯入記錄表
-- ============================================================
CREATE TABLE import_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at    TIMESTAMPTZ DEFAULT now(),
  filename       TEXT,
  source_rows    INTEGER,
  rows_updated   INTEGER DEFAULT 0,
  rows_inserted  INTEGER DEFAULT 0,
  rows_unchanged INTEGER DEFAULT 0,
  diff_snapshot  JSONB,
  applied        BOOLEAN DEFAULT false,
  applied_at     TIMESTAMPTZ
);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE students         ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_sessions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users_all" ON students
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_users_all" ON import_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
