'use client'

/**
 * 讀取 csrf_token cookie（登入時由 server 寫入，httpOnly:false 前端可讀）。
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * 包裝 fetch，自動帶上 x-csrf-token header。
 * 受保護的 API（checkAuth(request)）會驗證此 header；跨網域（正式站、preview
 * 部署）時沒有它會被 CSRF 機制擋下。
 */
export function csrfFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getCsrfToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('x-csrf-token', token)
  return fetch(input, { ...init, headers })
}
