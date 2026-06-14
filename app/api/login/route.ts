import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import {
  SESSION_COOKIE,
  SESSION_UID_COOKIE,
  CSRF_TOKEN_COOKIE,
  SESSION_EXPIRY_MINUTES,
} from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { logLoginEvent } from '@/lib/auth/audit'
import { systemOf } from '@/lib/utils/system'
import { LEADER_ROLES, SYSTEM_ADMIN_STUDENT_ROLES } from '@/lib/constants'
import { randomBytes } from 'crypto'

/** 手機末四碼（去除非數字後取尾 4 碼） */
function lastFour(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

function buildSession(uid: string, mustChange: boolean): NextResponse {
  const secret = process.env.AUTH_SECRET!
  const now = Date.now()
  const csrfToken = randomBytes(32).toString('hex')
  const res = NextResponse.json({ ok: true, mustChangePassword: mustChange })
  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: SESSION_EXPIRY_MINUTES * 60 }
  res.cookies.set(SESSION_COOKIE, secret, cookieOpts)
  res.cookies.set(`${SESSION_COOKIE}_ts`, String(now), cookieOpts)
  res.cookies.set(SESSION_UID_COOKIE, uid, cookieOpts)
  res.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, { ...cookieOpts, httpOnly: false })
  return res
}

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
  const fail = () => {
    logLoginEvent('login_failure', username, req)
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  // 1) 既有帳號
  const { data: user } = await supabase
    .from('users')
    .select('id, password_hash, active, must_change_password')
    .eq('username', username)
    .maybeSingle()

  if (user) {
    if (user.active !== true) return fail()
    const ok = await compare(password, user.password_hash)
    if (!ok) return fail()
    logLoginEvent('login_success', username, req)
    return buildSession(user.id, user.must_change_password)
  }

  // 2) 自助登入：username 當學員 ID，關懷長以上 + 手機末四碼
  const studentId = Number(username)
  if (!Number.isInteger(studentId)) return fail()

  const { data: student } = await supabase
    .from('students')
    .select('id, role, phone, business_chain')
    .eq('id', studentId)
    .maybeSingle()

  if (!student || !LEADER_ROLES.includes(student.role ?? '') || lastFour(student.phone) !== password) {
    return fail()
  }

  // 通過 → 建帳號（首次強制改密碼）。體系長 → system_admin（有管理權）；關懷長 → admin
  const role = SYSTEM_ADMIN_STUDENT_ROLES.includes(student.role ?? '') ? 'system_admin' : 'admin'
  const password_hash = await hash(password, 10)
  const { data: created, error: insErr } = await supabase
    .from('users')
    .insert({
      username,
      password_hash,
      role,
      system: systemOf(student.business_chain),
      active: true,
      must_change_password: true,
    })
    .select('id')
    .maybeSingle()

  if (insErr || !created) {
    // 競態：可能同時被建立 → 不洩漏細節
    return fail()
  }

  logLoginEvent('login_success', username, req)
  return buildSession(created.id, true)
}
