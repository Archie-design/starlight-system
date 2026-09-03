-- 新增課後課出席欄位與聯誼會報名欄位，供課程專區顯示各階完課率、
-- 聯誼會報名狀況。
--
-- 課後課欄位值為「上課日期時間」文字（比照既有 course_N 欄位「有值=已
-- 上課」的既有語意，非布林值）；各階課後課堂數不對稱（一階6堂、二階5堂、
-- 三/四階各3堂、五階1堂），故用 l{level}_makeup_{seq} 命名，不強求對齊。
ALTER TABLE students ADD COLUMN IF NOT EXISTS l1_makeup_1 TEXT; -- 一階課程 - 同學會
ALTER TABLE students ADD COLUMN IF NOT EXISTS l1_makeup_2 TEXT; -- 一階課程 - 我喜歡/討厭自己的原因
ALTER TABLE students ADD COLUMN IF NOT EXISTS l1_makeup_3 TEXT; -- 一階課程 - 上平下緣傳愛道
ALTER TABLE students ADD COLUMN IF NOT EXISTS l1_makeup_4 TEXT; -- 一階課程 - 對好心沒好報的誤解
ALTER TABLE students ADD COLUMN IF NOT EXISTS l1_makeup_5 TEXT; -- 一階課程 - 上級貴人成功學
ALTER TABLE students ADD COLUMN IF NOT EXISTS l1_makeup_6 TEXT; -- 一階 - 金錢的助流

ALTER TABLE students ADD COLUMN IF NOT EXISTS l2_makeup_1 TEXT; -- 二階課程 - 同學會
ALTER TABLE students ADD COLUMN IF NOT EXISTS l2_makeup_2 TEXT; -- 二階 - 解脫痛苦之道
ALTER TABLE students ADD COLUMN IF NOT EXISTS l2_makeup_3 TEXT; -- 二階 - 道命之路成功秘訣
ALTER TABLE students ADD COLUMN IF NOT EXISTS l2_makeup_4 TEXT; -- 二階課程 - 動中之靜煉金術(修靜)
ALTER TABLE students ADD COLUMN IF NOT EXISTS l2_makeup_5 TEXT; -- 二階課程 - 痛的參解

ALTER TABLE students ADD COLUMN IF NOT EXISTS l3_makeup_1 TEXT; -- 三階 - 同學會
ALTER TABLE students ADD COLUMN IF NOT EXISTS l3_makeup_2 TEXT; -- 三階 - 平衡力開運法
ALTER TABLE students ADD COLUMN IF NOT EXISTS l3_makeup_3 TEXT; -- 三階 - 懺悔寬恕寶藏圖

ALTER TABLE students ADD COLUMN IF NOT EXISTS l4_makeup_1 TEXT; -- 四階課程 - 同學會
ALTER TABLE students ADD COLUMN IF NOT EXISTS l4_makeup_2 TEXT; -- 四階課程 - 突破陰暗面
ALTER TABLE students ADD COLUMN IF NOT EXISTS l4_makeup_3 TEXT; -- 四階課程 - 陰陽智慧的奇蹟(批評、欣賞)

ALTER TABLE students ADD COLUMN IF NOT EXISTS l5_makeup_1 TEXT; -- 五階 - 同學會

-- 聯誼會報名：加入日有值即代表已報名（比照 spirit_ambassador_join_date
-- 判斷「是否為心之使者」的既有模式），組別供延伸分析用途。
-- 注意：既有的 membership_expiry 欄位對應 xlsx「聯誼會籍」，語意是會籍
-- 到期日，與這裡的「是否報名」是不同概念，不可混用。
ALTER TABLE students ADD COLUMN IF NOT EXISTS club_join_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS club_group TEXT;
