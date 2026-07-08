import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth/middleware'
import { logAdminAction } from '@/lib/auth/audit'
import { resolveDisplayNames } from '@/lib/auth/displayName'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

// 列出帳號（superadmin：全部；system_admin：僅同體系）
export async function GET(request: NextRequest) {
  const actor = await requireManager(request)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  let query = supabase
    .from('users')
    .select('id, username, role, system, display_name, active, must_change_password, created_at, updated_at')
    .order('created_at', { ascending: true })

  // system_admin 僅見同體系
  if (actor.role !== 'superadmin' && actor.system) {
    query = query.eq('system', actor.system)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 對「無 display_name 的學員 ID 型帳號」補上「姓名(ID)」，供列表顯示
  const nameMap = await resolveDisplayNames(
    (data ?? []).map((u) => ({ username: u.username, display_name: u.display_name })),
  )
  const users = (data ?? []).map((u) => ({
    ...u,
    display_name_resolved: u.username ? nameMap.get(u.username) ?? u.username : u.username,
  }))
  return NextResponse.json({ users })
}

// 新增帳號（superadmin：任意；system_admin：僅同體系、不可建 superadmin）
export async function POST(request: NextRequest) {
  const actor = await requireManager(request)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username, password, role, system, display_name } = await request.json() as {
    username?: string
    password?: string
    role?: UserRole
    system?: SheetSystem | null
    display_name?: string | null
  }

  if (!username || !password || !role) {
    return NextResponse.json({ error: '缺少必填欄位' }, { status: 400 })
  }

  // 體系管理者（system_admin）的限制：不可建 superadmin、體系強制為自己體系
  let effectiveSystem = system ?? null
  if (actor.role !== 'superadmin') {
    if (role === 'superadmin') {
      return NextResponse.json({ error: '無權建立系統管理者' }, { status: 403 })
    }
    effectiveSystem = actor.system // 強制同體系
  }

  if ((role === 'admin' || role === 'system_admin') && !effectiveSystem) {
    return NextResponse.json({ error: '此角色必須指定體系' }, { status: 400 })
  }
  if (role === 'superadmin' && effectiveSystem) {
    return NextResponse.json({ error: 'superadmin 不可綁定體系' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: '帳號已存在' }, { status: 409 })
  }

  const password_hash = await hash(password, 10)
  const { data, error } = await supabase
    .from('users')
    .insert({
      username,
      password_hash,
      role,
      system: role === 'superadmin' ? null : effectiveSystem,
      display_name: display_name?.trim() || null,
      must_change_password: true,
    })
    .select('id, username, role, system, display_name, active, must_change_password, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAdminAction('user_created', { actor: actor.username, target: username, detail: `role=${role}, system=${data.system ?? '—'}` }, request)
  return NextResponse.json({ user: data })
}
