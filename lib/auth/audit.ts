import type { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export type LoginEvent = 'login_success' | 'login_failure' | 'password_change'

/** 從請求取得用戶端 IP（經代理時取 x-forwarded-for 第一段） */
function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip')
}

/**
 * 寫入登入稽核（fire-and-forget，不阻塞回應）。
 * 失敗只記 console，不影響登入/改密碼流程。
 */
export function logLoginEvent(event: LoginEvent, username: string | null, request: NextRequest): void {
  try {
    const supabase = createServiceClient()
    void supabase
      .from('login_logs')
      .insert({
        username: username ?? null,
        event,
        ip: clientIp(request),
        user_agent: request.headers.get('user-agent'),
      })
      .then(({ error }) => {
        if (error) console.warn('[audit] login_logs insert failed:', error.message)
      })
  } catch (e) {
    console.warn('[audit] logLoginEvent error:', e)
  }
}

/**
 * 寫入操作稽核（admin_audit，fire-and-forget）。
 * action 例：user_created / user_disabled / user_enabled / password_reset /
 *           data_export / import_applied
 */
export function logAdminAction(
  action: string,
  opts: { actor: string | null; target?: string | null; detail?: string | null },
  request: NextRequest,
): void {
  try {
    const supabase = createServiceClient()
    void supabase
      .from('admin_audit')
      .insert({
        actor: opts.actor ?? null,
        action,
        target: opts.target ?? null,
        detail: opts.detail ?? null,
        ip: clientIp(request),
        user_agent: request.headers.get('user-agent'),
      })
      .then(({ error }) => {
        if (error) console.warn('[audit] admin_audit insert failed:', error.message)
      })
  } catch (e) {
    console.warn('[audit] logAdminAction error:', e)
  }
}
