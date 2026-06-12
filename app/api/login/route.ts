import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, CSRF_TOKEN_COOKIE, SESSION_EXPIRY_MINUTES } from '@/lib/auth'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const { password, email } = await req.json() as { password?: string; email?: string }

  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  }

  const secret = process.env.AUTH_SECRET!
  const now = Date.now()

  // 生成 CSRF 令牌
  const csrfToken = randomBytes(32).toString('hex')

  const res = NextResponse.json({ ok: true })

  // 設置會話 cookie（30 分鐘過期）
  res.cookies.set(SESSION_COOKIE, secret, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_MINUTES * 60,
  })

  // 設置會話時間戳 cookie（用於過期檢查）
  res.cookies.set(`${SESSION_COOKIE}_ts`, String(now), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_MINUTES * 60,
  })

  // 如果提供了 email，儲存用戶識別信息
  if (email) {
    res.cookies.set(`${SESSION_COOKIE}_email`, email, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_MINUTES * 60,
    })
  }

  // 設置 CSRF 令牌 cookie（客戶端可讀，非 httpOnly）
  res.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_MINUTES * 60,
  })

  return res
}
