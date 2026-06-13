import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth/middleware'

export async function GET(request: NextRequest) {
  if (!(await requireSuperadmin(request))) {
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
  return NextResponse.json({ logs: data ?? [] })
}
