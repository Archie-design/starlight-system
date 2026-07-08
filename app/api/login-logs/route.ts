import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth/middleware'
import { resolveByUsernames } from '@/lib/auth/displayName'

export async function GET(request: NextRequest) {
  if (!(await requireManager(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const username = searchParams.get('username') ?? ''
  const event = searchParams.get('event') ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '500'), 1000)

  const supabase = createServiceClient()
  let query = supabase
    .from('login_logs')
    .select('id, username, event, ip, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (username) query = query.ilike('username', `%${username}%`)
  if (event) query = query.eq('event', event)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 附上顯示姓名（display_name → 學員姓名(ID) → username）
  const nameMap = await resolveByUsernames((data ?? []).map((r) => r.username))
  const logs = (data ?? []).map((r) => ({ ...r, display_name: r.username ? nameMap.get(r.username) ?? r.username : null }))
  return NextResponse.json({ logs })
}
