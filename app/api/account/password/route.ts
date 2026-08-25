import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/middleware'
import { logLoginEvent } from '@/lib/auth/audit'
import { checkLoginRateLimit } from '@/lib/auth/rateLimit'
import { validatePasswordStrength, PASSWORD_HASH_COST } from '@/lib/auth/passwordPolicy'
import { SESSION_VERSION_COOKIE, SESSION_EXPIRY_MINUTES } from '@/lib/auth'

// 使用者自行修改密碼（驗證舊密碼）
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { oldPassword, newPassword } = await request.json() as {
    oldPassword?: string
    newPassword?: string
  }

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: '請輸入舊密碼與新密碼' }, { status: 400 })
  }
  const strengthError = validatePasswordStrength(newPassword)
  if (strengthError) {
    return NextResponse.json({ error: strengthError }, { status: 400 })
  }

  const rateLimit = await checkLoginRateLimit(request, user.username)
  if (rateLimit.limited) {
    return NextResponse.json({ error: rateLimit.reason }, { status: 429 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('password_hash, session_version')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: '帳號不存在' }, { status: 404 })
  }

  const ok = await compare(oldPassword, data.password_hash)
  if (!ok) {
    // 計入速率限制的失敗次數（沿用 login_logs 當滑動視窗計數，見 checkLoginRateLimit）
    logLoginEvent('login_failure', user.username, request)
    return NextResponse.json({ error: '舊密碼錯誤' }, { status: 400 })
  }

  // session_version +1：讓其他既有 session（例如同帳號在別的裝置登入）失效，
  // 需要重新登入（P2 #26）。這裡是唯一的讀寫者（單一使用者改自己的密碼），
  // 沒有高併發疑慮，用讀到的舊值 +1 寫回即可，不需要 SQL 層 atomic increment。
  const newSessionVersion = data.session_version + 1
  const password_hash = await hash(newPassword, PASSWORD_HASH_COST)
  const { error: updErr } = await supabase
    .from('users')
    .update({ password_hash, must_change_password: false, session_version: newSessionVersion, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  logLoginEvent('password_change', user.username, request)

  // 呼叫者自己的 session 不該被登出：同步更新自己這份 cookie 的版本號，
  // 否則下一個請求就會因為 cookie 版本 ≠ DB 版本而被判失效。
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_VERSION_COOKIE, String(newSessionVersion), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_MINUTES * 60,
  })
  return res
}
