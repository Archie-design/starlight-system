import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * 登入 / 改密碼端點的速率限制（P1 #13）。
 *
 * 沒有額外的計數器表或記憶體儲存（Serverless 環境下記憶體不跨 instance 共用，
 * 不可靠），改為直接查詢既有的 `login_logs` 稽核表——它本來就記錄每一次登入
 * 嘗試（含失敗）的 IP、帳號、時間，剛好可以拿來當滑動視窗計數用，不用新增表。
 *
 * 採 IP 與帳號兩個維度分別限制，任一個超過門檻就擋：
 * - 同一 IP 短時間內大量嘗試（不同帳號）→ 擋自動化撞庫
 * - 同一帳號短時間內大量嘗試（不同 IP）→ 擋針對單一帳號的暴力破解
 */
const WINDOW_MS = 10 * 60 * 1000 // 10 分鐘滑動視窗
const MAX_ATTEMPTS_PER_IP = 20
const MAX_ATTEMPTS_PER_USERNAME = 8

function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip')
}

export type RateLimitResult = { limited: false } | { limited: true; reason: string }

/**
 * 檢查是否已超過速率限制。只統計 `login_failure` 事件（成功登入不計入，
 * 避免正常使用者被自己過去的登入紀錄卡住）。
 *
 * 失敗開放（fail-open）：查詢本身出錯時放行，避免稽核表異常直接讓登入全面
 * 中斷——速率限制是縱深防禦的一層，不是唯一防線。
 */
export async function checkLoginRateLimit(
  request: NextRequest,
  username: string | null,
): Promise<RateLimitResult> {
  try {
    const supabase = createServiceClient()
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const ip = clientIp(request)

    if (ip) {
      const { count, error } = await supabase
        .from('login_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', 'login_failure')
        .eq('ip', ip)
        .gte('created_at', since)
      if (!error && (count ?? 0) >= MAX_ATTEMPTS_PER_IP) {
        return { limited: true, reason: '嘗試次數過多，請稍後再試' }
      }
    }

    if (username) {
      const { count, error } = await supabase
        .from('login_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event', 'login_failure')
        .eq('username', username)
        .gte('created_at', since)
      if (!error && (count ?? 0) >= MAX_ATTEMPTS_PER_USERNAME) {
        return { limited: true, reason: '此帳號嘗試次數過多，請稍後再試' }
      }
    }

    return { limited: false }
  } catch (e) {
    console.warn('[rateLimit] checkLoginRateLimit error (fail-open):', e)
    return { limited: false }
  }
}
