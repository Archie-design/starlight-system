import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkAuth } from '@/lib/auth'

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('parent_aliases')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ aliases: data ?? [] })
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { original_parent_id, proxy_parent_id, note } = await request.json()
  if (!original_parent_id || !proxy_parent_id) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('parent_aliases')
    .upsert({ original_parent_id, proxy_parent_id, note }, { onConflict: 'original_parent_id' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alias: data })
}
