import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/middleware'
import type { SheetSystem, UserRole } from '@/lib/supabase/types'

// 列出所有帳號（僅 superadmin）
export async function GET(request: NextRequest) {
  if (!(await requireSuperadmin(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, username, role, system, active, must_change_password, created_at, updated_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

// 新增帳號（僅 superadmin）
export async function POST(request: NextRequest) {
  if (!(await requireSuperadmin(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { username, password, role, system } = await request.json() as {
    username?: string
    password?: string
    role?: UserRole
    system?: SheetSystem | null
  }

  if (!username || !password || !role) {
    return NextResponse.json({ error: '缺少必填欄位' }, { status: 400 })
  }
  if (role === 'admin' && !system) {
    return NextResponse.json({ error: 'admin 必須指定體系' }, { status: 400 })
  }
  if (role === 'superadmin' && system) {
    return NextResponse.json({ error: 'superadmin 不可綁定體系' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // username 重複檢查
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
      system: role === 'admin' ? system : null,
      must_change_password: true,
    })
    .select('id, username, role, system, active, must_change_password, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}
