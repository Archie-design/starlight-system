-- ============================================================
-- 體系判定基準從 business_chain（業務脈）改為 guidance_chain（關懷脈/輔導體系）
-- ============================================================
--
-- 背景：業務脈近期新增「大行」體系，若繼續依業務脈判定，這些人會被錯誤歸入
-- 星光顯示。實際「哪個人該由星光或太陽的關懷體系管理」是由 guidance_chain
-- 決定的，業務脈與關懷脈實測常常不一致（見 openspec/changes/
-- guidance-chain-system-basis/design.md）。
--
-- system_computed 是 generated column（migration 015），Postgres 不支援直接
-- 修改 generated column 的運算式，故用 DROP + 重新 ADD 的方式重建。
-- DROP COLUMN 會一併移除該欄位既有的索引，索引語句需在新增欄位後重新執行。
--
-- guidance_chain 精確等於「星光」或「太陽」才歸入對應體系；其餘所有值
-- （null、海洋、明明、神兵、大行、地球、蛻變、方圓等）計算結果為 NULL，
-- 代表「不屬於任何體系」。NULL 不會匹配任何 .eq('system_computed', '星光'|'太陽')
-- 查詢，天然把這些學員排除在所有頁面之外，不需要應用層額外過濾。
--
-- 實測影響（2842 名學員）：
--   變更前（依 business_chain）：星光 2084、太陽 758，全數 2842 人皆顯示
--   變更後（依 guidance_chain） ：星光 1017、太陽 423、NULL 1402（不再顯示）
ALTER TABLE students DROP COLUMN IF EXISTS system_computed;

ALTER TABLE students
  ADD COLUMN system_computed TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN guidance_chain = '星光' THEN '星光'
      WHEN guidance_chain = '太陽' THEN '太陽'
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_students_system_computed ON students (system_computed);
CREATE INDEX IF NOT EXISTS idx_students_system_computed_id ON students (system_computed, id);
