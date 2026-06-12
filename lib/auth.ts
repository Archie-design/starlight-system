import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const SESSION_COOKIE = 'sl_session'
export const CSRF_TOKEN_COOKIE = 'csrf_token'
export const SESSION_EXPIRY_MINUTES = 30

// 生成會話令牌：使用密碼 + 時間戳 + 隨機值的 SHA-256
export async function generateSessionToken(password: string): Promise<string> {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const data = `${password}:${timestamp}:${random}`
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// 檢查會話是否有效（包括過期檢查）
export async function checkAuth(request?: NextRequest): Promise<{ valid: boolean; email?: string | null }> {
  const cookieStore = await cookies()
  const secret = process.env.AUTH_SECRET
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value
  const sessionTimestamp = cookieStore.get(`${SESSION_COOKIE}_ts`)?.value

  if (!secret || !sessionToken) {
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
      // 會話過期，清除 cookie
      cookieStore.delete(SESSION_COOKIE)
      cookieStore.delete(`${SESSION_COOKIE}_ts`)
      return { valid: false }
    }
  }

  // CSRF 保護：驗證 referer 或自訂 CSRF 頭
  if (request) {
    const referer = request.headers.get('referer')
    const csrfToken = request.headers.get('x-csrf-token')
    const storedCsrfToken = cookieStore.get(CSRF_TOKEN_COOKIE)?.value

    // 允許本地或相同源的請求，或提供有效的 CSRF 令牌
    const isLocalhost = !referer || referer.includes('localhost') || referer.includes('127.0.0.1')
    const isSameOrigin = referer && referer.startsWith(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    const csrfValid = csrfToken && storedCsrfToken && csrfToken === storedCsrfToken

    if (!isLocalhost && !isSameOrigin && !csrfValid) {
      console.warn('[auth] CSRF token validation failed', { referer })
      return { valid: false }
    }
  }

  // 取得用戶識別信息（暫時使用 email，可從請求頭或 session 延伸）
  const userEmail = cookieStore.get(`${SESSION_COOKIE}_email`)?.value ?? null

  return { valid: true, email: userEmail }
}
