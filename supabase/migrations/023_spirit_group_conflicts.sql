-- ============================================================
-- 心之使者「分組匯入衝突」資料表
-- ============================================================
--
-- 背景：拖曳搬移（見 022_spirit_ambassador_groups.sql、spirit-roster-
-- drag-edit）讓管理者能直接在系統內即時調整 students.spirit_ambassador_
-- group，但這個系統不是分組資料的唯一權威來源——管理者事後才會回「原
-- 官網系統」手動同步。若管理者還沒同步，就先匯入了新一批 xlsx，既有的
-- 匯入管線（app/api/import/apply/route.ts）對這個欄位完全沒有保留邏輯，
-- 會無聲用 xlsx 的舊值覆蓋掉拖曳成果。本表記錄「本系統現有值」與「xlsx
-- 候選值」兩者，讓匯入不再覆蓋、改為記錄待處理衝突，交由管理者事後在
-- 心之使者專區擇一保留。見 openspec/changes/spirit-group-import-conflict。
--
-- 不對 students.id 建實際外鍵約束——比照本專案既有慣例（parent_aliases、
-- student_overrides 等關聯表亦未強制外鍵）。
CREATE TABLE IF NOT EXISTS spirit_group_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id INTEGER NOT NULL,
  -- 姓名快照：避免學員改名後，衝突清單顯示的姓名與當下不一致
  student_name TEXT NOT NULL,
  -- 本系統現有的 spirit_ambassador_group 值（衝突發生當下的快照）
  system_value TEXT,
  -- xlsx 匯入帶來的候選值
  import_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  resolution TEXT CHECK (resolution IN ('kept_system', 'kept_import')),
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一位學員最多同時存在一筆待處理衝突——重複匯入不同的候選值時，
-- 更新既有 pending 記錄的 import_value，而非新增第二筆（見 design.md
-- Decision 1）。用部分唯一索引在資料庫層面保證這個不變量。
CREATE UNIQUE INDEX IF NOT EXISTS idx_spirit_group_conflicts_pending_student
  ON spirit_group_conflicts (student_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_spirit_group_conflicts_status
  ON spirit_group_conflicts (status);

-- RLS：比照既有表模式（009_rls_allow_anon.sql）——anon 唯讀（實際寫入
-- 皆經過 API 層的 requireManager 驗證），service_role 完全存取。
ALTER TABLE spirit_group_conflicts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read" ON spirit_group_conflicts;
DROP POLICY IF EXISTS "service_all" ON spirit_group_conflicts;
CREATE POLICY "anon_read" ON spirit_group_conflicts FOR SELECT TO anon USING (true);
CREATE POLICY "service_all" ON spirit_group_conflicts FOR ALL TO service_role USING (true);
