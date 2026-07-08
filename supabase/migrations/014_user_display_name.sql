-- 帳號顯示姓名：登入紀錄 / 帳號管理 / 頁面頂端顯示可讀姓名
-- 可空；留空時由伺服端姓名解析規則退回學員姓名(ID) 或 username

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
