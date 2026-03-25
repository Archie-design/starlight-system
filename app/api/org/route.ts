import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const system = request.nextUrl.searchParams.get('system') ?? '星光'
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const PAGE = 1000
  const allRows: unknown[] = []

  for (let from = 0; ; from += PAGE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: chunk, error } = await (supabase as any)
      .from('students')
      .select('id, name, role, region, introducer')
      .eq('sheet_system', system)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!chunk || chunk.length === 0) break
    allRows.push(...chunk)
    if (chunk.length < PAGE) break
  }

  return NextResponse.json({ students: allRows })
}
