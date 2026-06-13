import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/middleware'

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
  if (newPassword.length < 8) {
    return NextResponse.json({ error: '新密碼至少 8 個字元' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: '帳號不存在' }, { status: 404 })
  }

  const ok = await compare(oldPassword, data.password_hash)
  if (!ok) {
    return NextResponse.json({ error: '舊密碼錯誤' }, { status: 400 })
  }

  const password_hash = await hash(newPassword, 10)
  const { error: updErr } = await supabase
    .from('users')
    .update({ password_hash, must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
