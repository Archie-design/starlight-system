import { NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_UID_COOKIE,
  VIEW_SYSTEM_COOKIE,
  CSRF_TOKEN_COOKIE,
} from '@/lib/auth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  for (const name of [
    SESSION_COOKIE,
    `${SESSION_COOKIE}_ts`,
    `${SESSION_COOKIE}_email`, // 清除既有舊 cookie（向後相容）
    SESSION_UID_COOKIE,
    VIEW_SYSTEM_COOKIE,
    CSRF_TOKEN_COOKIE,
  ]) {
    res.cookies.delete(name)
  }
  return res
}
