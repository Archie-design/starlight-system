import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const name = searchParams.get('name') ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '500'), 1000)

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('edit_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (name) {
    query = query.ilike('student_name', `%${name}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}
