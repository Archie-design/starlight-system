import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import {
  SESSION_COOKIE,
  SESSION_UID_COOKIE,
  CSRF_TOKEN_COOKIE,
  SESSION_EXPIRY_MINUTES,
} from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username?: string; password?: string }

  if (!username || !password) {
    return NextResponse.json({ error: '請輸入帳號與密碼' }, { status: 400 })
  }

  const secret = process.env.AUTH_SECRET
  if (!secret) {
    return NextResponse.json({ error: '伺服器未設定 AUTH_SECRET' }, { status: 500 })
  }

  const supabase = createServiceClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, password_hash, active, must_change_password')
    .eq('username', username)
    .maybeSingle()

  // 帳號不存在、停用、或密碼不符 → 一律相同錯誤訊息（避免帳號列舉）
  if (error || !user || user.active !== true) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  const ok = await compare(password, user.password_hash)
  if (!ok) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  const now = Date.now()
  const csrfToken = randomBytes(32).toString('hex')
  const res = NextResponse.json({ ok: true, mustChangePassword: user.must_change_password })

  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_EXPIRY_MINUTES * 60,
  }

  res.cookies.set(SESSION_COOKIE, secret, cookieOpts)
  res.cookies.set(`${SESSION_COOKIE}_ts`, String(now), cookieOpts)
  res.cookies.set(SESSION_UID_COOKIE, user.id, cookieOpts)
  res.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, { ...cookieOpts, httpOnly: false })

  return res
}
