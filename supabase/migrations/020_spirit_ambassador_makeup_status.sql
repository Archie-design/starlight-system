-- ============================================================
-- 心之使者「已分組但尚未完成補課」狀態欄位
-- ============================================================
--
-- 背景：關懷長平時用手動 Excel/Google 表單維護一份「27欄分組總表」，
-- 綠底標記「已報名分組、但尚未完成心之使者補課（因此還不是正式心之
-- 使者）」的成員。這是系統目前完全無法表達的中間狀態——「是否為心之
-- 使者」只看 spirit_ambassador_join_date 是否有值，這批人 join_date
-- 理應維持空白（他們確實還沒完課），但已經被分進組別、需要被追蹤。
--
-- 語意：true=已完成補課；false/null=已分組但尚未完成補課（分組總表
-- 顯示淺綠底）。與 spirit_ambassador_join_date 完全獨立判定，不互相
-- 覆蓋或推斷——見 openspec/changes/spirit-ambassador-master-roster/
-- specs/spirit-ambassador-hub/spec.md 的「補課狀態標示」需求。
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS spirit_ambassador_makeup_completed BOOLEAN;
