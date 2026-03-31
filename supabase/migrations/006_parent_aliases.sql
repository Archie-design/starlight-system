-- 上線代管對照表
CREATE TABLE IF NOT EXISTS parent_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_parent_id int NOT NULL UNIQUE,   -- 原始學員 ID
  proxy_parent_id int NOT NULL,            -- 代理學員 ID
  note text,                               -- 備註
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE parent_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read all"   ON parent_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth manage all" ON parent_aliases FOR ALL    TO authenticated USING (true);

-- 插入/更新使用者要求的代管關係
INSERT INTO parent_aliases (original_parent_id, proxy_parent_id, note)
VALUES 
  (4253, 10393, '蕭琇方不在星光時，由郭芷萱代理'),
  (14691, 4929, '黃純庭一脈由潘立瑄代理'),
  (4650, 4929, '吳芷萱一脈由潘立瑄代理'),
  (4148, 8700, '張孟育不在星光時，由李宜娟代理'),
  (4880, 8700, '楊寶盛不在星光時，由李宜娟代理'),
  (5020, 8700, '洪福謙不在星光時，由李宜娟代理'),
  (4599, 8700, '何弈翰不在星光時，由李宜娟代理'),
  (26655, 10393, '沈彥涵不在星光時，由郭芷萱代理'),
  (5824, 10393, '謝晴晴不在星光時，由郭芷萱代理'),
  (7290, 10393, '李雨珊不在星光時，由郭芷萱代理')
ON CONFLICT (original_parent_id) DO UPDATE 
SET proxy_parent_id = EXCLUDED.proxy_parent_id,
    note = EXCLUDED.note;
