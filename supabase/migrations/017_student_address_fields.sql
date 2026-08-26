-- 新增學員地理位置欄位（縣市／地區／地址），供匯入 xlsx 的
-- 「縣市/州/省」「地區」「地址」欄位使用。
--
-- 注意：這裡的 district（地區）與既有的 region 欄位（輔導區域/關懷區域，
-- UI 顯示為「地區」）是完全不同的概念——region 是輔導組織架構分區，
-- district 是地理位置分類。兩者刻意用不同的資料庫欄位名稱區分，避免混淆。
ALTER TABLE students ADD COLUMN IF NOT EXISTS county   TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address  TEXT;
