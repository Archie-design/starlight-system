import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  if (!(await requireManager(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const actor = searchParams.get('actor') ?? ''
  const action = searchParams.get('action') ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '500'), 1000)

  const supabase = createServiceClient()
  let query = supabase
    .from('admin_audit')
    .select('id, actor, action, target, detail, ip, user_agent, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (actor) query = query.ilike('actor', `%${actor}%`)
  if (action) query = query.eq('action', action)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}
