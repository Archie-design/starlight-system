-- 修改密碼後讓其他既有 session 失效（對應 code review P2 #26）
--
-- 現有 session 機制：session cookie（sl_session）驗證的是全域固定的
-- AUTH_SECRET，並非每帳號各自獨立的令牌，身分靠另一個 sl_session_uid cookie
-- 區分——這代表原本無法單獨讓「某個帳號」的 session 失效。
--
-- 新增 session_version：每次登入時把當下版本號一起寫進 cookie，checkAuth()
-- 驗證時比對 cookie 版本與 DB 版本是否一致；改密碼（自行改密碼／被管理者
-- 重設密碼）時把 DB 版本 +1，讓所有帶著舊版本號 cookie 的既有 session
-- 立即失效，需要重新登入。

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
