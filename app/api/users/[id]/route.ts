import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/middleware'

// 更新帳號：停用/啟用、或重設密碼（僅 superadmin）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireSuperadmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { active, newPassword } = await request.json() as {
    active?: boolean
    newPassword?: string
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof active === 'boolean') {
    // 不允許停用自己，避免鎖死
    if (!active && id === admin.id) {
      return NextResponse.json({ error: '無法停用自己的帳號' }, { status: 400 })
    }
    update.active = active
  }

  if (newPassword) {
    update.password_hash = await hash(newPassword, 10)
    update.must_change_password = true // 重設後要求對方再次自行設定
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: '無更新內容' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .update(update)
    .eq('id', id)
    .select('id, username, role, system, active, must_change_password')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '帳號不存在' }, { status: 404 })
  return NextResponse.json({ user: data })
}
