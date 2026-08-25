import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { serverErrorResponse } from '@/lib/utils/apiError'
import { getEffectiveSystem } from '@/lib/auth'
import { requireManager } from '@/lib/auth/middleware'
import { studentIdsAllInSystem } from '@/lib/utils/system'

export async function GET(request: NextRequest) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('parent_aliases')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return serverErrorResponse('parent-aliases', error)
  return NextResponse.json({ aliases: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await requireManager(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { original_parent_id, proxy_parent_id, note } = await request.json()
  if (!original_parent_id || !proxy_parent_id) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 兩個學員 ID 都必須屬於呼叫者有效體系，避免跨體系建立代管關係
  if (user.role !== 'superadmin') {
    const effectiveSystem = await getEffectiveSystem(user)
    const ok = await studentIdsAllInSystem(supabase, [original_parent_id, proxy_parent_id], effectiveSystem)
    if (!ok) return NextResponse.json({ error: '學員須屬於你的體系' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('parent_aliases')
    .upsert({ original_parent_id, proxy_parent_id, note }, { onConflict: 'original_parent_id' })
    .select('*')
    .single()

  if (error) return serverErrorResponse('parent-aliases', error)
  return NextResponse.json({ alias: data })
}
