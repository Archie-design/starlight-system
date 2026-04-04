import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  }

  const secret = process.env.AUTH_SECRET!
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, secret, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 天
  })
  return res
}
