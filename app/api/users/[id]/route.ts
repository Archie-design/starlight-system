import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth/middleware'
import { logAdminAction } from '@/lib/auth/audit'

// 更新帳號：停用/啟用、或重設密碼
// superadmin：任意；system_admin：僅同體系帳號
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireManager(request)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { active, newPassword, display_name } = await request.json() as {
    active?: boolean
    newPassword?: string
    display_name?: string | null
  }

  const supabase = createServiceClient()

  // 取目標帳號，驗證體系權限
  const { data: target } = await supabase
    .from('users')
    .select('id, username, role, system')
    .eq('id', id)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: '帳號不存在' }, { status: 404 })

  // system_admin 只能管同體系、且不可管 superadmin
  if (actor.role !== 'superadmin') {
    if (target.role === 'superadmin' || target.system !== actor.system) {
      return NextResponse.json({ error: '無權管理此帳號' }, { status: 403 })
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  let auditAction: string | null = null

  if (typeof active === 'boolean') {
    if (!active && id === actor.id) {
      return NextResponse.json({ error: '無法停用自己的帳號' }, { status: 400 })
    }
    update.active = active
    auditAction = active ? 'user_enabled' : 'user_disabled'
  }

  if (newPassword) {
    update.password_hash = await hash(newPassword, 10)
    update.must_change_password = true
    auditAction = 'password_reset'
  }

  if (display_name !== undefined) {
    update.display_name = display_name?.trim() || null
    auditAction = 'display_name_updated'
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: '無更新內容' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('users')
    .update(update)
    .eq('id', id)
    .select('id, username, role, system, display_name, active, must_change_password')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '帳號不存在' }, { status: 404 })

  if (auditAction) {
    logAdminAction(auditAction, { actor: actor.username, target: target.username }, request)
  }
  return NextResponse.json({ user: data })
}
