-- 心之使者相關欄位
ALTER TABLE students ADD COLUMN IF NOT EXISTS spirit_ambassador_join_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS love_giving_start_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS spirit_ambassador_group TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS cumulative_seniority TEXT;
