-- ============================================================
-- 效能索引補強（對應 code review P1 #11、#16）
-- ============================================================
--
-- #11：體系判定實際依 business_chain（見 lib/utils/system.ts 的 systemOf()／
-- applySystemFilter()），並非既有的 sheet_system 欄位（該欄位只在匯入時寫入，
-- 從未被查詢用來做體系隔離）。business_chain 原本沒有索引，卻是幾乎每一次
-- students 查詢的必經條件（applySystemFilter 套用在所有 findBySystem／
-- findByGroupLeader／findByMaintenanceCategory／getDistinctValues 查詢上）。
--
-- 星光體系的判定是 `business_chain IS NULL OR business_chain <> '太陽'`，
-- 用 OR 且對太陽以外的值一律視為星光，不易被單一 b-tree 索引直接命中太陽以外
-- 的所有列。改用 generated column 把「體系」計算結果固化成一個可等值查詢
-- 的欄位，同時作為與其他常用欄位組成複合索引的前導欄。
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS system_computed TEXT
  GENERATED ALWAYS AS (CASE WHEN business_chain = '太陽' THEN '太陽' ELSE '星光' END) STORED;

CREATE INDEX IF NOT EXISTS idx_students_system_computed ON students (system_computed);

-- #16：排序／表頭篩選白名單（lib/utils/columnFilter.ts 的 SORTABLE_FIELDS／
-- COLUMN_FILTER_FIELDS）涵蓋的欄位中，membership_expiry、birthday 無索引。
-- （business_chain 的索引已在 010_users.sql 建立過，這裡不重複加。）
CREATE INDEX IF NOT EXISTS idx_students_membership_expiry ON students (membership_expiry);
CREATE INDEX IF NOT EXISTS idx_students_birthday           ON students (birthday);

-- 複合索引：體系隔離 + id 排序是所有分頁查詢的預設路徑
-- （applyOrder() 未指定 sort 時預設 .order('id')，且 applySystemFilter 恆先套用）。
CREATE INDEX IF NOT EXISTS idx_students_system_computed_id ON students (system_computed, id);
