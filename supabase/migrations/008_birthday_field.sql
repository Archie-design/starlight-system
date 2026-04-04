-- 補充 birthday 欄位（原本直接在 Dashboard 新增，未記錄於 migration）
ALTER TABLE students ADD COLUMN IF NOT EXISTS birthday TEXT;
