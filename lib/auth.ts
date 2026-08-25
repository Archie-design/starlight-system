import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/lib/supabase/types'

export const SESSION_COOKIE = 'sl_session'
export const SESSION_UID_COOKIE = 'sl_session_uid'
/** 帳號的 session_version 快照（見 migration 016）；改密碼時 DB 版本 +1，讓帶舊版本號的既有 session 失效 */
export const SESSION_VERSION_COOKIE = 'sl_session_ver'
export const VIEW_SYSTEM_COOKIE = 'sl_view_system'
export const CSRF_TOKEN_COOKIE = 'csrf_token'
export const SESSION_EXPIRY_MINUTES = 30

export type CheckAuthResult = { valid: boolean; user?: AuthUser | null }

/**
 * 檢查會話是否有效並回傳使用者身分。
 * 流程：驗證 sl_session(=AUTH_SECRET) + 未過期 + CSRF → 以 sl_session_uid 查 users 表
 *       並確認帳號仍存在且 active（停用即時失效）。
 */
export async function checkAuth(request?: NextRequest): Promise<CheckAuthResult> {
  const cookieStore = await cookies()
  const secret = process.env.AUTH_SECRET
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value
  const sessionTimestamp = cookieStore.get(`${SESSION_COOKIE}_ts`)?.value
  const uid = cookieStore.get(SESSION_UID_COOKIE)?.value

  if (!secret || !sessionToken || !uid) {
    return { valid: false }
  }

  // 驗證會話令牌
  if (sessionToken !== secret) {
    return { valid: false }
  }

  // 驗證會話是否過期（30分鐘）
  if (sessionTimestamp) {
    const timestamp = parseInt(sessionTimestamp, 10)
    const now = Date.now()
    const elapsedMinutes = (now - timestamp) / (1000 * 60)
    if (elapsedMinutes > SESSION_EXPIRY_MINUTES) {
      return { valid: false }
    }
  }

  // CSRF 保護：驗證 referer 的 origin 是否為信任來源，或有效的自訂 CSRF 頭。
  // 注意：request 為 optional 是為了相容非 HTTP 觸發的呼叫（例如 Server Component
  // 直接呼叫 checkAuth() 渲染頁面時沒有 request 物件可傳）；但任何處理使用者發出
  // 的 HTTP 請求的 route handler，都必須傳入 request，否則這段檢查會被整段跳過。
  if (request) {
    const referer = request.headers.get('referer')
    const csrfToken = request.headers.get('x-csrf-token')
    const storedCsrfToken = cookieStore.get(CSRF_TOKEN_COOKIE)?.value
    const csrfValid = !!csrfToken && !!storedCsrfToken && csrfToken === storedCsrfToken

    // 允許清單：本機開發網址與設定的正式網址，一律用嚴格 origin 比對
    // （而非子字串 includes，避免 http://localhost.attacker.com 之類的繞過）。
    const allowedOrigins = new Set([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter((v): v is string => !!v))

    let refererOriginAllowed = false
    if (referer) {
      try {
        refererOriginAllowed = allowedOrigins.has(new URL(referer).origin)
      } catch {
        refererOriginAllowed = false
      }
    }

    // 沒有 Referer 時不再預設放行——必須有有效的 CSRF token 才能通過。
    if (!refererOriginAllowed && !csrfValid) {
      console.warn('[auth] CSRF validation failed', { referer })
      return { valid: false }
    }
  }

  // 以 uid 查 users 表，確認帳號存在且啟用
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, system, display_name, active, must_change_password, session_version')
    .eq('id', uid)
    .maybeSingle()

  if (error || !data || data.active !== true) {
    return { valid: false }
  }

  // session_version 比對：改密碼（自行改／被管理者重設）時 DB 版本會 +1，
  // 讓帶著舊版本號 cookie 的既有 session 立即失效，需要重新登入。
  const sessionVersionCookie = cookieStore.get(SESSION_VERSION_COOKIE)?.value
  const sessionVersion = sessionVersionCookie ? parseInt(sessionVersionCookie, 10) : NaN
  if (sessionVersion !== data.session_version) {
    return { valid: false }
  }

  const user: AuthUser = {
    id: data.id,
    username: data.username,
    role: data.role,
    system: data.system,
    display_name: data.display_name ?? null,
    must_change_password: data.must_change_password,
  }
  return { valid: true, user }
}

/**
 * 計算使用者的「有效體系」。
 * - admin：固定為其綁定體系
 * - superadmin：依其當前選擇（VIEW_SYSTEM_COOKIE），預設「星光」
 */
export async function getEffectiveSystem(user: AuthUser): Promise<'星光' | '太陽'> {
  // 非 superadmin（admin / system_admin）鎖定其綁定體系
  if (user.role !== 'superadmin' && user.system) return user.system
  const cookieStore = await cookies()
  const view = cookieStore.get(VIEW_SYSTEM_COOKIE)?.value
  return view === '太陽' ? '太陽' : '星光'
}
